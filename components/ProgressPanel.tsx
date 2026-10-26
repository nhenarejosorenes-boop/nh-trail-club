"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import MembershipNotice from "./MembershipNotice";
import { loadMembershipAccess } from "@/lib/membership-client";
import type { MembershipAccess } from "@/lib/membership-model";
import { athleteToday, monthRange, trainingProgress, type ProgressSession, type TrailEntry } from "@/lib/training-progress";
import { loadTrailMonth } from "@/lib/trail-log";
import styles from "./athlete-panels.module.css";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
const number = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const dateLabel = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short" });
const duration = (minutes: number) => Math.floor(minutes / 60) + " h " + minutes % 60 + " min";

export default function ProgressPanel() {
  const [month, setMonth] = useState(() => athleteToday().slice(0, 7));
  const [access, setAccess] = useState<MembershipAccess | null>(null);
  const [sessions, setSessions] = useState<ProgressSession[]>([]);
  const [entries, setEntries] = useState<TrailEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadedMonth, setLoadedMonth] = useState("");
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    (async () => { try {
      const range = monthRange(month);
      const auth = await supabase.auth.getUser();
      if (!active) return;
      if (auth.error || !auth.data.user) { window.location.replace("/login"); return; }
      const uid = auth.data.user.id;
      const membership = await loadMembershipAccess(supabase, uid);
      if (!active) return;
      setAccess(membership);
      if (!membership.premium) { setSessions([]); setEntries([]); return; }
      const [plan, log] = await Promise.all([
        supabase.from("weekly_training_plan").select("id,session_date,category,title,completed")
          .eq("athlete_id", uid).gte("session_date", range.start).lt("session_date", range.end).order("session_date", { ascending: false }),
        loadTrailMonth(supabase, uid, range),
      ]);
      if (plan.error) throw plan.error;
      if (active) { setSessions((plan.data ?? []) as ProgressSession[]); setEntries(log); setLoadedMonth(month); }
    } catch { if (active) setError("No se pudieron cargar tus registros. Comprueba la conexión y vuelve a intentarlo."); }
    finally { if (active) setLoading(false); } })();
    return () => { active = false; };
  }, [month]);
  const today = athleteToday();
  const progress = useMemo(() => trainingProgress(sessions, entries, month, today), [sessions, entries, month, today]);
  const visible = sessions.filter(s => filter === "all" || (filter === "completed" ? s.completed : !s.completed));
  const maxKm = Math.max(1, ...progress.weeks.map(w => w.km));
  const waiting = loading || (!error && access?.premium && loadedMonth !== month);
  if (!loading && !access?.premium) return <MembershipNotice access={access} error={Boolean(error)} />;
  return <main className={styles.page}><div className={styles.inner}>
    <p className={styles.brand}>NH TRAINING CONCEPT</p><Link className={styles.back} href="/dashboard">← Volver al panel principal</Link>
    <h1>Mi progreso</h1><p className={styles.intro}>Consulta la evolución de tu planificación y de las salidas que has registrado.</p>
    <nav className={styles.nav}><Link className={styles.link} href="/entrenamientos">Mis entrenamientos</Link><Link className={styles.link} href="/seguimiento-trail">Registrar salida de trail</Link><Link className={styles.link} href="/entrenamientos/plan">Plan semanal</Link></nav>
    <div className={styles.controls}><label>Mes de seguimiento<input className={styles.field} type="month" value={month} min="2000-01" max="2100-12" onChange={e => { const value=e.target.value; if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= "2000-01" && value <= "2100-12") setMonth(value); }} /></label></div>
    {waiting ? <p role="status">Cargando tu progreso...</p> : error ? <section className={styles.panel}><p role="alert" className={styles.error}>{error}</p><button className={styles.field} onClick={() => window.location.reload()}>Volver a intentar</button></section> : <>
      <section className={styles.panel}><h2>Tu planificación del mes</h2>
        <p><strong>{progress.completed} de {progress.planned}</strong> sesiones completadas{progress.planned ? " · " + progress.completion + "%" : " · Sin planificación registrada"}</p>
        <div className={styles.track} role="progressbar" aria-label="Plan mensual completado" aria-valuenow={progress.completion} aria-valuemin={0} aria-valuemax={100}><div className={styles.fill} style={{ width: progress.completion + "%" }} /></div>
        <p className={styles.note}>El total incluye las sesiones futuras programadas dentro del mes seleccionado.</p>
        <div className={styles.stats}>{[["Completadas", progress.completed], ["Pendientes de fechas pasadas", progress.overdue], ["Pendientes de hoy y próximas", progress.upcoming]].map(([label, value]) => <div className={styles.stat} key={label}><p>{label}</p><strong>{value}</strong></div>)}</div>
        <div className={styles.scroll}><table className={styles.table}><caption className={styles.note}>Distribución por disciplina</caption><thead><tr><th scope="col">Disciplina</th><th scope="col">Programadas</th><th scope="col">Completadas</th></tr></thead><tbody>{progress.categories.map(c => <tr key={c.category}><th scope="row" style={{ textTransform: "capitalize" }}>{c.category}</th><td>{c.planned}</td><td>{c.completed}</td></tr>)}</tbody></table></div>
      </section>
      <h2>Trail registrado</h2><section className={styles.stats}>{[["Salidas", progress.runs], ["Distancia", number(progress.km) + " km"], ["Desnivel positivo", number(progress.elevation) + " m+"], ["Duración", duration(progress.minutes)], ["Esfuerzo medio", progress.averageEffort === null ? "Sin datos" : number(progress.averageEffort) + " / 10"], ["Carga registrada", number(progress.load) + " u.a." + (progress.missingEffort ? "*" : "")]].map(([label, value]) => <div className={styles.stat} key={label}><p>{label}</p><strong>{value}</strong></div>)}</section>
      <p className={styles.note}>Carga registrada = duración en minutos × esfuerzo percibido de cada salida. {progress.missingEffort > 0 && "* Cálculo parcial: " + progress.missingEffort + " salida(s) sin esfuerzo registrado."}</p>
      <section className={styles.panel}><h2>Evolución semanal de distancia</h2><p className={styles.note}>Semanas de lunes a domingo. Se suman exclusivamente los registros del mes seleccionado.</p>
        {progress.weeks.map(w => <div className={styles.week} key={w.start}><span className={styles.weeklabel}>Desde {dateLabel(w.start)}</span><div><div className={styles.weekbar} style={{ width: w.km / maxKm * 100 + "%" }} /></div><span>{number(w.km)} km</span></div>)}
        {!progress.runs && <p className={styles.note}>Todavía no hay salidas registradas en este mes. <Link className={styles.link} href="/seguimiento-trail">Registrar una salida →</Link></p>}
      </section>
      <section className={styles.panel}><h2>Historial de sesiones</h2><label>Mostrar<select className={styles.field} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todas las sesiones</option><option value="completed">Completadas</option><option value="pending">Pendientes</option></select></label>
        {!visible.length && <p className={styles.intro}>No hay sesiones para este mes y filtro.</p>}
        {visible.map(s => <article className={styles.row} key={s.id}><div><strong>{s.title}</strong><p>{dateLabel(s.session_date)} · {s.category}</p></div><span className={s.completed ? styles.done : styles.pending}>{s.completed ? "✓ Completada" : "Pendiente"}</span></article>)}
      </section>
      <section className={styles.panel}><h2>Salidas registradas del mes</h2>{!entries.length ? <p className={styles.intro}>Aún no hay registros de trail en este mes.</p> : <div className={styles.scroll}><table className={styles.table}><thead><tr>{["Fecha", "Distancia", "Desnivel", "Tiempo", "Esfuerzo"].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{entries.map(e => <tr key={e.id}><td>{dateLabel(e.activity_date)}</td><td>{number(Number(e.distance_km))} km</td><td>{number(e.elevation_m)} m+</td><td>{duration(e.duration_minutes)}</td><td>{e.effort ?? "Sin indicar"}</td></tr>)}</tbody></table></div>}</section>
      <p className={styles.note}>Completar una sesión del plan y registrar una salida son acciones independientes. Los totales de distancia, tiempo y desnivel proceden del registro de salidas.</p>
    </>}
  </div></main>;
}
