"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readStructure, stages, type TrainingSession } from '@/lib/training-builder';
import { emptyResults, resultDraft, resultExerciseName, resultKey, validateResults, type ExerciseResult, type ResultDraft, type SessionResult } from '@/lib/training-results';
import s from './training-builder.module.css';
type Props={client:SupabaseClient;session:TrainingSession;canWrite:boolean;onDirty:(dirty:boolean)=>void};
const columns='session_id,athlete_id,prescription,entries,effort,sensations,revision,updated_at';
export default function TrainingResults(p:Props){
  const [opened,setOpened]=useState(false);
  return <details className={s.block} onToggle={e=>{if(e.currentTarget.open)setOpened(true);}}><summary>{p.canWrite?'Registrar cargas y sensaciones':'Resultados del deportista'}</summary>{opened&&<ResultsForm {...p}/>}</details>;
}
function ResultsForm({client,session,canWrite,onDirty}:Props){
  const [saved,setSaved]=useState<SessionResult|null>(null);const [draft,setDraft]=useState<ResultDraft>(()=>emptyResults(session.structure));
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const writing=useRef(false);const active=useRef(true);
  const [error,setError]=useState('');const [message,setMessage]=useState('');const [reload,setReload]=useState(0);const [dirty,setDirty]=useState(false);
  useEffect(()=>{active.current=true;return()=>{active.current=false;onDirty(false);};},[session.id]);
  useEffect(()=>{let current=true;setLoading(true);setError('');Promise.resolve(client.from('training_session_results').select(columns).eq('session_id',session.id).maybeSingle()).then(({data,error:failure})=>{if(!current)return;if(failure){setError('No se pudieron cargar los resultados. Reintenta antes de registrar cambios.');return;}const row=data as SessionResult|null;setSaved(row);setDraft(row?resultDraft(row):emptyResults(session.structure));setDirty(false);onDirty(false);}).catch(()=>{if(current)setError('No se pudieron cargar los resultados. Comprueba la conexión.');}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};},[session.id,reload,client]);
  const prescription=saved?saved.prescription:session.structure;const plan=readStructure(prescription);
  const changed=!!saved&&JSON.stringify(saved.prescription)!==JSON.stringify(session.structure);
  function update(next:ResultDraft){setDraft(next);setDirty(true);onDirty(true);setMessage('');}
  function exercise(index:number,patch:Partial<ExerciseResult>){update({...draft,entries:draft.entries.map((e,n)=>n===index?{...e,...patch}:e)});}
  function refresh(){if(dirty&&!window.confirm('¿Descartar tus cambios y cargar los resultados guardados?'))return;setReload(v=>v+1);}
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!canWrite||writing.current||loading)return;
    const invalid=validateResults(draft,prescription);if(invalid){setError(invalid);return;}
    writing.current=true;setBusy(true);setError('');setMessage('');
    try{
      const record={entries:draft.entries,effort:draft.effort===''?null:Number(draft.effort),sensations:draft.sensations.trim()};
      const response=saved?await client.from('training_session_results').update(record).eq('session_id',session.id).eq('athlete_id',session.athlete_id).eq('revision',saved.revision).select(columns).maybeSingle():await client.from('training_session_results').insert({...record,session_id:session.id,athlete_id:session.athlete_id}).select(columns).single();
      if(!active.current)return;
      if(response.error||!response.data){setError(response.error?.code==='23505'||!response.error?'Los resultados cambiaron en otra ventana. Carga la versión guardada antes de continuar.':'No se pudo confirmar el guardado. Tu borrador se conserva; carga la versión guardada para comprobarlo.');return;}
      const row=response.data as SessionResult;setSaved(row);setDraft(resultDraft(row));setDirty(false);onDirty(false);setMessage('Resultados guardados. Tu entrenador ya puede consultarlos.');
    }catch{if(active.current)setError('No se pudo confirmar el guardado. Tu borrador se conserva; comprueba la versión guardada antes de repetir.');}
    finally{writing.current=false;if(active.current)setBusy(false);}
  }
  if(loading)return <p role="status">Cargando resultados…</p>;
  if(error&&!saved&&!dirty)return <div><p role="alert" className={s.alert}>{error}</p><button type="button" className={s.button} onClick={refresh}>Reintentar carga</button></div>;
  if(!canWrite&&!saved)return <p className={s.muted}>El deportista todavía no ha registrado resultados para esta sesión.</p>;
  return <form onSubmit={save} noValidate aria-busy={busy}>
    {changed&&<p className={s.muted}>El entrenamiento se modificó después de registrar resultados. Estos datos conservan la versión realizada.</p>}
    <p className={s.muted}>{canWrite?'Anota lo que has realizado. Guardar resultados no marca automáticamente toda la sesión como completada.':'Datos registrados por el deportista. Las cargas prescritas se mantienen en las fichas del entrenamiento.'}</p>
    <fieldset disabled={!canWrite||busy} style={{border:0,padding:0,minWidth:0}}>
      {draft.entries.map((entry,index)=><section key={resultKey(entry.stage,entry.id)} className={s.exercise}><p className={s.eyebrow}>{stages[entry.stage]}</p><h4>{resultExerciseName(plan,entry)}</h4>
        <label className={s.check}><input type="checkbox" checked={entry.completed} onChange={e=>exercise(index,{completed:e.target.checked})}/> {session.category==="trail"?"Tramo realizado":"Ejercicio realizado"}</label>
        <div className={s.grid}><label className={s.label}>{session.category==="trail"?"Repeticiones del tramo realizadas":"Series realizadas"}<input className={s.field} type="number" min="0" max="30" step="1" value={entry.sets} onChange={e=>exercise(index,{sets:e.target.value})}/></label><label className={s.label}>{session.category==="trail"?"Tiempo o distancia realizados":"Repeticiones o tiempo realizados"}<input className={s.field} maxLength={40} placeholder="8 por lado / 30 s" value={entry.reps} onChange={e=>exercise(index,{reps:e.target.value})}/></label>{session.category!=="trail"&&<label className={s.label}>Carga utilizada (kg)<input className={s.field} type="number" min="0" max="1000" step="0.1" value={entry.weight} onChange={e=>exercise(index,{weight:e.target.value})}/></label>}</div>
        <label className={s.label}>Observaciones<textarea className={s.field} maxLength={500} rows={2} value={entry.notes} onChange={e=>exercise(index,{notes:e.target.value})}/></label>
      </section>)}
      <div className={s.grid}><label className={s.label}>Esfuerzo global (1–10, opcional)<input className={s.field} type="number" min="1" max="10" step="1" value={draft.effort} onChange={e=>update({...draft,effort:e.target.value})}/></label><div><p className={s.muted}>1 = muy suave · 10 = máximo esfuerzo</p></div></div>
      <label className={s.label}>Sensaciones al finalizar<textarea className={s.field} maxLength={2000} rows={3} placeholder="Cómo te has encontrado durante el entrenamiento" value={draft.sensations} onChange={e=>update({...draft,sensations:e.target.value})}/></label>
    </fieldset>
    {error&&<p role="alert" className={s.alert}>{error}</p>}{message&&<p role="status" className={s.status}>{message}</p>}
    {saved&&<p className={s.muted}>Último registro: {new Date(saved.updated_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid'})} · {draft.entries.filter(e=>e.completed).length}/{draft.entries.length} ejercicios realizados{dirty?' · Cambios sin guardar':''}</p>}
    <div className={s.bar}>{canWrite&&<button type="submit" className={s.button} disabled={busy}>{busy?'Guardando…':'Guardar resultados'}</button>}<button type="button" className={`${s.button} ${s.secondary}`} disabled={busy} onClick={refresh}>Cargar versión guardada</button></div>
  </form>;
}
