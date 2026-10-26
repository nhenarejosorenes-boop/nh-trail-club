import type {SupabaseClient} from '@supabase/supabase-js';
import {addDays,type RunnerGoal,type GoalReview} from './runner-goals.ts';
export type GoalWeekSession={id:string;title:string;session_date:string;completed:boolean;category:string};
export type GoalWeekActivity={id:string;distance_km:number|string;elevation_m:number;duration_minutes:number};
export type GoalWeekFeedback={session_id:string;effort:number|null;sensations:string;updated_at:string};
async function all<T>(fetchPage:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>){const rows:T[]=[];for(let from=0;;from+=500){const {data,error}=await fetchPage(from,from+499);if(error)throw error;rows.push(...(data??[]));if(!data||data.length<500)return rows;}}
export async function loadGoalWeek(client:SupabaseClient,goal:Pick<RunnerGoal,'id'|'athlete_id'>,week:string){
 const end=addDays(week,7);
 const [sessions,activities,review]=await Promise.all([
  all<GoalWeekSession>((from,to)=>client.from('weekly_training_plan').select('id,title,session_date,completed,category').eq('athlete_id',goal.athlete_id).eq('goal_id',goal.id).gte('session_date',week).lt('session_date',end).order('session_date').order('id').range(from,to)),
  all<GoalWeekActivity>((from,to)=>client.from('trail_activity_log').select('id,distance_km,elevation_m,duration_minutes').eq('athlete_id',goal.athlete_id).gte('activity_date',week).lt('activity_date',end).order('activity_date').order('id').range(from,to)),
  client.from('runner_goal_reviews').select('*').eq('goal_id',goal.id).eq('week_start',week).maybeSingle(),
 ]);
 if(review.error)throw review.error;
 const feedback:GoalWeekFeedback[]=[];
 for(let offset=0;offset<sessions.length;offset+=100){const ids=sessions.slice(offset,offset+100).map(p=>p.id);feedback.push(...await all<GoalWeekFeedback>((from,to)=>client.from('training_session_results').select('session_id,effort,sensations,updated_at').eq('athlete_id',goal.athlete_id).in('session_id',ids).order('session_id').range(from,to)));}
 return {sessions,activities,feedback,review:review.data as GoalReview|null};
}
export function goalWeekTotals(sessions:readonly GoalWeekSession[],activities:readonly GoalWeekActivity[],feedback:readonly GoalWeekFeedback[]){
 const efforts=feedback.filter(f=>f.effort!==null);return {planned:sessions.length,completed:sessions.filter(p=>p.completed).length,runs:activities.length,km:activities.reduce((n,l)=>n+Number(l.distance_km),0),elevation:activities.reduce((n,l)=>n+l.elevation_m,0),minutes:activities.reduce((n,l)=>n+l.duration_minutes,0),averageEffort:efforts.length?efforts.reduce((n,l)=>n+l.effort!,0)/efforts.length:null,reported:feedback.length};
}
