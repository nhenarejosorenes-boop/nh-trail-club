"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { athleteToday, monthRange, trainingProgress } from "@/lib/training-progress";
import { loadCoachAthletes, loadCoachMonth, type CoachAthlete, type CoachLog, type CoachPlan } from "@/lib/coach-tracking";
import coach from "./coach.module.css";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
const panel: React.CSSProperties = { padding: 20, borderRadius: 12, marginBottom: 24 };
const field: React.CSSProperties = { display: "block", marginTop: 8, background: "#242424", color: "white", padding: 12, border: "1px solid #555", borderRadius: 8, maxWidth: "100%" };
const fmt = (value: number) => value.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const dateLabel = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short" });
const delta = (current: number, previous: number) => previous === 0 ? "—" : (current >= previous ? "+" : "") + fmt((current - previous) / previous * 100) + "%";
const linkStyle = { color: "#ffad63" };

export default function SeguimientoEntrenador() {
  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [logs, setLogs] = useState<CoachLog[]>([]);
  const [plans, setPlans] = useState<CoachPlan[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [month, setMonth] = useState(() => athleteToday().slice(0, 7));
  const [loadedMonth, setLoadedMonth] = useState("");
  const [reload, setReload] = useState(0);
  const today = athleteToday();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const auth = await supabase.auth.getUser();
        if (!active) return;
        if (auth.error || !auth.data.user) { window.location.replace("/login"); return; }
        const profile = await supabase.from("profiles").select("role").eq("id", auth.data.user.id).single();
        if (!active) return;
        if (profile.error) throw profile.error;
        if (profile.data?.role !== "admin") { setAccessError("Acceso exclusivo para administradores."); return; }
        const data = await loadCoachAthletes(supabase);
        if (active) { setAthletes(data); setAllowed(true); }
      } catch { if (active) setAccessError("No se pudo comprobar el acceso o cargar los deportistas. Vuelve a intentarlo."); }
      finally { if (active) setChecking(false); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true); setError("");
    (async () => {
      try {
        const result = await loadCoachMonth(supabase, monthRange(month));
        if (active) { setLogs(result.logs); setPlans(result.plans); setLoadedMonth(month); }
      } catch { if (active) setError("No se pudo cargar el mes completo. Comprueba la conexión y vuelve a intentarlo."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [allowed, month, reload]);

  const visible = athletes.filter(a => !selected || a.id === selected);
  const linked = visible.filter(a => a.user_id);
  const linkedIds = new Set(linked.map(a => a.user_id!));
  const visibleLogs = logs.filter(log => linkedIds.has(log.athlete_id));
  const visiblePlans = plans.filter(plan => linkedIds.has(plan.athlete_id));
  const progress = trainingProgress(visiblePlans, visibleLogs, month, today);
  const athleteRows = useMemo(() => athletes.map(athlete => ({ athlete, progress: trainingProgress(
    athlete.user_id ? plans.filter(p => p.athlete_id === athlete.user_id) : [],
    athlete.user_id ? logs.filter(l => l.athlete_id === athlete.user_id) : [], month, today,
  ) })), [athletes, plans, logs, month, today]);
  const rows = athleteRows.filter(r => !selected || r.athlete.id === selected);
  const range = monthRange(month);
  const weeks = progress.weeks.map(week => {
    const next = new Date(week.start + "T12:00:00Z"); next.setUTCDate(next.getUTCDate() + 7);
    const end = next.toISOString().slice(0, 10);
    const efforts = visibleLogs.filter(l => l.activity_date >= week.start && l.activity_date < end && l.effort !== null);
    const last = new Date((end < range.end ? end : range.end) + "T12:00:00Z"); last.setUTCDate(last.getUTCDate() - 1);
    return { ...week, label: dateLabel(week.start > range.start ? week.start : range.start) + " – " + dateLabel(last.toISOString().slice(0, 10)),
      effort: efforts.length ? efforts.reduce((n, l) => n + l.effort!, 0) / efforts.length : null,
      load: efforts.reduce((n, l) => n + l.duration_minutes * l.effort!, 0), missing: week.count - efforts.length };
  });
  const maxKm = Math.max(1, ...weeks.map(w => w.km));
  const maxElevation = Math.max(1, ...weeks.map(w => w.elevation));
  const planDate = month === today.slice(0, 7) ? today : range.start;
  const planHref = (userId: string) => "/entrenamientos/plan?" + new URLSearchParams({ athlete: userId, date: planDate }).toString();
  const waiting = loading || loadedMonth !== month;
  const names = new Map(linked.map(a => [a.user_id!, a.nombre]));
  const recent = [...visibleLogs].sort((a, b) => b.activity_date.localeCompare(a.activity_date) || a.id.localeCompare(b.id)).slice(0, 8);

  return <main className={coach.shell}>
    <aside className={coach.sidebar}><div><div className={coach.logo}>NH</div><p className={coach.brand}>CLUB TRAIL RUNNING ALICANTE</p></div>
      <nav aria-label="Navegación del entrenador">{[["/dashboard", "Panel principal"], ["/salidas", "Salidas del club"], ["/entrenamientos", "Entrenamientos"], ["/deportistas", "Deportistas"], ["/entrenamientos/plan", "Planificación"], ["/entrenador/seguimiento", "Panel del entrenador"]].map(([href, label]) => <Link key={href} href={href} className={coach.navLink + (href === "/entrenador/seguimiento" ? " " + coach.navActive : "")} aria-current={href === "/entrenador/seguimiento" ? "page" : undefined}>{label}</Link>)}</nav>
      <div className={coach.tagline}>TU META,<br />MI DESAFÍO</div><div className={coach.mobileNav}><Link href="/dashboard">Inicio</Link><Link href="/entrenamientos/plan">Planificación</Link><Link href="/deportistas">Deportistas</Link></div>
    </aside>
    <div className={coach.content}>
      <p className={coach.eyebrow}>NH / CLUB TRAIL RUNNING ALICANTE</p><h1 className={coach.heading}>Panel del entrenador</h1><p className={coach.intro}>Seguimiento mensual y planificación de los corredores vinculados.</p><Link href="/dashboard" style={linkStyle}>← Volver al panel</Link>
      {checking ? <p role="status">Comprobando acceso y deportistas...</p> : accessError ? <section><p role="alert" style={{ color: "#ffa9a9" }}>{accessError}</p><button style={field} onClick={() => window.location.reload()}>Volver a comprobar</button></section> : allowed && <>
        <section className={coach.controls}>
          <label>Mes de seguimiento<input type="month" min="2000-01" max="2100-12" value={month} style={field} onChange={e => { const value = e.target.value; if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= "2000-01" && value <= "2100-12" && value !== month) { setMonth(value); setLoading(true); setError(""); } }} /></label>
          <label>Deportista<select value={selected} onChange={e => setSelected(e.target.value)} style={field}><option value="">Todos los deportistas</option>{athletes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
          <button style={field} disabled={loading} onClick={() => { setLoading(true); setReload(n => n + 1); }}>Actualizar mes</button>
          {linked.length === 1 && <Link href={planHref(linked[0].user_id!)} style={linkStyle}>Abrir su planificación →</Link>}
        </section>
        {error ? <p role="alert" style={{ color: "#ffa9a9" }}>{error}</p> : waiting ? <p role="status">Cargando seguimiento del mes...</p> : <>
          <section className={coach.stats}>{[["Corredores vinculados en la selección", new Set(linked.map(a => a.user_id)).size], ["Salidas registradas", progress.runs], ["Kilómetros", fmt(progress.km) + " km"], ["Desnivel positivo", fmt(progress.elevation) + " m+"]].map(([label, value]) => <div key={label} className={coach.stat}><p className={coach.statLabel}>{label}</p><strong className={coach.statValue}>{value}</strong></div>)}</section>
          <div className={coach.charts}>
            <section className={coach.panel} style={panel}><h2>Evolución semanal</h2><p className={coach.intro}>Semanas de lunes a domingo. Se incluyen exclusivamente los días del mes seleccionado.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(" + weeks.length + ",minmax(0,1fr))", gap: 8, alignItems: "end" }}>{weeks.map(w => <div key={w.start}>
                <div aria-hidden="true" style={{ height: 150, display: "flex", gap: 5, alignItems: "end", justifyContent: "center", borderBottom: "1px solid #555" }}><div style={{ width: "42%", height: w.km / maxKm * 135, background: "#ff921f" }} /><div style={{ width: "42%", height: w.elevation / maxElevation * 135, background: "#68b9ce" }} /></div>
                <p style={{ fontSize: 11, textAlign: "center" }}>{w.label}</p><p style={{ fontSize: 12, textAlign: "center", color: "#ffad63" }}>{fmt(w.km)} km</p><p style={{ fontSize: 12, textAlign: "center", color: "#8fd0e0" }}>{fmt(w.elevation)} m+</p>
              </div>)}</div><p className={coach.footer}>Naranja: kilómetros. Azul: desnivel. Cada serie tiene su propia escala.</p>
            </section>
            <section className={coach.panel} style={panel}><h2>Comparativa semanal</h2><div style={{ overflowX: "auto" }}><table className={coach.table}><thead><tr>{["Periodo", "Salidas", "Km", "Cambio km", "Desnivel", "Cambio m+", "Minutos", "RPE medio", "Carga sRPE"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{weeks.map((w, index) => <tr key={w.start}>{[w.label, w.count, fmt(w.km), index ? delta(w.km, weeks[index - 1].km) : "—", fmt(w.elevation), index ? delta(w.elevation, weeks[index - 1].elevation) : "—", fmt(w.minutes), w.effort === null ? "—" : fmt(w.effort), fmt(w.load) + (w.missing ? " (parcial)" : "")].map((value, i) => <td key={i}>{value}</td>)}</tr>)}</tbody></table></div><p className={coach.footer}>La primera y última semana pueden ser parciales. Las variaciones comparan solo sus días dentro del mes. «—» indica que no hay base de comparación.</p></section>
          </div>
          <section className={coach.panel} style={panel}><h2>Resumen por corredor</h2><div style={{ overflowX: "auto" }}><table className={coach.table}><thead><tr>{["Corredor", "Salidas", "Km", "Desnivel", "Minutos", "RPE medio", "Carga sRPE", "Plan completado", "Planificación"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map(({ athlete: a, progress: p }) => <tr key={a.id}><th scope="row">{a.nombre}{!a.user_id && <small style={{ display: "block" }}>Sin cuenta vinculada</small>}</th>{[p.runs, fmt(p.km), fmt(p.elevation), fmt(p.minutes), p.averageEffort === null ? "—" : fmt(p.averageEffort), fmt(p.load) + (p.missingEffort ? " (parcial)" : ""), p.planned ? p.completed + "/" + p.planned : "—"].map((value, i) => <td key={i}>{a.user_id ? value : "—"}</td>)}<td>{a.user_id ? <Link style={linkStyle} href={planHref(a.user_id)}>Abrir plan</Link> : "Vincula una cuenta"}</td></tr>)}</tbody></table></div><p className={coach.footer}>Carga sRPE = minutos × esfuerzo registrado. El total es parcial cuando faltan esfuerzos. El plan incluye sesiones futuras del mes.</p></section>
          <section className={coach.panel} style={panel}><h2>Últimas salidas del mes</h2>{recent.length === 0 ? <p>No hay salidas registradas para esta selección.</p> : <div style={{ overflowX: "auto" }}><table className={coach.table}><thead><tr>{["Fecha", "Corredor", "Km", "Desnivel", "Minutos", "RPE"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{recent.map(log => <tr key={log.id}>{[dateLabel(log.activity_date), names.get(log.athlete_id), fmt(Number(log.distance_km)), fmt(log.elevation_m), fmt(log.duration_minutes), log.effort ?? "—"].map((value, i) => <td key={i}>{value}</td>)}</tr>)}</tbody></table></div>}</section>
          <h2 className={coach.sectionTitle}>Seguimiento individual</h2><div className={coach.athletes}>{rows.map(({ athlete: a, progress: p }) => <article key={a.id} className={coach.athlete}><h3>{a.nombre}</h3><p className={coach.intro}>{a.nivel || "Nivel no indicado"}</p>{!a.user_id ? <p>Sin cuenta vinculada. No hay registros asociados que consultar.</p> : <><p>{p.runs} salidas · {fmt(p.km)} km · {fmt(p.elevation)} m+</p><p>{fmt(p.minutes)} min · RPE medio: {p.averageEffort === null ? "Sin datos" : fmt(p.averageEffort) + " / 10"}</p><p>Plan completado: {p.completed}/{p.planned} sesiones</p><div role="progressbar" aria-label={"Plan mensual completado de " + a.nombre} aria-valuenow={p.completion} aria-valuemin={0} aria-valuemax={100} style={{ height: 8, background: "#444", borderRadius: 8, overflow: "hidden" }}><div style={{ height: "100%", width: p.completion + "%", background: "#ff921f" }} /></div><p>{p.overdue} pendientes de fechas pasadas · {p.upcoming} pendientes de hoy y próximas</p><Link style={linkStyle} href={planHref(a.user_id)}>Gestionar planificación →</Link></>}</article>)}</div>
          {rows.length === 0 && <p>No hay deportistas para mostrar.</p>}<p className={coach.footer}>Los registros de salidas y las sesiones completadas del plan son independientes. Las métricas reflejan únicamente los datos registrados del mes seleccionado.</p>
        </>}
      </>}
    </div>
  </main>;
}
