import type { SupabaseClient } from '@supabase/supabase-js';
export const goalKinds={race:'Competición',consistency:'Constancia',distance:'Completar una distancia',performance:'Mejorar rendimiento'} as const;
export const goalPriorities={finish:'Terminar',improve:'Mejorar marca',compete:'Competir',consistency:'Ganar continuidad'} as const;
export const phaseKinds={base:'Preparación general',development:'Desarrollo',specific:'Preparación específica',approach:'Aproximación al objetivo',recovery:'Recuperación posterior'} as const;
export const goalStatuses={active:'Activo',completed:'Completado',archived:'Archivado'} as const;
export type RunnerGoal={id:string;athlete_id:string;title:string;goal_type:keyof typeof goalKinds;priority:keyof typeof goalPriorities;starts_on:string;target_date:string;distance_km:number|null;elevation_m:number|null;terrain:string;experience:string;baseline:string;available_days:number;weekly_minutes:number|null;notes:string;status:keyof typeof goalStatuses;revision:number};
export type GoalDraft={title:string;goal_type:RunnerGoal['goal_type'];priority:RunnerGoal['priority'];starts_on:string;target_date:string;distance_km:string;elevation_m:string;terrain:string;experience:string;baseline:string;available_days:string;weekly_minutes:string;notes:string;status:RunnerGoal['status']};
export type GoalPhase={id:string;goal_id:string;phase_type:keyof typeof phaseKinds;starts_on:string;ends_on:string;focus:string;active:boolean;revision:number};
export type PhaseDraft={phase_type:GoalPhase['phase_type'];starts_on:string;ends_on:string;focus:string};
export type GoalReview={id:string;goal_id:string;week_start:string;summary:string;decision:string;next_focus:string;revision:number};
export const addDays=(value:string,n:number)=>{const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export const weekStart=(value:string)=>{const d=new Date(value+'T12:00:00Z');return addDays(value,-(d.getUTCDay()+6)%7);};
export const dateValid=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
export function daysUntil(target:string,today:string){return Math.round((Date.parse(target+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);}
export function newGoal(today:string):GoalDraft{return {title:'',goal_type:'race',priority:'finish',starts_on:today,target_date:'',distance_km:'',elevation_m:'',terrain:'',experience:'',baseline:'',available_days:'3',weekly_minutes:'',notes:'',status:'active'};}
export function goalDraft(goal:RunnerGoal):GoalDraft{return {...goal,distance_km:goal.distance_km===null?'':String(goal.distance_km),elevation_m:goal.elevation_m===null?'':String(goal.elevation_m),available_days:String(goal.available_days),weekly_minutes:goal.weekly_minutes===null?'':String(goal.weekly_minutes)};}
function numeric(v:string,min:number,max:number,integer=false){return v===''||(/^\d+(\.\d+)?$/.test(v)&&Number(v)>=min&&Number(v)<=max&&(!integer||Number.isInteger(Number(v))));}
export function validateGoal(d:GoalDraft):string|null{
 if(!d.title.trim()||d.title.length>160)return 'Escribe un objetivo de hasta 160 caracteres.';
 if(!dateValid(d.starts_on)||!dateValid(d.target_date)||d.starts_on>d.target_date)return 'Revisa la fecha de inicio y la fecha objetivo.';
 if(!Object.hasOwn(goalKinds,d.goal_type)||!Object.hasOwn(goalPriorities,d.priority)||!Object.hasOwn(goalStatuses,d.status))return 'Selecciona un tipo, prioridad y estado válidos.';
 if(!d.available_days||!numeric(d.available_days,1,7,true)||!numeric(d.weekly_minutes,1,10080,true)||!numeric(d.distance_km,0,1000)||!numeric(d.elevation_m,0,100000,true))return 'Revisa la disponibilidad, distancia o desnivel.';
 if(d.terrain.length>200||d.experience.length>1000||d.baseline.length>2000||d.notes.length>2000)return 'Acorta las indicaciones del objetivo.';
 return null;
}
export function goalRecord(d:GoalDraft){return {title:d.title.trim(),goal_type:d.goal_type,priority:d.priority,starts_on:d.starts_on,target_date:d.target_date,distance_km:d.distance_km===''?null:Number(d.distance_km),elevation_m:d.elevation_m===''?null:Number(d.elevation_m),terrain:d.terrain.trim(),experience:d.experience.trim(),baseline:d.baseline.trim(),available_days:Number(d.available_days),weekly_minutes:d.weekly_minutes===''?null:Number(d.weekly_minutes),notes:d.notes.trim(),status:d.status};}
export function validatePhase(p:PhaseDraft){return !Object.hasOwn(phaseKinds,p.phase_type)||!dateValid(p.starts_on)||!dateValid(p.ends_on)||p.starts_on>p.ends_on||!p.focus.trim()||p.focus.length>1000?'Revisa el tipo, las fechas y la finalidad de la etapa.':null;}
export function phasesForWeek(phases:readonly GoalPhase[],week:string){const end=addDays(week,6);return phases.filter(p=>p.active&&p.starts_on<=end&&p.ends_on>=week);}
export function suggestedPhases(goal:Pick<RunnerGoal,'starts_on'|'target_date'>):PhaseDraft[]{
 const days=daysUntil(goal.target_date,goal.starts_on)+1;if(days<4)return [];
 const kinds=['base','development','specific','approach'] as const;
 const focus=['Desarrollar continuidad, resistencia general y fuerza.','Trabajar las capacidades prioritarias del corredor.','Acercar las sesiones al terreno y las exigencias del objetivo.','Ajustar la preparación de los días previos al objetivo.'];
 const result:PhaseDraft[]=kinds.map((phase_type,i)=>({phase_type,starts_on:addDays(goal.starts_on,Math.floor(days*i/4)),ends_on:addDays(goal.starts_on,Math.floor(days*(i+1)/4)-1),focus:focus[i]}));
 result.push({phase_type:'recovery',starts_on:addDays(goal.target_date,1),ends_on:addDays(goal.target_date,7),focus:'Revisar sensaciones y organizar la recuperación posterior.'});return result;
}
export async function loadRunnerGoals(client:SupabaseClient,athlete:string):Promise<RunnerGoal[]>{const rows:RunnerGoal[]=[];for(let from=0;;from+=500){const {data,error}=await client.from('runner_goals').select('*').eq('athlete_id',athlete).order('target_date',{ascending:false}).order('id').range(from,from+499);if(error)throw error;rows.push(...(data??[]) as RunnerGoal[]);if(!data||data.length<500)return rows;}}
export async function loadGoalPhases(client:SupabaseClient,goal:string):Promise<GoalPhase[]>{const rows:GoalPhase[]=[];for(let from=0;;from+=500){const {data,error}=await client.from('runner_goal_phases').select('*').eq('goal_id',goal).order('starts_on').order('id').range(from,from+499);if(error)throw error;rows.push(...(data??[]) as GoalPhase[]);if(!data||data.length<500)return rows;}}
