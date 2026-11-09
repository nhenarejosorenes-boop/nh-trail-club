import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const ids = { admin:'11111111-1111-4111-8111-111111111111', coach:'22222222-2222-4222-8222-222222222222', athlete:'33333333-3333-4333-8333-333333333333', other:'44444444-4444-4444-8444-444444444444' };
const file = name => readFileSync(new URL(name, import.meta.url), 'utf8');
before(async () => {
  await db.exec(file('./fixtures/coach-role-baseline.sql'));
  await db.exec('set check_function_bodies=on');
  await db.exec(file('../migrations/20261109211354_coach_role.sql'));
});
after(() => db.close());
beforeEach(async () => {
  await db.exec("reset role; select set_config('request.jwt.claim.sub','',false); truncate nh_staff.role_events,profiles,auth.users,deportistas,weekly_training_plan,runner_goals,runner_goal_phases,runner_goal_reviews,trail_activity_log,training_templates,training_exercise_library,training_session_results,club_messages,club_message_reads,club_subscription_requests,club_subscription_monthly_dues,club_pilot_memberships cascade");
  for (const [role,id] of Object.entries(ids)) {
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())", [id,role+'@example.test']);
    await db.query("insert into profiles(id,full_name,email,role) values($1,$2,$3,$4)", [id,role,role+'@example.test',role==='admin'?'admin':role==='coach'?'coach':'athlete']);
  }
  await db.query("insert into deportistas(nombre,email,telefono,user_id) values('Runner','private@example.test','private-phone',$1)", [ids.athlete]);
  await db.query("insert into weekly_training_plan(athlete_id,session_date,category,title) values($1,current_date,'fuerza','Fuerza'),($2,current_date,'trail','Plan sin ficha')", [ids.athlete,ids.other]);
  await db.query("insert into trail_activity_log(athlete_id,activity_date,distance_km,elevation_m,duration_minutes) values($1,current_date,10,400,60)", [ids.athlete]);
  const sub = (await db.query("insert into club_subscription_requests(user_id,plan,status) values($1,'plus','approved') returning id", [ids.athlete])).rows[0].id;
  await db.query("insert into club_subscription_monthly_dues(subscription_id,period_month,amount_eur,due_date,status) values($1,date_trunc('month',now() at time zone 'Europe/Madrid')::date,60,current_date,'paid')", [sub]);
});
async function asUser(id, role='authenticated') {
  await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('set role '+role);
}
async function setCoach(id,email,expected,enabled) {
  return (await db.query('select public.coach_access_set($1,$2,$3,$4) result',[id,email,expected,enabled])).rows[0].result;
}
async function own(sql,args=[]) { await db.exec('reset role'); return db.query(sql,args); }

test('coach can program linked athletes, edit and complete sessions but cannot reach unlinked plans', async () => {
  await asUser(ids.coach);
  const roster=(await db.query('select * from public.coaching_roster()')).rows;
  assert.equal(roster.length,1); assert.deepEqual(Object.keys(roster[0]).sort(),['id','nivel','nombre','user_id']);
  assert.equal((await db.query('select id from weekly_training_plan')).rows.length,1);
  const session=(await db.query("insert into weekly_training_plan(athlete_id,session_date,category,title) values($1,current_date,'trail','Montaña') returning id",[ids.athlete])).rows[0].id;
  assert.equal((await db.query("update weekly_training_plan set title='Cuestas' where id=$1 returning id",[session])).rows.length,1);
  await db.query('select public.mark_training_completed($1,true)',[session]);
  assert.equal((await db.query('select completed from weekly_training_plan where id=$1',[session])).rows[0].completed,true);
  await assert.rejects(db.query("insert into weekly_training_plan(athlete_id,session_date,category,title) values($1,current_date,'trail','Forbidden')",[ids.other]),/row-level security/);
  assert.equal((await db.query('delete from weekly_training_plan where id=$1 returning id',[session])).rows.length,1);
});
test('coach can manage goals, phases and weekly reviews, read results and library', async () => {
  await asUser(ids.coach);
  const goal=(await db.query("insert into runner_goals(athlete_id,title,goal_type,priority,starts_on,target_date,available_days) values($1,'Carrera','race','A',current_date,current_date+60,3) returning id",[ids.athlete])).rows[0].id;
  assert.equal((await db.query("update runner_goals set title='Objetivo revisado' where id=$1 returning revision",[goal])).rows[0].revision,2);
  await db.query("insert into runner_goal_phases(goal_id,phase_type,starts_on,ends_on,focus) values($1,'base',current_date,current_date+7,'Fuerza')",[goal]);
  await db.query("insert into runner_goal_reviews(goal_id,week_start,summary,decision,next_focus) values($1,current_date,'Bien','maintain','Continuar')",[goal]);
  await db.query("insert into training_exercise_library(name,category) values('Sentadilla','fuerza')");
  await db.query("insert into training_templates(name,category,title,structure) values('Base','fuerza','Base','{}')");
  assert.equal((await db.query('select id from trail_activity_log')).rows.length,1);
  const session=(await db.query('select id from weekly_training_plan limit 1')).rows[0].id;
  await asUser(ids.athlete);
  await db.query("insert into training_session_results(session_id,athlete_id) values($1,$2)",[session,ids.athlete]);
  await asUser(ids.coach);
  assert.equal((await db.query('select session_id from training_session_results')).rows.length,1);
  assert.equal((await db.query("update training_session_results set sensations='Overwrite' returning session_id")).rows.length,0);
  assert.equal((await db.query('delete from trail_activity_log returning id')).rows.length,0);
});
test('coach can send messages with training context and cannot administer accounts or contact records', async () => {
  await asUser(ids.coach);
  const session=(await db.query('select id from weekly_training_plan limit 1')).rows[0].id;
  await db.query("select public.messaging_send($1,gen_random_uuid(),'Mensaje de prueba',$2)",[ids.athlete,session]);
  assert.equal((await db.query('select body from club_messages')).rows.length,1);
  for (const query of ['select public.coach_accounts_list()', "select public.coach_account_lookup('athlete@example.test')"])
    await assert.rejects(db.query(query),/Solo administración/);
  await assert.rejects(setCoach(ids.other,'other@example.test','athlete',true),/Solo administración/);
  await assert.rejects(db.query("update profiles set role='admin' where id=$1",[ids.coach]),/No se permite/);
  assert.equal((await db.query('select id from deportistas')).rows.length,0);
  assert.equal((await db.query("update deportistas set nombre='Cambio' returning id")).rows.length,0);
  await assert.rejects(db.query("insert into deportistas(nombre) values('Alta')"),/row-level security/);
  await assert.rejects(db.query('select * from nh_staff.role_events'),/permission denied/);
});
test('coach cannot read, create, alter or approve other peoples finances', async () => {
  await asUser(ids.coach);
  for(const table of ['club_subscription_requests','club_subscription_monthly_dues']) {
    assert.equal((await db.query('select * from '+table)).rows.length,0);
    assert.equal((await db.query("update "+table+" set status='paid' returning id")).rows.length,0);
    assert.equal((await db.query('delete from '+table+' returning id')).rows.length,0);
  }
  await assert.rejects(db.query("insert into club_subscription_requests(user_id,plan,status) values($1,'plus','approved')",[ids.athlete]),/row-level security/);
  await assert.rejects(db.query("insert into club_subscription_monthly_dues(subscription_id,period_month,amount_eur,due_date,status) values(gen_random_uuid(),current_date,60,current_date,'paid')"),/row-level security/);
});
test('admin grants and revokes reviewed confirmed accounts with audit and immediate effect', async () => {
  await asUser(ids.admin);
  const lookup=(await db.query("select public.coach_account_lookup(' OTHER@example.test ') candidate")).rows[0].candidate;
  assert.equal(lookup.id,ids.other); assert.equal(lookup.role,'athlete');
  assert.equal((await setCoach(ids.other,lookup.email,'athlete',true)).role,'coach');
  assert.equal((await db.query('select public.coach_accounts_list() value')).rows[0].value.length,2);
  await asUser(ids.other); assert.equal((await db.query('select nh_staff.is_coach() yes')).rows[0].yes,true);
  await asUser(ids.admin); await setCoach(ids.other,lookup.email,'coach',false);
  await asUser(ids.other); assert.equal((await db.query('select nh_staff.is_coach() yes')).rows[0].yes,false);
  await assert.rejects(db.query('select * from public.coaching_roster()'),/Acceso exclusivo/);
  assert.equal((await own('select * from nh_staff.role_events')).rows.length,2);
});
test('granting never accepts admin/self, unconfirmed, blocked, deleted, anonymous or pilot accounts', async () => {
  await asUser(ids.admin);
  await assert.rejects(setCoach(ids.admin,'admin@example.test','admin',false));
  for(const change of ["email_confirmed_at=null","banned_until=now()+interval '1 day'","deleted_at=now()","is_anonymous=true"]) {
    await own('update auth.users set '+change+' where id=$1',[ids.other]); await asUser(ids.admin);
    await assert.rejects(setCoach(ids.other,'other@example.test','athlete',true));
    await own('update auth.users set email_confirmed_at=now(),banned_until=null,deleted_at=null,is_anonymous=false where id=$1',[ids.other]);
  }
  await own("insert into club_pilot_memberships(user_id,plan,starts_at,expires_at) values($1,'plus',now(),now()+interval '1 day')",[ids.other]);
  await asUser(ids.admin); await assert.rejects(setCoach(ids.other,'other@example.test','athlete',true));
});
test('identity changes and stale role reviews fail closed; duplicate requests do not add audit', async () => {
  await asUser(ids.admin);
  await assert.rejects(setCoach(ids.other,'athlete@example.test','athlete',true),/La cuenta ha cambiado/);
  await setCoach(ids.other,'other@example.test','athlete',true);
  await assert.rejects(setCoach(ids.other,'other@example.test','athlete',true),/La cuenta ha cambiado/);
  await setCoach(ids.other,'other@example.test','coach',true);
  assert.equal((await own('select * from nh_staff.role_events')).rows.length,1);
});
test('role and audit commit atomically', async () => {
  await own('alter table nh_staff.role_events add constraint force_audit_failure check(false)');
  try {
    await asUser(ids.admin); await assert.rejects(setCoach(ids.other,'other@example.test','athlete',true),/force_audit_failure/);
    assert.equal((await own('select role from profiles where id=$1',[ids.other])).rows[0].role,'athlete');
  } finally { await own('alter table nh_staff.role_events drop constraint force_audit_failure'); }
});
test('blocked coaches lose sports access even with a retained token; ordinary athletes keep own plans', async () => {
  await own("update auth.users set banned_until=now()+interval '1 day' where id=$1",[ids.coach]);
  await asUser(ids.coach); assert.equal((await db.query('select id from weekly_training_plan')).rows.length,0);
  await assert.rejects(db.query("select public.messaging_send($1,gen_random_uuid(),'Denied',null)",[ids.athlete]),/No tienes acceso/);
  await asUser(ids.athlete); assert.equal((await db.query('select id from weekly_training_plan')).rows.length,1);
  await assert.rejects(db.query("insert into weekly_training_plan(athlete_id,session_date,category,title) values($1,current_date,'trail','No')",[ids.athlete]),/row-level security/);
  await assert.rejects(db.query('select * from public.coaching_roster()'),/Acceso exclusivo/);
});
test('anonymous callers and missing identities have no coaching or staff APIs', async () => {
  await asUser('','anon');
  for(const query of ['select * from public.coaching_roster()', 'select public.coach_accounts_list()', "select public.coach_account_lookup('other@example.test')"])
    await assert.rejects(db.query(query),/permission denied/);
  await asUser(''); await assert.rejects(db.query('select public.coach_accounts_list()'),/Solo administración/);
  assert.equal((await db.query('select nh_staff.is_coach() yes')).rows[0].yes,false);
});
test('public wrappers are invoker-only and private helpers fix search_path', async () => {
  const functions=(await db.query("select n.nspname,p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='nh_staff' or (n.nspname='public' and p.proname in ('coaching_roster','coach_account_lookup','coach_access_set','coach_accounts_list','mark_training_completed'))")).rows;
  for(const fn of functions) {
    if(fn.nspname==='public') assert.equal(fn.prosecdef,false);
    assert.ok(fn.proconfig.some(value=>value.startsWith('search_path=')));
  }
});
