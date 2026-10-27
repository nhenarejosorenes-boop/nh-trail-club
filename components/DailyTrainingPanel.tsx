"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { athleteToday } from '@/lib/training-progress';
import { loadDailyTraining, sessionPlanHref, trailEntryHref, type DailyTraining } from '@/lib/daily-training';
import { categories } from '@/lib/training-builder';
import styles from './daily-training.module.css';

const label = (date: string) => new Date(date + 'T12:00:00Z').toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long' });
export default function DailyTrainingPanel({ client, athlete, premium }: { client: SupabaseClient; athlete: string; premium: boolean }) {
  const [today, setToday] = useState(athleteToday);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<{ key: string; data: DailyTraining | null; error: boolean } | null>(null);
  const key = athlete + ':' + today + ':' + premium + ':' + reload;
  useEffect(() => {
    let active = true;
    loadDailyTraining(client, athlete, today, premium)
      .then(data => { if (active) setState({ key, data, error: false }); })
      .catch(() => { if (active) setState({ key, data: null, error: true }); });
    return () => { active = false; };
  }, [client, athlete, today, premium, key]);
  useEffect(() => {
    const resume = () => { if (document.visibilityState === 'visible') { setToday(athleteToday()); setReload(n => n + 1); } };
    document.addEventListener('visibilitychange', resume);
    return () => document.removeEventListener('visibilitychange', resume);
  }, []);
  const loaded = state?.key === key ? state : null;
  const data = loaded?.data;
  function refresh() { setToday(athleteToday()); setReload(n => n + 1); }
  return <section className={styles.panel} aria-label="Mi día y seguimiento">
    <div className={styles.header}><div><p className={styles.eyebrow}>TU DÍA EN NH</p><h2>Hoy, {label(today)}</h2></div><button type="button" onClick={refresh} disabled={!loaded}>Actualizar</button></div>
    {!loaded ? <p role="status">Comprobando tus sesiones y registros…</p> : loaded.error ? <div role="alert"><p>No se pudo cargar el resumen diario. Tus datos no se han modificado.</p><button type="button" onClick={refresh}>Reintentar resumen</button></div> : data && <DailyTrainingContent data={data} premium={premium}/>}
  </section>;
}

export function DailyTrainingContent({ data, premium }: { data: DailyTraining; premium: boolean }) {
  return <div className={styles.columns}>
      <div><h3>{premium ? 'Tu planificación' : 'Tus actividades'}</h3>
        {premium ? <>
          {!data.todaySessions.length && <p className={styles.note}>No hay sesiones programadas para hoy.</p>}
          {data.todaySessions.map(session => <article className={styles.session} key={session.id}><strong>{session.title}</strong><p>{Object.hasOwn(categories, session.category) ? categories[session.category as keyof typeof categories] : session.category} · {session.completed ? 'Completada' : 'Pendiente'}</p><Link className={styles.action} href={sessionPlanHref(session)}>Abrir sesión de hoy →</Link></article>)}
          {data.next ? <article className={styles.session}><p className={styles.eyebrow}>PRÓXIMA SESIÓN PENDIENTE · {label(data.next.session_date)}</p><strong>{data.next.title}</strong><p><Link className={styles.action} href={sessionPlanHref(data.next)}>Consultar indicaciones →</Link></p></article> : <p className={styles.note}>No hay próximas sesiones pendientes en los siguientes 13 días.</p>}
        </> : <p className={styles.note}>Puedes registrar tus salidas. La planificación individual está incluida en PLUS y PLUS Performance.</p>}
        <div className={styles.links}><Link className={styles.action} href="/importar-actividad">Importar actividad</Link><Link className={styles.action} href="/seguimiento-trail">Registrar salida</Link></div>
      </div>
      <div><h3>Completa tu seguimiento</h3><p className={styles.note}>Registros del {label(data.start)} al {label(data.end)}. Añadir el esfuerzo ayuda a calcular la carga; vincular una sesión es opcional.</p>
        <div className={styles.totals}><p><strong>{data.missingEffort.length}</strong> sin esfuerzo indicado</p><p><strong>{data.unlinked.length}</strong> sin sesión vinculada</p></div>
        {!data.toReview.length ? <p className={styles.note}>No hay registros con esfuerzo pendiente ni sin vínculo en este periodo.</p> : <>
          {data.toReview.slice(0, 5).map(entry => <article className={styles.review} key={entry.id}><div><strong>{label(entry.activity_date)} · {Number(entry.distance_km).toLocaleString('es-ES', { maximumFractionDigits: 2 })} km</strong><p>{[entry.effort === null ? 'Falta esfuerzo percibido' : '', !entry.linked_session_id ? 'Sin vínculo con el plan (opcional)' : ''].filter(Boolean).join(' · ')}</p></div><Link className={styles.action} href={trailEntryHref(entry)}>Revisar salida →</Link></article>)}
          {data.toReview.length > 5 && <p className={styles.note}>Mostrando las cinco salidas más recientes de {data.toReview.length} por revisar.</p>}
        </>}
        <Link className={styles.action} href="/seguimiento-trail">Abrir historial de salidas →</Link>
      </div>
    </div>;
}
