import type { Exercise } from '@/lib/training-builder';
import s from './training-builder.module.css';
export default function TrailSegmentFields({item,onChange}:{item:Exercise;onChange:(field:keyof Exercise,value:string)=>void}){
 return <div className={s.grid}>
  <label className={s.label}>Duración del tramo<input className={s.field} value={item.duration} maxLength={60} placeholder="15 min / 45 s" onChange={e=>onChange('duration',e.target.value)}/></label>
  <label className={s.label}>Distancia del tramo (km)<input className={s.field} type="number" min="0" max="500" step="0.01" value={item.trailDistance??''} onChange={e=>onChange('trailDistance',e.target.value)}/></label>
  <label className={s.label}>Desnivel positivo (m+)<input className={s.field} type="number" min="0" max="30000" step="1" value={item.trailElevation??''} onChange={e=>onChange('trailElevation',e.target.value)}/></label>
  <label className={s.label}>Desnivel negativo (m−)<input className={s.field} type="number" min="0" max="30000" step="1" value={item.trailDescent??''} onChange={e=>onChange('trailDescent',e.target.value)}/></label>
  <label className={s.label}>Terreno<input className={s.field} maxLength={80} placeholder="Sendero técnico, pista, terreno mixto…" value={item.trailTerrain??''} onChange={e=>onChange('trailTerrain',e.target.value)}/></label>
  <label className={s.label}>Intensidad, ritmo o zona<input className={s.field} maxLength={80} placeholder="Z2 / RPE 6 / ritmo libre en subida" value={item.intensity} onChange={e=>onChange('intensity',e.target.value)}/></label>
  <label className={s.label}>Repeticiones del tramo<input className={s.field} type="number" min="1" max="30" step="1" value={item.sets} onChange={e=>onChange('sets',e.target.value)}/></label>
  <label className={s.label}>Objetivo por repetición<input className={s.field} maxLength={40} placeholder="3 min de subida / 400 m" value={item.reps} onChange={e=>onChange('reps',e.target.value)}/></label>
  <label className={s.label}>Recuperación (segundos)<input className={s.field} type="number" min="0" max="3600" step="1" value={item.rest} onChange={e=>onChange('rest',e.target.value)}/></label>
  <label className={s.label}>Cómo recuperar<input className={s.field} maxLength={80} placeholder="Trote suave / caminar / bajar andando" value={item.trailRecovery??''} onChange={e=>onChange('trailRecovery',e.target.value)}/></label>
 </div>;
}
