import type { SupabaseClient } from '@supabase/supabase-js';
import type { TrainingSession, Category } from './training-builder.ts';
export type TrainingSection = 'fuerza' | 'trail';
export function isCategory(value: string | null): value is Category { return value !== null && ['fuerza','trail','movilidad','descanso'].includes(value); }
export function sectionSessions<T extends {category:string}>(rows:readonly T[],section?:TrainingSection):T[]{return rows.filter(row=>!section||row.category===section);}
export async function loadSectionWeek(client:SupabaseClient,athlete:string,week:string,section?:TrainingSection):Promise<TrainingSession[]>{
  const end=new Date(week+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+7);
  const rows:TrainingSession[]=[];
  for(let from=0;;from+=500){
    let query=client.from('weekly_training_plan').select('id,athlete_id,session_date,category,title,details,completed,structure,goal_id,purpose').eq('athlete_id',athlete).gte('session_date',week).lt('session_date',end.toISOString().slice(0,10));
    if(section)query=query.eq('category',section);
    const {data,error}=await query.order('session_date').order('id').range(from,from+499);
    if(error)throw error;rows.push(...(data??[]) as TrainingSession[]);if(!data||data.length<500)return rows;
  }
}
