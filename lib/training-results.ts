import { readStructure, type Stage, type Structure } from './training-builder.ts';
export type ExerciseResult = { stage: Stage; id: string; completed: boolean; sets: string; reps: string; weight: string; notes: string };
export type SessionResult = { session_id: string; athlete_id: string; prescription: unknown; entries: ExerciseResult[]; effort: number | null; sensations: string; revision: number; updated_at: string };
export type ResultDraft = { entries: ExerciseResult[]; effort: string; sensations: string };
export function resultKey(stage:Stage,id:string){return `${stage}:${id}`;}
export function emptyResults(prescription:unknown):ResultDraft {
  const plan=readStructure(prescription);
  return {entries:plan?.blocks.flatMap(b=>b.items.map(i=>({stage:b.stage,id:i.id,completed:false,sets:'',reps:'',weight:'',notes:''})))??[],effort:'',sensations:''};
}
export function resultDraft(saved:SessionResult):ResultDraft {
  return {entries:structuredClone(saved.entries),effort:saved.effort===null?'':String(saved.effort),sensations:saved.sensations};
}
export function validateResults(draft:ResultDraft,prescription:unknown):string|null {
  const plan=readStructure(prescription);const expected=new Set(plan?.blocks.flatMap(b=>b.items.map(i=>resultKey(b.stage,i.id)))??[]);
  if(draft.entries.length!==expected.size)return 'La lista de ejercicios ha cambiado. Carga la versión guardada antes de continuar.';
  const seen=new Set<string>();
  for(const e of draft.entries){
    const key=resultKey(e.stage,e.id);if(!expected.has(key)||seen.has(key)||typeof e.completed!=='boolean')return 'Hay ejercicios que no corresponden a esta sesión.';seen.add(key);
    if(typeof e.sets!=='string'||typeof e.weight!=='string'||typeof e.reps!=='string'||typeof e.notes!=='string')return 'Los resultados del ejercicio no son válidos.';
    if(e.sets!==''&&(!/^\d+$/.test(e.sets)||+e.sets<0||+e.sets>30))return 'Las series realizadas deben estar entre 0 y 30.';
    if(e.weight!==''&&(!/^\d+(\.\d+)?$/.test(e.weight)||+e.weight<0||+e.weight>1000))return 'La carga utilizada debe estar entre 0 y 1000 kg.';
    if(e.sets.length>2||e.weight.length>20||e.reps.length>40||e.notes.length>500)return 'Acorta las repeticiones o las observaciones del ejercicio.';
  }
  if(draft.effort!==''&&(!/^\d+$/.test(draft.effort)||+draft.effort<1||+draft.effort>10))return 'El esfuerzo debe estar entre 1 y 10.';
  if(new TextEncoder().encode(JSON.stringify(draft.entries)).length>100000)return 'Los resultados son demasiado extensos. Acorta las observaciones.';
  if(draft.sensations.length>2000)return 'Las sensaciones admiten hasta 2000 caracteres.';
  return null;
}
export function resultExerciseName(plan:Structure|null,entry:ExerciseResult){return plan?.blocks.find(b=>b.stage===entry.stage)?.items.find(i=>i.id===entry.id)?.name??'Ejercicio de la versión registrada';}
