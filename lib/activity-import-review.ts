import type { ImportedActivity } from './activity-import';
export async function sha256(bytes: BufferSource) {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
export async function activityKey(startedAt:string) {return sha256(new TextEncoder().encode('run:'+new Date(startedAt).toISOString().slice(0,19)));}
export function importedDraft(a:ImportedActivity) {return {date:a.date,distance:a.distanceKm===null?'':String(a.distanceKm),elevation:a.elevationM===null?'':String(a.elevationM),duration:String(Math.max(1,Math.round(a.durationSeconds/60))),effort:'',feelings:''};}
export function likelySameActivity(a:{activity_date:string;distance_km:number|string;duration_minutes:number},b:{activity_date:string;distance_km:number;duration_minutes:number}) {
  return a.activity_date===b.activity_date && Math.abs(Number(a.distance_km)-b.distance_km)<=Math.max(.2,b.distance_km*.02) && Math.abs(a.duration_minutes-b.duration_minutes)<=2;
}
