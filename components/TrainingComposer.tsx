"use client";
import { useRef, useState, type FormEvent } from "react";
import TrailWorkoutDesigner from "./TrailWorkoutDesigner";
import TrailSegmentFields from "./TrailSegmentFields";
import TrainingSessionContent from "./TrainingSessionContent";
import { categories, stages, newExercise, starterTemplates, type TrainingDraft, type Exercise, type Stage, type TrainingTemplate, type LibraryExercise } from "@/lib/training-builder";
import { libraryOptions, exerciseFromLibrary } from "@/lib/training-library";
import s from "./training-builder.module.css";
type Props = { onTrailWorkout:(id:string)=>void; categoryChosen:boolean; onCategory:(category:TrainingDraft["category"])=>void; draft: TrainingDraft; onChange: (draft: TrainingDraft)=>void; date: string; onDate: (date:string)=>void; min: string; max: string; editing: boolean; busy:boolean; error:string; message:string; templates:TrainingTemplate[]; templateError:string; templateBusy:boolean; onTemplate:(id:string)=>void; onSaveTemplate:(name:string)=>Promise<boolean>; onSave:(event:FormEvent<HTMLFormElement>)=>void; onCancel:()=>void; library:LibraryExercise[]; libraryBusy:boolean; libraryNotice:string; onLibrarySave:(exercise:Exercise)=>void };
export default function TrainingComposer(p:Props) {
  const [preview,setPreview]=useState(true);
  const [templateName,setTemplateName]=useState("");
  const [templateId,setTemplateId]=useState("");
  const [librarySearch,setLibrarySearch]=useState("");
  const isTrail=p.categoryChosen&&p.draft.category==="trail";
  const unit=isTrail?"tramo":"ejercicio";
  const library=libraryOptions(p.library,librarySearch).filter(i=>!p.categoryChosen||i.category===p.draft.category||i.category==="movilidad");
  const starters=starterTemplates.filter(t=>!p.categoryChosen||t.draft.category===p.draft.category);
  const savedTemplates=p.templates.filter(t=>!p.categoryChosen||t.category===p.draft.category);
  const [libraryItemId,setLibraryItemId]=useState("");
  const titleRef=useRef<HTMLInputElement>(null);
  const structure=p.draft.structure;
  const update=(stage:Stage,id:string,field:keyof Exercise,value:string)=>p.onChange({...p.draft,structure:{...structure,blocks:structure.blocks.map(b=>b.stage===stage?{...b,items:b.items.map(i=>i.id===id?{...i,[field]:value}:i)}:b)}});
  const move=(stage:Stage,index:number,direction:number)=>{
    p.onChange({...p.draft,structure:{...structure,blocks:structure.blocks.map(b=>{if(b.stage!==stage)return b; const items=[...b.items]; [items[index],items[index+direction]]=[items[index+direction],items[index]]; return {...b,items};})}});
  };
  function submit(e:FormEvent<HTMLFormElement>) {
    if(!p.draft.title.trim()) titleRef.current?.focus();
    p.onSave(e);
  }
  return <section className={s.panel} id="session-editor" aria-label="Editor de entrenamientos">
    <p className={s.eyebrow}>Diseña · Revisa · Programa</p><h2>{isTrail?(p.editing?"Editar sesión de carrera trail y montaña":"Crear sesión de carrera trail y montaña"):(p.editing?"Editar entrenamiento":"Crear entrenamiento")}</h2>
    {isTrail&&<TrailWorkoutDesigner draft={p.draft} busy={p.busy||p.templateBusy} onChoose={p.onTrailWorkout}/>}
    <div className={s.grid}>
      <label className={s.label}>Empezar desde una plantilla<select className={s.field} disabled={p.busy||p.templateBusy} value={templateId} onChange={e=>{const id=e.target.value;if(!id)return;if((p.draft.title || structure.notes || structure.blocks.some(b=>b.items.length)) && !window.confirm("¿Sustituir este borrador por la plantilla? La sesión guardada no se modifica hasta pulsar Guardar.")){return;}setTemplateId("");p.onTemplate(id);}}><option value="">Selecciona una plantilla…</option><optgroup label="Plantillas de inicio">{starters.map(t=><option value={`starter:${t.id}`} key={t.id}>{t.name}</option>)}</optgroup><optgroup label="Plantillas del equipo">{savedTemplates.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</optgroup></select></label>
      <div><p className={s.muted}>Adapta las plantillas al nivel y al objetivo del deportista. La fecha y el cliente se eligen al programar.</p></div>
    </div>
    <div className={s.library}><h3>{isTrail?"Tramos de carrera y montaña":"Biblioteca de ejercicios"}</h3><p className={s.muted}>{isTrail?"Selecciona tareas de carrera o crea tus propios tramos. Organiza el calentamiento, el trabajo principal y la vuelta a la calma.":"Selecciona ejercicios de esta modalidad y movilidad. Puedes adaptarlos y guardar tus propios ejercicios con indicaciones y vídeos."}</p><label className={s.label}>Buscar {unit}<input className={s.field} type="search" value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)} placeholder={isTrail?"Rodaje, cuesta, progresivos…":"Nombre del ejercicio"}/></label><p className={s.muted}>{library.length ? `${library.length} opciones disponibles. Selecciona uno dentro del bloque donde quieras añadirlo.` : "No hay ejercicios que coincidan con esta búsqueda."}</p>{librarySearch&&<button type="button" className={`${s.button} ${s.secondary}`} onClick={()=>setLibrarySearch("")}>Limpiar búsqueda</button>}{p.libraryNotice&&<p role="status" className={s.muted}>{p.libraryNotice}</p>}</div>
    {isTrail&&<h3>2. Define la sesión y ajusta sus tramos</h3>}
    <div className={s.editorGrid}><form onSubmit={submit} noValidate aria-busy={p.busy}>
      <fieldset disabled={p.busy||p.templateBusy} style={{border:0,padding:0,margin:0,minWidth:0}}>
        <div className={s.grid}>
          <label className={s.label}>Fecha<input type="date" className={s.field} value={p.date} min={p.min} max={p.max} required onChange={e=>p.onDate(e.target.value)}/></label>
          <label className={s.label}>Tipo de entrenamiento (obligatorio)<select className={s.field} value={p.categoryChosen?p.draft.category:""} required onChange={e=>{if(e.target.value)p.onCategory(e.target.value as TrainingDraft["category"]);}}><option value="" disabled>Selecciona Fuerza, Trail, Movilidad o Descanso…</option>{Object.entries(categories).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
        </div>
        <label className={s.label}>Título (obligatorio)<input ref={titleRef} className={s.field} value={p.draft.title} maxLength={120} placeholder={isTrail?"Ej.: Rodaje de montaña con subidas":"Ej.: Fuerza de tren inferior"} required onChange={e=>p.onChange({...p.draft,title:e.target.value})}/></label>
        <label className={s.label}>Objetivo e indicaciones generales<textarea className={s.field} value={structure.notes} maxLength={6000} rows={3} placeholder="Qué debe tener en cuenta el cliente durante la sesión" onChange={e=>p.onChange({...p.draft,structure:{...structure,notes:e.target.value}})}/></label>
        {p.categoryChosen && p.draft.category==="trail" && <fieldset className={s.block}><legend className={s.legend}>Objetivos de la sesión (opcionales)</legend><div className={s.grid}>{([
          ["distance","Distancia (km)",0,500,"0.1"],["elevation","Desnivel positivo (m)",0,30000,"1"],["minutes","Duración (min)",1,10080,"1"],["effort","Esfuerzo (1–10)",1,10,"1"]
        ] as const).map(([field,label,min,max,step])=><label className={s.label} key={field}>{label}<input type="number" className={s.field} value={structure.targets[field]} min={min} max={max} step={step} onChange={e=>p.onChange({...p.draft,structure:{...structure,targets:{...structure.targets,[field]:e.target.value}}})}/></label>)}</div></fieldset>}
        {p.categoryChosen&&structure.blocks.map(block=><fieldset className={s.block} key={block.stage}><legend className={s.legend}>{stages[block.stage]}</legend>
          {block.items.length===0 && <p className={s.muted}>Bloque opcional. Añade {isTrail?"un tramo de carrera":"un ejercicio o una tarea"}.</p>}
          {block.items.map((i,n)=><div className={s.exercise} key={i.id}>
            <div className={s.bar}><strong>{isTrail?"Tramo":"Ejercicio"} {n+1}</strong><button className={`${s.button} ${s.secondary}`} type="button" disabled={n===0} aria-label={`Subir ejercicio ${n+1} de ${stages[block.stage]}`} onClick={()=>move(block.stage,n,-1)}>↑</button><button className={`${s.button} ${s.secondary}`} type="button" disabled={n===block.items.length-1} aria-label={`Bajar ejercicio ${n+1} de ${stages[block.stage]}`} onClick={()=>move(block.stage,n,1)}>↓</button></div>
            <label className={s.label}>{isTrail?"Tramo de carrera":"Ejercicio o tarea"}<input className={s.field} required maxLength={120} value={i.name} placeholder={p.draft.category==="fuerza"?"Ej.: Sentadilla":"Ej.: Carrera continua suave"} onChange={e=>update(block.stage,i.id,"name",e.target.value)}/></label>
            {isTrail?<TrailSegmentFields item={i} onChange={(field,value)=>update(block.stage,i.id,field,value)}/>:<>
            <div className={s.grid}>
              <label className={s.label}>Series<input className={s.field} type="number" min="1" max="30" step="1" value={i.sets} onChange={e=>update(block.stage,i.id,"sets",e.target.value)}/></label>
              <label className={s.label}>Repeticiones o intervalo<input className={s.field} maxLength={40} placeholder="8 por lado / 3 min" value={i.reps} onChange={e=>update(block.stage,i.id,"reps",e.target.value)}/></label>
              <label className={s.label}>Carga (kg)<input className={s.field} type="number" min="0" max="1000" step="0.1" value={i.weight} onChange={e=>update(block.stage,i.id,"weight",e.target.value)}/></label>
              <label className={s.label}>Descanso (s)<input className={s.field} type="number" min="0" max="3600" step="1" value={i.rest} onChange={e=>update(block.stage,i.id,"rest",e.target.value)}/></label>
              <label className={s.label}>Duración<input className={s.field} maxLength={60} placeholder="10 min / 45 s" value={i.duration} onChange={e=>update(block.stage,i.id,"duration",e.target.value)}/></label>
              <label className={s.label}>Intensidad, ritmo o zona<input className={s.field} maxLength={80} placeholder="Z2 / RPE 6 / 5:30 min/km" value={i.intensity} onChange={e=>update(block.stage,i.id,"intensity",e.target.value)}/></label>
            </div>
            </>}
            <label className={s.label}>Indicaciones {isTrail?"del tramo":"del ejercicio"}<textarea className={s.field} rows={2} maxLength={1000} value={i.notes} onChange={e=>update(block.stage,i.id,"notes",e.target.value)}/></label>
            <label className={s.label}>Vídeo demostrativo (opcional)<input className={s.field} type="url" inputMode="url" maxLength={500} value={i.videoUrl??""} placeholder="https://www.youtube.com/watch?v=…" onChange={e=>update(block.stage,i.id,"videoUrl",e.target.value)}/></label>
            <div className={s.bar}><button className={`${s.button} ${s.secondary}`} type="button" disabled={p.libraryBusy} onClick={()=>{setLibraryItemId(i.id);p.onLibrarySave(i);}}>{p.libraryBusy?"Guardando…":`Guardar ${unit} en biblioteca`}</button>
            <button className={`${s.button} ${s.danger}`} type="button" aria-label={`Quitar ejercicio ${n+1} de ${stages[block.stage]}`} onClick={()=>p.onChange({...p.draft,structure:{...structure,blocks:structure.blocks.map(b=>b.stage===block.stage?{...b,items:b.items.filter(x=>x.id!==i.id)}:b)}})}>Quitar {unit}</button></div>{p.libraryNotice&&libraryItemId===i.id&&<p role="status" className={s.muted}>{p.libraryNotice}</p>}
          </div>)}
          <label className={s.label}>Añadir desde la biblioteca<select className={s.field} value="" disabled={block.items.length>=30||p.libraryBusy||library.length===0} onChange={e=>{const item=exerciseFromLibrary(e.target.value,library);if(!item)return;p.onChange({...p.draft,structure:{...structure,blocks:structure.blocks.map(b=>b.stage===block.stage?{...b,items:[...b.items,item]}:b)}});}}><option value="">{library.length ? `Selecciona un ${unit}…` : "Sin coincidencias: limpia la búsqueda"}</option>{library.map(i=><option value={i.id} key={i.id}>{i.name} · {categories[i.category]}</option>)}</select></label>
          <button className={`${s.button} ${s.secondary}`} type="button" disabled={block.items.length>=30} onClick={()=>p.onChange({...p.draft,structure:{...structure,blocks:structure.blocks.map(b=>b.stage===block.stage?{...b,items:[...b.items,newExercise()]}:b)}})}>+ Añadir {unit} a {stages[block.stage].toLowerCase()}</button>
        </fieldset>)}
      </fieldset>
      <p className={s.muted}>Se guardará para el deportista seleccionado y la fecha indicada.</p>
      {p.error && <p className={s.alert} role="alert">{p.error}</p>}{p.message && <p className={s.status} role="status">{p.message}</p>}
      <div className={s.bar}><button type="submit" className={s.button} disabled={p.busy||p.templateBusy}>{p.busy?"Guardando…":p.editing?"Guardar cambios":"Guardar sesión"}</button><button type="button" className={`${s.button} ${s.secondary}`} disabled={p.busy||p.templateBusy} onClick={p.onCancel}>{p.editing?"Cancelar edición":"Limpiar borrador"}</button><button type="button" className={`${s.button} ${s.secondary}`} aria-expanded={preview} onClick={()=>setPreview(v=>!v)}>{preview?"Ocultar vista previa":"Ver como cliente"}</button></div>
      <div className={s.actions}><label className={s.label}>Guardar este entrenamiento como plantilla<input className={s.field} value={templateName} maxLength={100} placeholder="Nombre de la plantilla" disabled={p.templateBusy||p.busy} onChange={e=>setTemplateName(e.target.value)}/></label><button type="button" className={`${s.button} ${s.secondary}`} disabled={p.busy||p.templateBusy} onClick={async()=>{if(await p.onSaveTemplate(templateName)){setTemplateName("");setTemplateId("");}}}>{p.templateBusy?"Guardando plantilla…":"Guardar plantilla para el equipo"}</button>{p.templateError && <p role="alert" className={s.alert}>{p.templateError}</p>}</div>
    </form>{preview && <aside className={s.preview} aria-label="Vista previa del cliente"><h3 className={s.previewHeading}>Así lo verá el cliente</h3><p className={s.muted}>Vista previa del borrador · {p.date}</p>{p.categoryChosen?<TrainingSessionContent {...p.draft} structure={structure}/>:<p className={s.muted}>Selecciona el tipo de entrenamiento para ver su presentación.</p>}</aside>}</div>
  </section>;
}
