"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {createClient} from '@supabase/supabase-js';
import type {ActivityFile} from '@/lib/activity-import';
import {activityKey,importedDraft,likelySameActivity,sha256} from '@/lib/activity-import-review';
import {trailRecord,type TrailDraft} from '@/lib/trail-log';
import {athleteToday,type TrailEntry} from '@/lib/training-progress';
import styles from '@/components/athlete-panels.module.css';

const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
const button={background:'#f28c28',color:'#111',border:0,borderRadius:8,padding:'12px 18px',fontWeight:700,cursor:'pointer'};
type Plan={id:string;session_date:string;title:string};
export default function ImportActivity(){
  const [uid,setUid]=useState(''),[file,setFile]=useState<ActivityFile|null>(null),[hash,setHash]=useState(''),[index,setIndex]=useState(0);
  const [draft,setDraft]=useState<TrailDraft|null>(null),[plans,setPlans]=useState<Plan[]>([]),[entries,setEntries]=useState<TrailEntry[]>([]),[linked,setLinked]=useState('');
  const [busy,setBusy]=useState(false),[checking,setChecking]=useState(false),[ready,setReady]=useState(false),[ack,setAck]=useState(false),[confirmed,setConfirmed]=useState(false);
  const [error,setError]=useState(''),[checkError,setCheckError]=useState(''),[message,setMessage]=useState(''),[reload,setReload]=useState(0),[saved,setSaved]=useState<Record<number,string>>({});
  const lock=useRef(false),worker=useRef<Worker|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{
    let active=true;
    supabase.auth.getUser().then(({data,error})=>{if(!active)return;if(error||!data.user){window.location.replace('/login');return;}setUid(data.user.id);}).catch(()=>{if(active)setError('No se pudo comprobar tu sesión. Recarga la página.');});
    return()=>{active=false;worker.current?.terminate();if(timer.current)clearTimeout(timer.current);};
  },[]);
  useEffect(()=>{
    if(!uid||!draft?.date)return;
    let active=true;setChecking(true);setReady(false);setCheckError('');setAck(false);setLinked('');
    (async()=>{
      // Fetch the complete matching day; pagination prevents silently missing duplicates.
      const rows:TrailEntry[]=[];
      for(let from=0;;from+=500){const r=await supabase.from('trail_activity_log').select('id,activity_date,distance_km,elevation_m,duration_minutes,effort,feelings').eq('athlete_id',uid).eq('activity_date',draft.date).order('id').range(from,from+499);if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<500)break;}
      const start=new Date(draft.date+'T12:00:00Z'),end=new Date(start);start.setUTCDate(start.getUTCDate()-7);end.setUTCDate(end.getUTCDate()+7);
      const plan:Plan[]=[];
      for(let from=0;;from+=500){const r=await supabase.from('weekly_training_plan').select('id,session_date,title').eq('athlete_id',uid).eq('category','trail').gte('session_date',start.toISOString().slice(0,10)).lte('session_date',end.toISOString().slice(0,10)).order('session_date').order('id').range(from,from+499);if(r.error)throw r.error;plan.push(...r.data);if(r.data.length<500)break;}
      if(active){setEntries(rows);setPlans(plan);setReady(true);}
    })().catch(()=>{if(active)setCheckError('No se pudo comprobar el historial y el plan. Reintenta antes de guardar.');}).finally(()=>{if(active)setChecking(false);});
    return()=>{active=false;};
  },[uid,draft?.date,reload]);
  async function read(selected:File|undefined){
    if(!selected||lock.current)return;
    setError('');setMessage('');setFile(null);setDraft(null);setSaved({});setConfirmed(false);setReady(false);
    if(!/\.(fit|tcx|gpx)$/i.test(selected.name)||!selected.size||selected.size>20*1024*1024){setError('Selecciona un FIT, TCX o GPX sin comprimir de hasta 20 MB.');return;}
    lock.current=true;setBusy(true);
    try{
      const buffer=await selected.arrayBuffer(),fileHash=await sha256(buffer);setHash(fileHash);
      const result=await new Promise<ActivityFile>((resolve,reject)=>{
        const w=new Worker(new URL('../../lib/activity-import.worker.ts',import.meta.url),{type:'module'});worker.current=w;
        const finish=()=>{w.terminate();worker.current=null;if(timer.current)clearTimeout(timer.current);};
        timer.current=setTimeout(()=>{finish();reject(new Error('El archivo tarda demasiado en procesarse. Prueba con un archivo de una sola actividad.'));},20000);
        w.onmessage=e=>{finish();if(e.data.error)reject(new Error(e.data.error));else resolve(e.data.result);};
        w.onerror=()=>{finish();reject(new Error('No se pudo leer el archivo. Comprueba su formato y vuelve a intentarlo.'));};
        w.postMessage({name:selected.name,buffer},[buffer]);
      });
      const keys=await Promise.all(result.activities.map(a=>activityKey(a.startedAt)));
      const existing=await supabase.from('trail_activity_log').select('file_hash,import_index,import_key').eq('athlete_id',uid).eq('source','file').or('file_hash.eq.'+fileHash+',import_key.in.('+keys.join(',')+')');
      if(existing.error)throw new Error('El archivo se ha leído, pero no se pudo comprobar si ya estaba importado. Vuelve a seleccionarlo para reintentar.');
      const known:Record<number,string>={};
      result.activities.forEach((a,i)=>{if(existing.data.some(row=>(row.file_hash===fileHash&&row.import_index===a.index)||row.import_key===keys[i]))known[i]='Esta actividad ya estaba importada. Se conserva el registro existente con sus correcciones.';});
      setSaved(known);setFile(result);setIndex(0);setDraft(importedDraft(result.activities[0]));
    }catch(e){setError(e instanceof Error?e.message:'No se pudo leer el archivo.');}
    finally{lock.current=false;setBusy(false);}
  }
  function choose(i:number){if(!file||lock.current)return;setIndex(i);setDraft(importedDraft(file.activities[i]));setConfirmed(false);setAck(false);setLinked('');setError('');setMessage('');setReload(n=>n+1);}
  function change(key:keyof TrailDraft,value:string){setDraft(d=>d?{...d,[key]:value}:d);setAck(false);}
  const current=file?.activities[index];
  let possible:TrailEntry[]=[];
  if(draft){try{const record=trailRecord(draft,athleteToday());possible=entries.filter(e=>likelySameActivity(e,record));}catch{ /* Validation appears on save. */ }}
  async function save(event:FormEvent){
    event.preventDefault();if(lock.current||!ready||!uid||!file||!current||!draft||saved[index])return;
    setError('');setMessage('');
    try{
      const record=trailRecord(draft,athleteToday());
      if(!confirmed)throw new Error('Confirma que corresponde a una actividad realizada de carrera o senderismo.');
      if(possible.length&&!ack)throw new Error('Revisa la posible salida duplicada y confirma antes de guardar.');
      lock.current=true;setBusy(true);
      const r=await supabase.rpc('import_trail_activity',{p_record:{...record,file_hash:hash,import_key:await activityKey(current.startedAt),import_index:current.index,file_format:file.format,started_at:current.startedAt,linked_session_id:linked||null,import_summary:{title:current.title,duration_seconds:current.durationSeconds,average_heart_rate:current.averageHeartRate,max_heart_rate:current.maxHeartRate}}});
      if(r.error)throw new Error('No se pudo confirmar el guardado. Puedes reintentar: el mismo archivo no se guardará dos veces.');
      if(!r.data?.id)throw new Error('No se pudo confirmar la importación. Reintenta.');
      const result=r.data.created?'Salida importada. Ya se incluye en tu seguimiento.':'Esta actividad ya estaba importada. Se conserva el registro existente con sus correcciones.';
      setSaved(s=>({...s,[index]:result}));setMessage(result);
    }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}finally{lock.current=false;setBusy(false);}
  }
  return <main className={styles.page}><div className={styles.inner}>
    <p className={styles.brand}>NH TRAINING CONCEPT</p><h1>Importar una actividad</h1>
    <p className={styles.intro}>Añade una salida realizada desde un archivo de Garmin u otro dispositivo. Revisa los datos antes de guardarlos en tu seguimiento de trail.</p>
    <nav className={styles.nav}><Link className={styles.link} href="/seguimiento-trail">Mis salidas</Link><Link className={styles.link} href="/entrenamientos/trail">Plan de trail</Link><Link className={styles.link} href="/progreso">Mi progreso</Link></nav>
    <section className={styles.panel}><h2>1. Selecciona el archivo</h2>
      <label>Archivo FIT, TCX o GPX (máximo 20 MB)<input className={styles.field} type="file" accept=".fit,.tcx,.gpx" disabled={!uid||busy} onChange={e=>{void read(e.target.files?.[0]);e.target.value='';}} /></label>
      <p className={styles.note}>Desde la actividad de Garmin Connect puedes exportar el archivo original. Si se descarga un ZIP, descomprímelo primero. Se procesa en tu navegador: guardamos el resumen confirmado, sin subir el archivo ni su recorrido GPS.</p>
      {busy&&!file&&<p role="status">Leyendo y comprobando el archivo…</p>}
    </section>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {message&&<p className={styles.done} role="status">{message} <Link className={styles.link} href="/seguimiento-trail">Ver historial</Link></p>}
    {file&&current&&draft&&<section className={styles.panel}><h2>2. Revisa y confirma</h2>
      {file.activities.length>1&&<label>Actividad del archivo<select className={styles.field} disabled={busy} value={index} onChange={e=>choose(Number(e.target.value))}>{file.activities.map((a,i)=><option key={a.index} value={i}>{i+1}. {a.date} · {a.title}{saved[i]?' · Revisada':''}</option>)}</select></label>}
      <h3>{current.title}</h3><p className={styles.note}>Inicio: {new Date(current.startedAt).toLocaleString('es-ES',{timeZone:'Europe/Madrid'})} (hora peninsular) · {file.format.toUpperCase()}</p>
      {current.warnings.length>0&&<ul className={styles.note}>{current.warnings.map(w=><li key={w}>{w}</li>)}</ul>}
      <p className={styles.note}>El tiempo se guarda redondeado a minutos. Original: {Math.round(current.durationSeconds)} segundos.{current.averageHeartRate!==null?' FC media: '+current.averageHeartRate+' lpm.':''}{current.maxHeartRate!==null?' FC máxima: '+current.maxHeartRate+' lpm.':''}</p>
      {saved[index]?<p className={styles.done}>{saved[index]}</p>:<form onSubmit={save}><fieldset disabled={busy||checking} style={{border:0,padding:0,margin:0}}>
        <div className={styles.cards}>
          <label>Fecha de la salida<input className={styles.field} type="date" min="2000-01-01" max={athleteToday()} value={draft.date} onChange={e=>change('date',e.target.value)} required/></label>
          <label>Distancia (km)<input className={styles.field} type="number" min="0" max="500" step="0.01" value={draft.distance} onChange={e=>change('distance',e.target.value)} required/></label>
          <label>Desnivel positivo (m)<input className={styles.field} type="number" min="0" max="30000" step="1" value={draft.elevation} onChange={e=>change('elevation',e.target.value)} required/></label>
          <label>Duración (minutos)<input className={styles.field} type="number" min="1" max="10080" step="1" value={draft.duration} onChange={e=>change('duration',e.target.value)} required/></label>
          <label>Esfuerzo percibido (RPE)<select className={styles.field} value={draft.effort} onChange={e=>change('effort',e.target.value)}><option value="">Sin indicar</option>{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1}/10</option>)}</select></label>
          <label>Vincular a una sesión del plan<select className={styles.field} value={linked} onChange={e=>setLinked(e.target.value)}><option value="">Sin vincular</option>{plans.map(p=><option key={p.id} value={p.id}>{p.session_date} · {p.title}</option>)}</select></label>
        </div>
        <p className={styles.note}>Se muestran tus sesiones de trail de los siete días anteriores y posteriores. Vincular la salida no marca la sesión como completada. El RPE lo indicas tú; no se deduce de la frecuencia cardiaca.</p>
        <label>Sensaciones<textarea className={styles.field} style={{width:'100%',boxSizing:'border-box'}} rows={3} maxLength={1000} value={draft.feelings} onChange={e=>change('feelings',e.target.value)}/></label>
        {possible.length>0&&<div><p className={styles.pending}>Hay {possible.length} salida(s) con fecha, distancia y duración similares. Revisa el historial antes de añadir otra.</p><label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/> He revisado el historial y corresponde a otra salida.</label></div>}
        <p><label><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Confirmo que es una actividad realizada de carrera o senderismo y que los datos son correctos.</label></p>
        <button style={button} disabled={!ready||busy||checking||(possible.length>0&&!ack)}>{busy?'Guardando…':'Importar salida'}</button>
      </fieldset></form>}
      {checking&&<p role="status">Comprobando historial y sesiones…</p>}
      {checkError&&<p className={styles.error} role="alert">{checkError} <button type="button" className={styles.field} disabled={busy} onClick={()=>setReload(n=>n+1)}>Reintentar comprobación</button></p>}
    </section>}
    <p className={styles.note}>La sincronización automática con Garmin y el envío de entrenamientos al reloj son los siguientes pasos. Esta importación no conecta tu cuenta de Garmin.</p>
  </div></main>;
}
