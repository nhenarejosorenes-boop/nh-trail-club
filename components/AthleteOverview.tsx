"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { athleteToday, trainingProgress } from '@/lib/training-progress';
import { athletePlanHref, loadAthleteMonth, type AthleteMonth } from '@/lib/athlete-detail';
import styles from './athlete-panels.module.css';
const number = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
const dateLabel = (date: string) => new Date(date + 'T12:00:00Z').toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short' });
export default function AthleteOverview({ client, athlete, cardId }: { client: SupabaseClient; athlete: string; cardId: string }) {
  const [month, setMonth] = useState(() => athleteToday().slice(0, 7));
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{ key: string; data: AthleteMonth | null; error: boolean } | null>(null);
  const key = athlete + ':' + month + ':' + reload;
  useEffect(() => {
    let active = true;
    loadAthleteMonth(client, athlete, month).then(data => { if (active) setResult({ key, data, error: false }); })
      .catch(() => { if (active) setResult({ key, data: null, error: true }); });
    return () => { active = false; };
  }, [client, athlete, month, key]);
  const loaded = result?.key === key ? result : null;
  return <>
    <div className={styles.controls}><label>Mes de seguimiento<input className={styles.field} type="month" min="2000-01" max="2100-12" value={month} onChange={e => { const v = e.target.value; if (/^\d{4}-(0[1-9]|1[0-2])$/.test(v) && v >= '2000-01' && v <= '2100-12') setMonth(v); }}/></label><button type="button" className={styles.field} disabled={!loaded} onClick={() => setReload(n => n + 1)}>Actualizar seguimiento</button></div>
    {!loaded ? <p role="status">Cargando entrenamientos, salidas e informes…</p> : loaded.error ? <section className={styles.panel} role="alert"><p className={styles.error}>No se pudo cargar el seguimiento completo. Reintenta para consultar los datos.</p><button type="button" className={styles.field} onClick={() => setReload(n => n + 1)}>Reintentar seguimiento</button></section> : loaded.data && <AthleteOverviewContent data={loaded.data} athlete={athlete} cardId={cardId} month={month} today={athleteToday()}/>}
  </>;
}
export function AthleteOverviewContent({ data, athlete, cardId, month, today }: { data: AthleteMonth; athlete: string; cardId: string; month: string; today: string }) {
  const progress = trainingProgress(data.sessions, data.entries, month, today);
  const activeGoal = data.goals.find(g => g.status === 'active');
  const selectedDate = month === today.slice(0, 7) ? today : month + '-01';
  const sessions = [...data.sessions].sort((a, b) => b.session_date.localeCompare(a.session_date) || a.id.localeCompare(b.id));
  const entries = [...data.entries].sort((a, b) => b.activity_date.localeCompare(a.activity_date) || a.id.localeCompare(b.id));
  const titles = new Map(data.sessions.map(s => [s.id, s.title]));
  return <>
    <nav className={styles.nav} aria-label="Gestionar este deportista"><Link className={styles.link} href={athletePlanHref(athlete, selectedDate)}>Gestionar planificación →</Link><Link className={styles.link} href={'/objetivos?' + new URLSearchParams({ athlete }).toString()}>Objetivo y revisión semanal →</Link><Link className={styles.link} href={'/mensajes?' + new URLSearchParams({ athlete }).toString()}>Conversación privada →</Link><Link className={styles.link} href={'/entrenador/seguimiento?' + new URLSearchParams({ athlete: cardId, month }).toString()}>Abrir panel del entrenador →</Link></nav>
    <section className={styles.panel}><h2>Objetivo deportivo</h2>{activeGoal ? <><h3>{activeGoal.title}</h3><p className={styles.intro}>Fecha del objetivo o revisión: {dateLabel(activeGoal.target_date)}</p><p className={styles.note}>El objetivo activo se muestra aunque sus fechas queden fuera del mes seleccionado.</p></> : <p className={styles.intro}>No hay un objetivo activo registrado. Puedes definirlo desde «Objetivo y revisión semanal».</p>}</section>
    <section className={styles.stats} aria-label="Resumen mensual del deportista">{[['Plan completado', `${progress.completed} / ${progress.planned}`], ['Salidas', progress.runs], ['Distancia', number(progress.km) + ' km'], ['Desnivel positivo', number(progress.elevation) + ' m+'], ['Tiempo', number(progress.minutes) + ' min'], ['Carga sRPE', number(progress.load) + ' u.a.' + (progress.missingEffort ? '*' : '')]].map(([label, value]) => <div className={styles.stat} key={label}><p>{label}</p><strong>{value}</strong></div>)}</section>
    <p className={styles.note}>La planificación incluye sesiones futuras del mes. La carga suma minutos × RPE de las salidas registradas. {progress.missingEffort > 0 ? `* Cálculo parcial: ${progress.missingEffort} salida(s) sin esfuerzo indicado.` : progress.runs ? 'Todas las salidas del mes tienen RPE indicado.' : 'No hay salidas registradas para calcular la carga.'} Marcar una sesión como completada y registrar una salida son acciones independientes.</p>
    <section className={styles.panel}><h2>Entrenamientos del mes</h2>{!sessions.length ? <p>No hay sesiones programadas en este mes.</p> : <><p className={styles.note}>Mostrando {Math.min(10, sessions.length)} de {sessions.length} sesiones, ordenadas por fecha. Abre el plan para consultar o editar una semana.</p>{sessions.slice(0, 10).map(s => <article className={styles.row} key={s.id}><div><strong>{s.title}</strong><p>{dateLabel(s.session_date)} · {s.category} · {s.completed ? 'Completada' : 'Pendiente'}</p></div><Link className={styles.link} href={athletePlanHref(athlete, s.session_date)}>Abrir semana →</Link></article>)}</>}</section>
    <section className={styles.panel}><h2>Evolución semanal de trail</h2><p className={styles.note}>Semanas de lunes a domingo. Solo se suman las salidas del mes seleccionado; las semanas de los extremos pueden ser parciales.</p><div className={styles.scroll}><table className={styles.table}><thead><tr>{['Semana desde', 'Salidas', 'Kilómetros', 'Desnivel', 'Minutos'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{progress.weeks.map(w => <tr key={w.start}><th scope="row">{dateLabel(w.start)}</th><td>{w.count}</td><td>{number(w.km)}</td><td>{number(w.elevation)} m+</td><td>{number(w.minutes)}</td></tr>)}</tbody></table></div></section>
    <section className={styles.panel}><h2>Informes de las sesiones del mes</h2><p className={styles.note}>Esfuerzo y sensaciones guardados por el corredor en sus sesiones. Se muestran los ocho informes actualizados más recientemente. Son independientes del RPE de las salidas.</p>{!data.feedback.length ? <p>No hay informes guardados para estas sesiones.</p> : [...data.feedback].sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.session_id.localeCompare(b.session_id)).slice(0, 8).map(f => <article className={styles.row} key={f.session_id}><div><strong>{titles.get(f.session_id) ?? 'Sesión del mes'}</strong><p>Esfuerzo: {f.effort === null ? 'Sin indicar' : f.effort + ' / 10'}</p><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{f.sensations || 'Sin comentario de sensaciones.'}</p></div></article>)}</section>
    <section className={styles.panel}><h2>Salidas de montaña del mes</h2>{!entries.length ? <p>No hay salidas registradas en este mes.</p> : <><p className={styles.note}>Mostrando {Math.min(10, entries.length)} de {entries.length} salidas. Los totales superiores incluyen todo el mes.</p><div className={styles.scroll}><table className={styles.table}><thead><tr>{['Fecha', 'Distancia', 'Desnivel', 'Minutos', 'RPE', 'Origen', 'Plan'].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{entries.slice(0, 10).map(e => <tr key={e.id}><td>{dateLabel(e.activity_date)}</td><td>{number(Number(e.distance_km))} km</td><td>{number(e.elevation_m)} m+</td><td>{e.duration_minutes}</td><td>{e.effort ?? 'Sin indicar'}</td><td>{e.source === 'file' ? 'Archivo ' + (e.file_format?.toUpperCase() ?? '') : 'Manual'}</td><td>{e.linked_session_id ? 'Vinculada' : 'Sin vincular'}</td></tr>)}</tbody></table></div></>}</section>
  </>;
}
