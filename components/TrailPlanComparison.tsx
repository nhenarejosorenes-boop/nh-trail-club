"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TrainingSession } from '@/lib/training-builder';
import { compareTrailSession, loadLinkedTrail, type LinkedTrailEntry } from '@/lib/trail-comparison';
import styles from './athlete-panels.module.css';

const fmt = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
function value(planned: number | null, actual: number | undefined, unit: string) {
  return <><div>Previsto: {planned === null ? 'Sin objetivo' : fmt(planned) + unit}</div><div>Registrado: {actual === undefined ? 'Sin datos' : fmt(actual) + unit}</div>
    {planned !== null && actual !== undefined && <small>Diferencia: {actual > planned ? '+' : ''}{fmt(actual - planned)}{unit}</small>}</>;
}
export default function TrailPlanComparison({ client, athlete, sessions, admin }: { client: SupabaseClient; athlete: string; sessions: readonly TrainingSession[]; admin: boolean }) {
  const trail = sessions.filter(s => s.category === 'trail');
  const ids = JSON.stringify(trail.map(s => s.id).sort());
  const request = athlete + ':' + ids;
  const [result, setResult] = useState<{ key: string; rows: LinkedTrailEntry[]; error: boolean } | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null);
    loadLinkedTrail(client, athlete, JSON.parse(ids)).then(rows => { if (active) setResult({ key: request, rows, error: false }); })
      .catch(() => { if (active) setResult({ key: request, rows: [], error: true }); });
    return () => { active = false; };
  }, [client, athlete, ids, request, reload]);
  if (!trail.length) return null;
  const loaded = result?.key === request ? result : null;
  return <section className={styles.panel} aria-label="Comparación del plan de trail">
    <h2>Trail: previsto y realizado</h2>
    <p className={styles.note}>Se suman las salidas vinculadas a cada sesión, aunque se hayan realizado en otra fecha. La diferencia compara con la prescripción actual; no indica una valoración de rendimiento.</p>
    {!loaded ? <p role="status">Comprobando actividades vinculadas…</p> : loaded.error ? <div role="alert"><p className={styles.error}>No se pudieron comprobar las actividades. La comparación no está disponible.</p><button className={styles.field} onClick={() => { setResult(null); setReload(n => n + 1); }}>Reintentar comparación</button></div> : <div className={styles.scroll}>
      <table className={styles.table}><caption>Sesiones de trail de la semana seleccionada</caption><thead><tr>{['Sesión', 'Distancia', 'Desnivel positivo', 'Tiempo', 'Esfuerzo'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{trail.map(session => {
          const c = compareTrailSession(session, loaded.rows);
          return <tr key={session.id}><th scope="row">{session.title}<p className={styles.note}>{new Date(session.session_date + 'T12:00:00Z').toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })}<br/>{c.runs.length ? `${c.runs.length} salida(s) vinculada(s)` : 'Sin actividad vinculada'}<br/>{session.completed ? 'Marcada como completada' : 'Pendiente en el plan'}</p></th>
            <td>{value(c.planned.distance, c.actual?.distance, ' km')}</td><td>{value(c.planned.elevation, c.actual?.elevation, ' m+')}</td><td>{value(c.planned.minutes, c.actual?.minutes, ' min')}</td>
            <td>{value(c.planned.effort, c.actual?.effort ?? undefined, ' / 10')}{c.missingEffort > 0 && <p className={styles.note}>{c.missingEffort} salida(s) sin esfuerzo indicado.</p>}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>}
    <p className={styles.note}>El esfuerzo registrado es la media ponderada por duración cuando todas las salidas vinculadas tienen RPE. Registrar una actividad y completar una sesión siguen siendo acciones independientes.</p>
    {!admin && <Link className={styles.link} href="/importar-actividad">Importar una actividad y vincularla al plan →</Link>}
    <button className={styles.field} type="button" disabled={!loaded} onClick={() => { setResult(null); setReload(n => n + 1); }}>Actualizar comparación</button>
  </section>;
}
