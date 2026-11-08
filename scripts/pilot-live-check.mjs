// Explicit production pilot only. Credentials arrive on hidden stdin and are never saved.
import {createClient} from '@supabase/supabase-js';
import {Encoder,Profile} from '@garmin/fitsdk';
import {parseActivityFile} from '../lib/activity-import.ts';
import {activityKey,sha256} from '../lib/activity-import-review.ts';
import {emptyResults} from '../lib/training-results.ts';
import {compareTrailSession} from '../lib/trail-comparison.ts';
import {loadAthleteMonth} from '../lib/athlete-detail.ts';
import {loadMembershipAccess} from '../lib/membership-client.ts';
import {writeFileSync} from 'node:fs';
import readline from 'node:readline';
import assert from 'node:assert/strict';

const run='PILOTO-QA-20261108-A';
console.log('Ready for scoped pilot configuration on stdin');
const input=readline.createInterface({input:process.stdin});
for await(const line of input){
 let cfg;try{cfg=JSON.parse(line);}catch{throw new Error("Invalid pilot configuration; credential values omitted");}input.close();
 assert.equal(cfg.url,'https://mibhnqgkbfirxhurxlfg.supabase.co');assert.equal(cfg.run,run);assert.ok([undefined,'message_context','reply_and_capacity'].includes(cfg.mode));
 assert.deepEqual(cfg.users.map(u=>u.plan).sort(),['basic','plus','plus_performance']);
 assert.ok(cfg.users.every(u=>/^piloto\.(basica|plus|performance)@nhtrail[.]example$/.test(u.email)));
 assert.equal(cfg.fixtures.sessions.length,6);assert.ok(cfg.fixtures.activity);
 const results=[],contexts=[];
 async function check(plan,name,fn){try{const detail=await fn();results.push({plan,name,pass:true});return detail;}catch(error){results.push({plan,name,pass:false,error:String(error.message??error).slice(0,250),code:error.code??null});return null;}}
 function ok(response){if(response.error)throw response.error;return response.data;}
 const date=cfg.fixtures.sessions[0].session_date;
 function buffer(xml){return new TextEncoder().encode(xml).buffer;}
 function gpx(time='08:00:00',end='08:10:00'){return buffer(`<gpx><trk><name>${run}</name><trkseg><trkpt lat="0" lon="0"><ele>10</ele><time>${date}T${time}Z</time></trkpt><trkpt lat="0.003" lon="0"><ele>20</ele><time>${date}T${end}Z</time></trkpt></trkseg></trk></gpx>`);}
 function tcx(time='09:00:00'){return buffer(`<TrainingCenterDatabase><Activities><Activity Sport="Running"><Id>${date}T${time}Z</Id><Lap><TotalTimeSeconds>600</TotalTimeSeconds><DistanceMeters>300</DistanceMeters></Lap></Activity></Activities></TrainingCenterDatabase>`);}
 function fit(){const e=new Encoder();const start=new Date(date+'T10:00:00Z');e.onMesg(Profile.MesgNum.FILE_ID,{type:'activity',manufacturer:'development',product:1,timeCreated:start});e.onMesg(Profile.MesgNum.SESSION,{sport:'running',startTime:start,timestamp:new Date(date+'T10:10:00Z'),totalTimerTime:600,totalElapsedTime:600,totalDistance:300,totalAscent:10});const b=e.close();return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}
 for(const user of cfg.users){
  const client=createClient(cfg.url,cfg.key,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=await check(user.plan,'login',async()=>ok(await client.auth.signInWithPassword({email:user.email,password:user.password})));
  if(!auth)continue;
  const id=auth.user.id,premium=user.plan!=='basic';
  assert.equal(auth.user.app_metadata.nh_pilot_provision,'nh-trail-pilot-20261108');
  const own=cfg.fixtures.sessions.filter(s=>s.athlete_id===id),force=own.find(s=>s.category==='fuerza'),trail=own.find(s=>s.category==='trail');
  assert.ok(force&&trail);const other=cfg.fixtures.sessions.find(s=>s.athlete_id!==id&&s.category==='trail');
  if(cfg.mode==='message_context'){
   await check(user.plan,'message_training_context_respects_premium',async()=>{
    const r=await client.rpc('messaging_send',{p_athlete:id,p_id:crypto.randomUUID(),p_body:run+' — comprobación de permisos del contexto de entrenamiento.',p_training:force.id});
    if(premium)ok(r);else assert.ok(r.error,'Basic account accessed a premium training title through message context');
   });
   await client.auth.signOut({scope:'local'});continue;
  }
  if(cfg.mode==='reply_and_capacity'){
   contexts.push({client,id,user,force,trail});
   await check(user.plan,'coach_reply_receipt_and_read_cursor',async()=>{
    const inbox=ok(await client.rpc('messaging_inbox'));assert.ok(Number(inbox[0].unread)>=1);
    const messages=ok(await client.from('club_messages').select('seq,sender_id,body').eq('athlete_id',id).order('seq',{ascending:false}).limit(1));
    assert.equal(messages.length,1);assert.notEqual(messages[0].sender_id,id);assert.ok(messages[0].body.startsWith(run+' — respuesta automática'));
    ok(await client.rpc('messaging_mark_read',{p_athlete:id,p_seq:messages[0].seq}));
    ok(await client.rpc('messaging_mark_read',{p_athlete:id,p_seq:Math.max(0,Number(messages[0].seq)-1)}));
    assert.equal(Number(ok(await client.rpc('messaging_inbox'))[0].unread),0);
   });
   continue;
  }
  contexts.push({client,id,user,force,trail});
  await check(user.plan,'membership_source_and_level',async()=>{const a=await loadMembershipAccess(client,id);assert.equal(a.source,'pilot');assert.equal(a.plan,user.plan);assert.equal(a.premium,premium);});
  await check(user.plan,'own_profile_card_and_grant',async()=>{
   for(const table of ['profiles','deportistas','club_pilot_memberships']){const rows=ok(await client.from(table).select(table==='profiles'?'id':'user_id'));assert.equal(rows.length,1);assert.equal(rows[0][table==='profiles'?'id':'user_id'],id);}
  });
  await check(user.plan,'no_fake_billing_records',async()=>{assert.equal(ok(await client.from('club_subscription_requests').select('id')).length,0);assert.equal(ok(await client.from('club_subscription_monthly_dues').select('id')).length,0);});
  await check(user.plan,'commercial_request_blocked',async()=>{const r=await client.from('club_subscription_requests').insert({user_id:id,plan:user.plan,status:'pending'});assert.ok(r.error);assert.equal(r.error.code,'42501');});
  await check(user.plan,'own_plan_visibility',async()=>{const rows=ok(await client.from('weekly_training_plan').select('id,athlete_id,category').in('id',own.map(s=>s.id)));assert.equal(rows.length,premium?2:0);assert.ok(rows.every(r=>r.athlete_id===id));});
  await check(user.plan,'other_plan_not_visible',async()=>{assert.equal(ok(await client.from('weekly_training_plan').select('id').eq('id',other.id)).length,0);});
  await check(user.plan,'prescription_cannot_be_edited',async()=>{const r=await client.from('weekly_training_plan').update({title:'UNEXPECTED PILOT EDIT'}).eq('id',force.id).select('id');assert.ok(r.error||!r.data.length);});
  await check(user.plan,'own_completion_authorized_by_plan',async()=>{const r=await client.rpc('mark_training_completed',{p_id:force.id,p_completed:true});if(premium){ok(r);const row=ok(await client.from('weekly_training_plan').select('completed').eq('id',force.id).single());assert.equal(row.completed,true);}else assert.ok(r.error);});
  await check(user.plan,'other_completion_blocked',async()=>{assert.ok((await client.rpc('mark_training_completed',{p_id:other.id,p_completed:true})).error);});
  await check(user.plan,'results_save_and_revision',async()=>{
   const draft=emptyResults(force.structure);const record={session_id:force.id,athlete_id:id,entries:draft.entries.map(e=>({...e,completed:true,sets:'1',reps:'1',weight:'0',notes:run})),effort:2,sensations:run+' — sensaciones sintéticas.'};
   const inserted=await client.from('training_session_results').insert(record).select('revision,prescription').single();
   if(!premium){assert.ok(inserted.error);return;}
   const row=ok(inserted);assert.deepEqual(row.prescription,force.structure);
   const updated=ok(await client.from('training_session_results').update({effort:3}).eq('session_id',force.id).eq('revision',row.revision).select('revision').single());assert.equal(updated.revision,row.revision+1);
   const stale=await client.from('training_session_results').update({effort:9}).eq('session_id',force.id).eq('revision',row.revision).select('revision');assert.equal(ok(stale).length,0);
  });
  await check(user.plan,'goals_phases_and_review_visibility',async()=>{
   const goals=ok(await client.from('runner_goals').select('id').eq('id',force.goal_id));assert.equal(goals.length,premium?1:0);
   for(const table of ['runner_goal_phases','runner_goal_reviews'])assert.equal(ok(await client.from(table).select('id').eq('goal_id',force.goal_id)).length,premium?1:0);
   assert.equal(ok(await client.from('runner_goals').select('id').eq('id',other.goal_id)).length,0);
  });
  await check(user.plan,'outing_visible',async()=>{assert.equal(ok(await client.from('club_activities').select('id').eq('id',cfg.fixtures.activity)).length,1);});
  await check(user.plan,'register_duplicate_cancel_and_register_again',async()=>{
   ok(await client.from('activity_registrations').insert({activity_id:cfg.fixtures.activity,user_id:id}));
   assert.ok((await client.from('activity_registrations').insert({activity_id:cfg.fixtures.activity,user_id:id})).error);
   assert.equal(ok(await client.from('activity_registrations').select('activity_id').eq('activity_id',cfg.fixtures.activity).eq('user_id',id)).length,1);
   ok(await client.from('activity_registrations').delete().eq('activity_id',cfg.fixtures.activity).eq('user_id',id));
   assert.equal(ok(await client.from('activity_registrations').select('activity_id').eq('activity_id',cfg.fixtures.activity).eq('user_id',id)).length,0);
   ok(await client.from('activity_registrations').insert({activity_id:cfg.fixtures.activity,user_id:id}));
   ok(await client.from('activity_registrations').delete().eq('activity_id',cfg.fixtures.activity).eq('user_id',id));
  });
  await check(user.plan,'cannot_register_for_another_athlete',async()=>{assert.ok((await client.from('activity_registrations').insert({activity_id:cfg.fixtures.activity,user_id:other.athlete_id})).error);});
  await check(user.plan,'manual_trail_log_save_and_edit',async()=>{
   const row=ok(await client.from('trail_activity_log').insert({athlete_id:id,activity_date:date,distance_km:1,elevation_m:10,duration_minutes:10,effort:2,feelings:run+' — salida manual sintética.',linked_session_id:premium?trail.id:null}).select('id').single());
   const updated=ok(await client.from('trail_activity_log').update({effort:3}).eq('id',row.id).eq('athlete_id',id).select('effort').single());assert.equal(updated.effort,3);
  });
  await check(user.plan,'cannot_write_another_athlete_log',async()=>{assert.ok((await client.from('trail_activity_log').insert({athlete_id:other.athlete_id,activity_date:date,distance_km:1,elevation_m:10,duration_minutes:10,feelings:run})).error);});
  const imports=[];
  for(const [format,bytes] of [['gpx',gpx()],['tcx',tcx()],['fit',fit()]])await check(user.plan,format+'_parse_import_and_idempotent_retry',async()=>{
   const parsed=parseActivityFile(run+'.'+format,bytes),a=parsed.activities[0];assert.equal(parsed.format,format);
   const record={activity_date:a.date,distance_km:a.distanceKm??0.3,elevation_m:a.elevationM??10,duration_minutes:Math.max(1,Math.round(a.durationSeconds/60)),effort:3,feelings:run+' — importación '+format+' sintética.',file_hash:await sha256(bytes),import_key:await activityKey(a.startedAt),import_index:a.index,file_format:format,started_at:a.startedAt,import_summary:{title:run+' '+format,duration_seconds:a.durationSeconds,average_heart_rate:a.averageHeartRate,max_heart_rate:a.maxHeartRate},linked_session_id:premium?trail.id:null};
   const first=ok(await client.rpc('import_trail_activity',{p_record:record}));assert.equal(first.created,true);
   const second=ok(await client.rpc('import_trail_activity',{p_record:record}));assert.equal(second.created,false);assert.equal(second.id,first.id);imports.push({format,record,id:first.id});
  });
  await check(user.plan,'cross_format_duplicate_preserves_existing_activity',async()=>{
   const first=imports.find(i=>i.format==='gpx');assert.ok(first);const bytes=tcx('08:00:00');
   const a=parseActivityFile('copy.tcx',bytes).activities[0];const record={...first.record,file_format:'tcx',file_hash:await sha256(bytes),import_key:await activityKey(a.startedAt)};
   const copied=ok(await client.rpc('import_trail_activity',{p_record:record}));assert.equal(copied.created,false);assert.equal(copied.id,first.id);
  });
  await check(user.plan,'foreign_plan_link_rejected',async()=>{const first=imports[0];assert.ok(first);const record={...first.record,file_hash:'f'.repeat(64),import_key:await sha256(new TextEncoder().encode(run+user.plan)),linked_session_id:other.id};assert.ok((await client.rpc('import_trail_activity',{p_record:record})).error);});
  await check(user.plan,'history_comparison_and_monthly_progress',async()=>{
   const data=await loadAthleteMonth(client,id,date.slice(0,7));const ownRuns=data.entries.filter(e=>e.feelings?.startsWith(run));assert.equal(ownRuns.length,4);
   assert.equal(data.sessions.filter(s=>own.some(o=>o.id===s.id)).length,premium?2:0);
   const rows=ok(await client.from('trail_activity_log').select('id,athlete_id,linked_session_id,activity_date,distance_km,elevation_m,duration_minutes,effort').eq('athlete_id',id));
   if(premium){const compared=compareTrailSession(trail,rows);assert.equal(compared.runs.length,4);assert.ok(compared.actual.distance>0);assert.equal(compared.actual.effort,3);assert.equal(ok(await client.from('weekly_training_plan').select('completed').eq('id',trail.id).single()).completed,false);}
   assert.equal(ok(await client.from('trail_activity_log').select('id').eq('athlete_id',other.athlete_id)).length,0);
  });
  await check(user.plan,'messages_send_retry_read_and_inbox',async()=>{
   const attempt={p_athlete:id,p_id:crypto.randomUUID(),p_body:run+' — mensaje técnico de la cuenta '+user.plan+'. No requiere respuesta.',p_training:premium?force.id:null};
   const first=ok(await client.rpc('messaging_send',attempt)),second=ok(await client.rpc('messaging_send',attempt));assert.equal(first.id,second.id);
   assert.equal(ok(await client.from('club_messages').select('id').eq('id',first.id)).length,1);
   ok(await client.rpc('messaging_mark_read',{p_athlete:id,p_seq:first.seq}));
   const inbox=ok(await client.rpc('messaging_inbox'));assert.ok(Array.isArray(inbox));assert.equal(inbox.length,1);assert.equal(inbox[0].athlete_id,id);
  });
  await check(user.plan,'foreign_conversation_is_private',async()=>{assert.equal(ok(await client.from('club_messages').select('id').eq('athlete_id',other.athlete_id)).length,0);assert.ok((await client.rpc('messaging_send',{p_athlete:other.athlete_id,p_id:crypto.randomUUID(),p_body:run,p_training:null})).error);});
  console.log(JSON.stringify({completed:user.plan,checks:results.filter(r=>r.plan===user.plan).length,failed:results.filter(r=>r.plan===user.plan&&!r.pass).length}));
 }
 if(contexts.length)await check('all','outing_capacity_with_three_accounts',async()=>{
  assert.equal(contexts.length,3);
  for(const c of contexts)ok(await c.client.from('activity_registrations').insert({activity_id:cfg.fixtures.activity,user_id:c.id}));
  const slots=ok(await contexts[0].client.rpc('obtener_plazas_actividad',{p_activity_id:cfg.fixtures.activity}));
  assert.equal(Number(slots[0].inscritos),3);assert.equal(Number(slots[0].plazas_disponibles),0);
  assert.ok((await contexts[0].client.from('activity_registrations').insert({activity_id:cfg.fixtures.activity,user_id:contexts[0].id})).error);
 });
 for(const c of contexts){
  await check(c.user.plan,'cleanup_outing_registration',async()=>{ok(await c.client.from('activity_registrations').delete().eq('activity_id',cfg.fixtures.activity).eq('user_id',c.id));});
  await check(c.user.plan,'logout',async()=>{ok(await c.client.auth.signOut({scope:'local'}));assert.equal((await c.client.auth.getSession()).data.session,null);});
 }
 const anonymous=createClient(cfg.url,cfg.key,{auth:{persistSession:false,autoRefreshToken:false}});
 await check('anonymous','private_data_requires_login',async()=>{assert.ok((await anonymous.from('club_pilot_memberships').select('user_id')).error);assert.ok((await anonymous.rpc('messaging_inbox')).error);});
 const report={run,checkedAt:new Date().toISOString(),scope:'Production Auth/REST with three synthetic pilot accounts; browser UI not validated',passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results};
 writeFileSync(cfg.mode==='message_context'?'supabase/tests/pilot_context_results_20261108.json':cfg.mode==='reply_and_capacity'?'supabase/tests/pilot_reply_capacity_results_20261108.json':'supabase/tests/pilot_live_results_20261108.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,failed:report.failed,failures:results.filter(r=>!r.pass)}));
 break;
}
