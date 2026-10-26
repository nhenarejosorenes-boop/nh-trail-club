"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import MembershipNotice from "@/components/MembershipNotice";
import { loadSectionWeek, sectionSessions, isCategory } from "@/lib/training-sections";
import TrainingResults from "./TrainingResults";
import { videoLink } from "@/lib/training-video";
import TrainingComposer from "./TrainingComposer";
import TrainingSessionContent from "./TrainingSessionContent";
import { loadMembershipAccess } from "@/lib/membership-client";
import type { MembershipAccess } from "@/lib/membership-model";
import { loadCoachAthletes, plannerContext } from "@/lib/coach-tracking";
import { emptyDraft, copyDraft, draftFromSession, plainPrescription, readStructure, starterTemplates, validateDraft, normaliseDraft, type Exercise, type LibraryExercise, type Category, type TrainingDraft, type TrainingSession, type TrainingTemplate } from "@/lib/training-builder";
import s from "./training-builder.module.css";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
function dateString(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function shift(value:string,days:number){const d=new Date(value+"T12:00:00");d.setDate(d.getDate()+days);return dateString(d);}
function monday(d:Date){const x=new Date(d);x.setDate(x.getDate()-(x.getDay()+6)%7);return dateString(x);}
async function loadTemplates(){
  const rows:TrainingTemplate[]=[];
  for(let from=0;;from+=500){
    const {data,error}=await supabase.from("training_templates").select("id,name,category,title,structure").order("name").order("id").range(from,from+499);
    if(error)throw error;rows.push(...(data??[]) as TrainingTemplate[]);if(!data||data.length<500)return rows;
  }
}
export default function TrainingPlan({categoryFilter,showEditor=false}:{categoryFilter?:"fuerza"|"trail";showEditor?:boolean}){
  const [userId,setUserId]=useState("");const [admin,setAdmin]=useState(false);
  const [athletes,setAthletes]=useState<{user_id:string|null;nombre:string}[]>([]);
  const [selected,setSelected]=useState("");const [week,setWeek]=useState(()=>monday(new Date()));const [day,setDay]=useState("");
  const [sessions,setSessions]=useState<TrainingSession[]>([]);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
  const busyRef=useRef(false);const templateBusyRef=useRef(false);
  const [error,setError]=useState("");const [saveError,setSaveError]=useState("");const [message,setMessage]=useState("");
  const [membership,setMembership]=useState<MembershipAccess|null>(null);const [accessError,setAccessError]=useState(false);
  const [draft,setDraft]=useState<TrainingDraft>(()=>emptyDraft(categoryFilter));const [date,setDate]=useState(()=>dateString(new Date()));
  const [creationCategory,setCreationCategory]=useState<Category|undefined>(categoryFilter);const [categoryChosen,setCategoryChosen]=useState(Boolean(categoryFilter));
  const [editingId,setEditingId]=useState<string|null>(null);const [templates,setTemplates]=useState<TrainingTemplate[]>([]);
  const [templateError,setTemplateError]=useState("");const [templateBusy,setTemplateBusy]=useState(false);
  const [reload,setReload]=useState(0);
  const [library,setLibrary]=useState<LibraryExercise[]>([]);const [libraryBusy,setLibraryBusy]=useState(false);const [libraryNotice,setLibraryNotice]=useState("");const libraryWriting=useRef(false);
  const [resultDirty,setResultDirty]=useState<Record<string,boolean>>({});
  const dirtyResults=Object.values(resultDirty).some(Boolean);
  useEffect(()=>{if(!dirtyResults)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[dirtyResults]);
  useEffect(()=>{if(!admin||!showEditor)return;let active=true;(async()=>{try{const all:LibraryExercise[]=[];for(let from=0;;from+=500){const {data,error}=await supabase.from("training_exercise_library").select("id,name,category,video_url,notes").order("name").order("id").range(from,from+499);if(error)throw error;all.push(...(data??[]) as LibraryExercise[]);if(!data||data.length<500)break;}if(active)setLibrary(all);}catch{if(active)setLibraryNotice("No se pudo cargar la biblioteca. Puedes escribir los ejercicios manualmente.");}})();return()=>{active=false;};},[admin,showEditor]);
  async function saveLibrary(exercise:Exercise){
    if(!admin||busyRef.current||templateBusyRef.current||libraryWriting.current)return;const url=videoLink(exercise.videoUrl??"");
    if(!categoryChosen){setLibraryNotice("Selecciona el tipo de entrenamiento antes de guardar el ejercicio.");return;}
    if(!exercise.name.trim()||exercise.name.trim().length>120||exercise.notes.length>1000||url===null){setLibraryNotice("Escribe el nombre y utiliza un enlace HTTPS de YouTube o Vimeo, si añades vídeo.");return;}
    libraryWriting.current=true;setLibraryBusy(true);setLibraryNotice("");try{const {data,error}=await supabase.from("training_exercise_library").insert({name:exercise.name.trim(),category:draft.category,notes:exercise.notes,video_url:url}).select("id,name,category,video_url,notes").single();if(error||!data){setLibraryNotice(error?.code==="23505"?"Ya existe un ejercicio con ese nombre y tipo en la biblioteca.":"No se pudo confirmar el guardado en la biblioteca. Tu ejercicio sigue en el borrador.");return;}setLibrary(rows=>[...rows,data as LibraryExercise].sort((a,b)=>a.name.localeCompare(b.name)));setLibraryNotice("Ejercicio guardado en la biblioteca del equipo.");}catch{setLibraryNotice("No se pudo confirmar el guardado en la biblioteca. Comprueba la conexión.");}finally{libraryWriting.current=false;setLibraryBusy(false);}
  }
  useEffect(()=>{
    let active=true;
    (async()=>{try{
      const auth=await supabase.auth.getUser();if(!active)return;
      if(auth.error||!auth.data.user){window.location.replace("/login");return;}
      const uid=auth.data.user.id;setUserId(uid);const access=await loadMembershipAccess(supabase,uid);if(!active)return;setMembership(access);
      if(!access.premium){setLoading(false);return;}
      let target=uid;
      if(access.state==="admin"){
        setAdmin(true);const linked=(await loadCoachAthletes(supabase)).filter(a=>a.user_id!==null);if(!active)return;setAthletes(linked);
        const params=new URLSearchParams(window.location.search);const requestedType=params.get("type");if(showEditor&&isCategory(requestedType)){setCreationCategory(requestedType);setCategoryChosen(true);setDraft(emptyDraft(requestedType));}const context=plannerContext(linked,uid,params.get("athlete"),params.get("date"));target=context.athleteId;
        if(context.week){setWeek(context.week);setDate(context.week);}
      }
      setSelected(target);
    }catch{if(active){setAccessError(true);setLoading(false);}}})();return()=>{active=false;};
  },[]);
  useEffect(()=>{
    if(!admin||!showEditor)return;let active=true;
    loadTemplates().then(rows=>{if(active)setTemplates(rows);}).catch(()=>{if(active)setTemplateError("Las plantillas del equipo no se pudieron cargar. Las plantillas de inicio siguen disponibles.");});
    return()=>{active=false;};
  },[admin,showEditor]);
  useEffect(()=>{
    if(!selected)return;let active=true;setLoading(true);setError("");
    loadSectionWeek(supabase,selected,week,categoryFilter).then(rows=>{if(active)setSessions(rows);}).catch(()=>{if(active){setSessions([]);setError("No se pudo cargar la planificación. Reintenta sin perder tu borrador.");}}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[selected,week,reload,categoryFilter]);
  function clearEditor(){setEditingId(null);setDraft(emptyDraft(creationCategory));setCategoryChosen(Boolean(creationCategory));setSaveError("");setTemplateError("");}
  function scrollEditor(){document.getElementById("session-editor")?.scrollIntoView({behavior:"smooth",block:"start"});}
  function editSession(session:TrainingSession,duplicate=false){
    if(dirtyResults){setMessage("Guarda primero los resultados pendientes antes de editar o duplicar entrenamientos.");return;}
    setCategoryChosen(true);setDraft(duplicate?copyDraft(draftFromSession(session)):draftFromSession(session));setEditingId(duplicate?null:session.id);setDate(duplicate?(day||week):session.session_date);setSaveError("");setMessage(duplicate?"Copia preparada. Elige la fecha y pulsa Guardar sesión.":"");scrollEditor();
  }
  function useTemplate(id:string){
    const starter=starterTemplates.find(t=>`starter:${t.id}`===id);const saved=templates.find(t=>t.id===id);
    const value=starter?.draft ?? (saved&&readStructure(saved.structure)?{title:saved.title,category:saved.category,structure:readStructure(saved.structure)!}:null);
    if(!value){setTemplateError("No se pudo abrir esta plantilla.");return;}
    setCategoryChosen(true);setDraft(copyDraft(value));setEditingId(null);setSaveError("");setTemplateError("");setMessage("Plantilla cargada como nueva sesión. Revisa el contenido y la fecha antes de guardar.");
  }
  async function saveTemplate(name:string){
    if(!admin||busyRef.current||templateBusyRef.current||libraryWriting.current)return false;
    if(!categoryChosen){setTemplateError("Selecciona el tipo de entrenamiento.");return false;}
    const invalid=validateDraft(draft);if(!name.trim()||[...name.trim()].length>100||invalid){setTemplateError(invalid||"Escribe un nombre de plantilla de entre 1 y 100 caracteres.");return false;}
    templateBusyRef.current=true;setTemplateBusy(true);setTemplateError("");
    try{
      const {data,error:failure}=await supabase.from("training_templates").insert({name:name.trim(),category:draft.category,title:draft.title.trim(),structure:normaliseDraft(draft).structure}).select("id,name,category,title,structure").single();
      if(failure||!data)throw failure;
      setTemplates(rows=>[...rows,data as TrainingTemplate].sort((a,b)=>a.name.localeCompare(b.name)));setMessage("Plantilla guardada para el equipo. La sesión del cliente se programa con Guardar sesión.");return true;
    }catch{setTemplateError("No se pudo confirmar el guardado de la plantilla. Tu borrador se conserva; comprueba las plantillas antes de repetir.");return false;}
    finally{templateBusyRef.current=false;setTemplateBusy(false);}
  }
  async function add(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!admin||!showEditor||!selected||busyRef.current||templateBusyRef.current||libraryWriting.current)return;
    if(dirtyResults){setSaveError("Guarda primero los resultados pendientes antes de modificar la planificación.");return;}
    if(!categoryChosen){setSaveError("Selecciona el tipo: Fuerza, Trail, Movilidad o Descanso.");return;}
    setMessage("");const invalid=validateDraft(draft);if(invalid){setSaveError(invalid);return;}
    if(!date||date<week||date>shift(week,6)||!event.currentTarget.checkValidity()){setSaveError("Revisa la fecha de la semana visible y los valores de los ejercicios.");event.currentTarget.reportValidity();return;}
    busyRef.current=true;setBusy(true);setSaveError("");
    try{
      const record={session_date:date,category:draft.category,title:draft.title.trim(),details:plainPrescription(normaliseDraft(draft).structure),structure:normaliseDraft(draft).structure};
      const result=editingId?await supabase.from("weekly_training_plan").update(record).eq("id",editingId).eq("athlete_id",selected).select("id"):await supabase.from("weekly_training_plan").insert({...record,athlete_id:selected}).select("id");
      if(result.error){setSaveError("No se pudo guardar: "+result.error.message);return;}if(!result.data?.length){setSaveError("La sesión no se guardó. Comprueba que tienes permisos para este deportista.");return;}
      setMessage(editingId?"Sesión actualizada.":"Sesión programada.");clearEditor();setDay("");setReload(v=>v+1);
    }catch{setSaveError("No se pudo confirmar el guardado. Tu borrador se conserva. Revisa la planificación antes de volver a guardar.");}
    finally{busyRef.current=false;setBusy(false);}
  }
  async function toggle(session:TrainingSession){
    if(dirtyResults){setMessage("Guarda primero los resultados pendientes antes de cambiar el estado de la sesión.");return;}
    if(busyRef.current||templateBusyRef.current||loading||session.athlete_id!==selected||(!admin&&session.athlete_id!==userId))return;
    busyRef.current=true;setBusy(true);setError("");try{const {error:failure}=await supabase.rpc("mark_training_completed",{p_id:session.id,p_completed:!session.completed});if(failure)throw failure;setReload(v=>v+1);}catch{setError("No se pudo confirmar el estado de la sesión. Reintenta la carga para comprobarlo.");}finally{busyRef.current=false;setBusy(false);}
  }
  async function remove(session:TrainingSession){
    if(dirtyResults){setMessage("Guarda primero los resultados pendientes antes de eliminar sesiones.");return;}
    if(!admin||busyRef.current||templateBusyRef.current||loading||session.athlete_id!==selected||!window.confirm("¿Eliminar esta sesión?"))return;
    busyRef.current=true;setBusy(true);try{const {error:failure}=await supabase.from("weekly_training_plan").delete().eq("id",session.id).eq("athlete_id",selected);if(failure)throw failure;if(editingId===session.id)clearEditor();setMessage("Planificación actualizada.");setReload(v=>v+1);}catch{setError("No se pudo confirmar la eliminación. Reintenta la carga para comprobarlo.");}finally{busyRef.current=false;setBusy(false);}
  }
  function discard(){return !(dirtyResults||draft.title||draft.structure.notes||draft.structure.blocks.some(b=>b.items.length))||window.confirm("¿Salir y descartar los cambios sin guardar?");}
  function moveWeek(days:number){if(busyRef.current||templateBusyRef.current||!discard())return;const next=shift(week,days);setWeek(next);setDate(next);setDay("");setSessions([]);clearEditor();setMessage("");}
  const filtered=sectionSessions(sessions,categoryFilter);const visible=day?filtered.filter(x=>x.session_date===day):filtered;
  const locked=busy||templateBusy||libraryBusy;
  const heading=categoryFilter==="fuerza"?"Entrenamiento de fuerza":categoryFilter==="trail"?"Entrenamiento Trail Running":showEditor?"Planificación semanal":"Mis entrenamientos";
  if(loading&&!membership&&!accessError)return <main style={{padding:40,background:"#111",color:"white",minHeight:"100vh"}}><p role="status">Comprobando tu acceso…</p></main>;
  if(accessError||!membership?.premium)return <MembershipNotice access={membership} error={accessError}/>;
  return <main onClickCapture={e=>{const a=(e.target as HTMLElement).closest?.("a");if(a&&a.target!=="_blank"&&dirtyResults&&!window.confirm("¿Salir y descartar los resultados sin guardar?"))e.preventDefault();}} style={{minHeight:"100vh",background:"#111",color:"white",padding:"30px 14px",fontFamily:"Arial,sans-serif"}}><div className={s.shell}>
    <p className={s.eyebrow}>NH TRAINING CONCEPT</p><Link href="/dashboard" style={{color:"#ffad63"}}>← Volver a mi panel</Link><h1>{heading}</h1><p className={s.muted}>{categoryFilter==="fuerza"?"Solo sesiones clasificadas como fuerza.":categoryFilter==="trail"?"Solo sesiones de carrera clasificadas como trail.":"Todas las modalidades: fuerza, trail, movilidad y descanso."}</p>
    <nav className={s.bar} aria-label="Tipos de entrenamiento">{[{href:"/entrenamientos",label:"Secciones",active:!categoryFilter&&!showEditor},{href:"/entrenamientos/fuerza",label:"Fuerza",active:categoryFilter==="fuerza"},{href:"/entrenamientos/trail",label:"Trail",active:categoryFilter==="trail"},{href:"/entrenamientos/plan",label:"Planificación semanal",active:showEditor}].map(x=><Link className={`${s.button} ${x.active?"":s.secondary}`} aria-current={x.active?"page":undefined} key={x.href} href={x.href}>{x.label}</Link>)}</nav>
    {admin&&<label className={s.label}>Deportista<select className={s.field} value={selected} disabled={locked} onChange={e=>{if(e.target.value===selected||!discard())return;setSelected(e.target.value);setSessions([]);clearEditor();setMessage("");}}><option value={userId}>Mi planificación</option>{athletes.filter(a=>a.user_id&&a.user_id!==userId).map(a=><option key={a.user_id!} value={a.user_id!}>{a.nombre}</option>)}</select></label>}
    <div className={s.bar}><button className={`${s.button} ${s.secondary}`} disabled={locked} onClick={()=>moveWeek(-7)}>← Anterior</button><strong>{new Date(week+"T12:00:00").toLocaleDateString("es-ES")} — {new Date(shift(week,6)+"T12:00:00").toLocaleDateString("es-ES")}</strong><button className={`${s.button} ${s.secondary}`} disabled={locked} onClick={()=>moveWeek(7)}>Siguiente →</button></div>
    <nav className={s.week} aria-label="Días de la semana">{Array.from({length:7},(_,n)=>{const value=shift(week,n),d=new Date(value+"T12:00:00"),count=filtered.filter(x=>x.session_date===value).length;return <button key={value} className={`${s.day} ${day===value?s.active:""}`} aria-pressed={day===value} aria-label={`${d.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}: ${count} sesiones`} disabled={loading} onClick={()=>{if(dirtyResults&&!window.confirm("¿Cambiar de día y descartar los resultados sin guardar?"))return;setDay(v=>v===value?"":value);}}><span>{d.toLocaleDateString("es-ES",{weekday:"short"})}</span><strong>{d.getDate()}</strong><small>{loading?"…":count?`${count} sesión${count===1?"":"es"}`:"Sin sesión"}</small></button>;})}</nav>
    {day&&<button className={`${s.button} ${s.secondary}`} onClick={()=>{if(dirtyResults&&!window.confirm("¿Cambiar de vista y descartar los resultados sin guardar?"))return;setDay("");}}>Ver toda la semana</button>}
    {!loading&&!error&&<div className={`${s.panel} ${s.summary}`} aria-label="Resumen semanal"><span><strong>{filtered.length}</strong> programadas</span><span><strong>{filtered.filter(x=>x.completed).length}</strong> completadas</span><span><strong>{filtered.filter(x=>!x.completed).length}</strong> pendientes</span></div>}
    {error&&<div role="alert" className={s.panel}><p className={s.alert}>{error}</p><button className={s.button} disabled={locked} onClick={()=>setReload(v=>v+1)}>Reintentar carga</button></div>}{message&&<p className={s.status} role="status">{message}</p>}
    {loading?<p role="status">Cargando planificación…</p>:!error&&visible.length===0?<section className={s.panel}><h2>{day?"Sin sesiones para este día":"Sin sesiones programadas esta semana"}</h2><p className={s.muted}>{admin?"Crea un entrenamiento desde una plantilla o diseña los bloques para este deportista.":"Aquí verás las sesiones que programe tu entrenador. Puedes consultar otras semanas."}</p>{admin&&!showEditor&&<Link className={s.button} href={categoryFilter?`/entrenamientos/plan?type=${categoryFilter}`:"/entrenamientos/plan"}>Crear entrenamiento →</Link>}</section>:!error&&visible.map(session=><article className={`${s.panel} ${session.completed?s.completed:""}`} key={session.id}>
      <div className={s.bar}><strong>{new Date(session.session_date+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</strong><span className={session.completed?s.status:s.muted}>{session.completed?"✓ Completada":"Pendiente"}</span></div>
      <TrainingSessionContent {...session}/><TrainingResults client={supabase} session={session} canWrite={session.athlete_id===userId} onDirty={dirty=>setResultDirty(previous=>previous[session.id]===dirty?previous:{...previous,[session.id]:dirty})}/><div className={s.actions}><div className={s.bar}><button className={`${s.button} ${session.completed?s.secondary:""}`} aria-pressed={session.completed} disabled={locked} onClick={()=>void toggle(session)}>{session.completed?"Marcar como pendiente":"Marcar sesión completada"}</button><Link className={`${s.button} ${s.secondary}`} href={"/mensajes?"+new URLSearchParams({athlete:session.athlete_id,training:session.id}).toString()}>{admin?"Mensaje sobre esta sesión":"Consultar al entrenador"}</Link></div>
      {admin&&showEditor&&<div className={s.bar}><button className={`${s.button} ${s.secondary}`} disabled={locked} onClick={()=>{if(discard())editSession(session);}}>Editar</button><button className={`${s.button} ${s.secondary}`} disabled={locked} onClick={()=>{if(discard())editSession(session,true);}}>Duplicar sesión</button><button className={`${s.button} ${s.danger}`} disabled={locked} onClick={()=>void remove(session)}>Eliminar</button></div>}</div>
    </article>)}
    {admin&&showEditor&&<TrainingComposer draft={draft} onChange={setDraft} categoryChosen={categoryChosen} onCategory={category=>{setDraft(previous=>({...previous,category}));setCategoryChosen(true);}} date={date} onDate={setDate} min={week} max={shift(week,6)} editing={!!editingId} busy={busy||libraryBusy} error={saveError} message={message} templates={templates} templateError={templateError} templateBusy={templateBusy} library={library} libraryBusy={libraryBusy} libraryNotice={libraryNotice} onLibrarySave={saveLibrary} onTemplate={useTemplate} onSaveTemplate={saveTemplate} onSave={add} onCancel={()=>{if(discard()){clearEditor();setMessage("");}}}/>}
    <nav className={s.bar} aria-label="Más opciones"><Link className={`${s.button} ${s.secondary}`} href="/dashboard">Mi panel</Link><Link className={`${s.button} ${s.secondary}`} href="/salidas">Salidas del club</Link><Link className={`${s.button} ${s.secondary}`} href="/progreso">Mi progreso</Link>{categoryFilter==="trail"&&<Link className={s.button} href="/seguimiento-trail">Registrar salida realizada</Link>}</nav>
  </div></main>;
}
