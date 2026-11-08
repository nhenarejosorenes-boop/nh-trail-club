import test,{before,after,beforeEach} from 'node:test';import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';import {readFileSync} from 'node:fs';
const db=new PGlite();const ids={admin:'11111111-1111-4111-8111-111111111111',basic:'22222222-2222-4222-8222-222222222222',plus:'33333333-3333-4333-8333-333333333333',plus_performance:'44444444-4444-4444-8444-444444444444'};
const sessions={basic:'55555555-5555-4555-8555-555555555555',plus:'66666666-6666-4666-8666-666666666666',plus_performance:'77777777-7777-4777-8777-777777777777'};
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema nh_access;grant usage on schema auth,nh_access to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.profiles(id uuid primary key,full_name text,role text);
 create table public.weekly_training_plan(id uuid primary key,athlete_id uuid,title text,session_date date);
 create table nh_access.test_plans(user_id uuid primary key,plan text);
 create function nh_access.has_paid_access(p_require_premium boolean) returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin') or exists(select 1 from nh_access.test_plans where user_id=auth.uid() and (not p_require_premium or plan in ('plus','plus_performance')))$$;`);
 await db.exec(readFileSync(new URL('../migrations/20261026185624_private_messaging.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/20261108185427_protect_message_training_context.sql',import.meta.url),'utf8'));
});
after(()=>db.close());
beforeEach(async()=>{
 await db.exec('reset role;truncate public.club_messages,public.club_message_reads,public.weekly_training_plan,public.profiles,nh_access.test_plans cascade;');
 for(const [plan,id] of Object.entries(ids)){
  await db.query('insert into profiles values($1,$2,$3)',[id,plan,plan==='admin'?'admin':'athlete']);
  if(plan!=='admin'){await db.query('insert into nh_access.test_plans values($1,$2)',[id,plan]);await db.query("insert into weekly_training_plan values($1,$2,'Private plan',current_date)",[sessions[plan],id]);}
 }
});
async function asUser(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
async function send(athlete,training=null,id=crypto.randomUUID()){return (await db.query("select public.messaging_send($1,$2,'PILOTO test',$3) as message",[athlete,id,training])).rows[0].message;}
test('Basic can send ordinary messages but cannot extract a hidden training title',async()=>{
 await asUser(ids.basic);assert.equal((await send(ids.basic)).training_title,null);
 await assert.rejects(send(ids.basic,sessions.basic),error=>error.code==='42501');
 assert.equal((await db.query('select count(*)::int as n from club_messages')).rows[0].n,1);
});
test('PLUS and Performance keep their own training context and idempotent retries',async()=>{
 for(const plan of ['plus','plus_performance']){await asUser(ids[plan]);const id=crypto.randomUUID();const first=await send(ids[plan],sessions[plan],id);assert.equal(first.training_title,'Private plan');assert.equal((await send(ids[plan],sessions[plan],id)).id,first.id);}
});
test('premium context never grants access to a different athlete or conversation',async()=>{
 await asUser(ids.plus);await assert.rejects(send(ids.plus,sessions.plus_performance),error=>error.code==='42501');await assert.rejects(send(ids.plus_performance,sessions.plus_performance),error=>error.code==='42501');
});
test('admin can discuss a Basic athletes plan without losing existing coaching privileges',async()=>{
 await asUser(ids.admin);assert.equal((await send(ids.basic,sessions.basic)).training_title,'Private plan');
});
test('existing message history and retries remain usable after a downgrade',async()=>{
 await asUser(ids.plus);const id=crypto.randomUUID();await send(ids.plus,sessions.plus,id);
 await db.exec('reset role');await db.query("update nh_access.test_plans set plan='basic' where user_id=$1",[ids.plus]);
 await asUser(ids.plus);assert.equal((await send(ids.plus,sessions.plus,id)).training_title,'Private plan');await assert.rejects(send(ids.plus,sessions.plus),error=>error.code==='42501');
});
