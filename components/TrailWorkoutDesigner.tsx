"use client";
import { trailWorkoutTypes } from '@/lib/trail-workouts';
import type { TrainingDraft } from '@/lib/training-builder';
import s from './training-builder.module.css';
export default function TrailWorkoutDesigner({draft,busy,onChoose}:{draft:TrainingDraft;busy:boolean;onChoose:(id:string)=>void}){
 return <section className={s.trailDesigner} aria-label="Creador de carrera por montaña"><p className={s.eyebrow}>Sistema de planificación de carrera por montaña</p><h3>1. Elige el tipo de sesión</h3><p className={s.muted}>Cada opción prepara un borrador con calentamiento, trabajo principal y vuelta a la calma. Los tiempos y repeticiones son ejemplos editables: ajústalos al nivel y al objetivo del deportista antes de guardar.</p>
  <div className={s.trailTypes}>{trailWorkoutTypes.map(t=><button key={t.id} type="button" className={`${s.trailType} ${draft.title===t.title?s.active:''}`} aria-pressed={draft.title===t.title} disabled={busy} onClick={()=>{if((draft.title||draft.structure.notes||draft.structure.blocks.some(b=>b.items.length))&&!window.confirm('¿Sustituir el contenido del borrador por esta estructura de carrera? Los cambios solo se aplicarán al guardar la sesión.'))return;onChoose(t.id);}}><strong>{t.title}</strong><span>{t.description}</span></button>)}</div>
  <p className={s.muted}><strong>Después:</strong> define el volumen total, ajusta los tramos y revisa la vista del cliente antes de programar.</p>
 </section>;
}
