import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
const db=new PGlite();const sid='11111111-1111-4111-8111-111111111111',aid='22222222-2222-4222-8222-222222222222';
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema nh_access;grant usage on schema auth,nh_access to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function nh_access.has_paid_access(boolean) returns boolean language sql stable as $$select current_setting('test.access',true)='true'$$;
 create table club_subscription_monthly_dues(id uuid primary key default gen_random_uuid(),subscription_id uuid,period_month date,amount_eur numeric,status text,paid_on date,created_at timestamptz default now(),updated_at timestamptz default now(),unique(subscription_id,period_month));
 create table club_activities(id uuid primary key,max_participants integer);create table activity_registrations(id uuid default gen_random_uuid(),activity_id uuid);
 create function public.controlar_plazas() returns trigger language plpgsql as $$begin return new;end$$;
 grant select on club_activities,activity_registrations to authenticated;
 alter table activity_registrations enable row level security;
 create policy invisible_registrations on activity_registrations to authenticated using(false);`);
 await db.exec(readFileSync(new URL('../migrations/20261108193917_client_launch_guardrails.sql',import.meta.url),'utf8'));
});after(()=>db.close());
test('billing sets revision, paid date and timestamps server-side; stale edits return no rows',async()=>{
 const first=(await db.query("insert into club_subscription_monthly_dues(subscription_id,period_month,amount_eur,status,paid_on,revision) values($1,'2026-11-01',10,'pending',current_date,55) returning *",[sid])).rows[0];
 assert.equal(first.revision,1);assert.equal(first.paid_on,null);
 const next=await db.query("update club_subscription_monthly_dues set status='paid',paid_on=current_date,revision=999,created_at='2000-01-01' where id=$1 and revision=1 returning *",[first.id]);assert.equal(next.rows[0].revision,2);assert.equal(next.rows[0].created_at.toISOString(),first.created_at.toISOString());
 assert.equal((await db.query("update club_subscription_monthly_dues set status='pending' where id=$1 and revision=1 returning id",[first.id])).rows.length,0);
 await assert.rejects(db.query("update club_subscription_monthly_dues set period_month='2026-12-01' where id=$1",[first.id]),e=>e.code==='23514');
 for(const expression of ['null',"current_date+2"]){await assert.rejects(db.query(`update club_subscription_monthly_dues set paid_on=${expression} where id=$1`,[first.id]),e=>e.code==='23514')}
 await assert.rejects(db.query("insert into club_subscription_monthly_dues(subscription_id,period_month,status) values($1,'2026-11-01','pending')",[sid]),e=>e.code==='23505');
});
test('slot RPC denies unpaid and anonymous calls, counts every registration behind RLS',async()=>{
 await db.query('insert into club_activities values($1,3)',[aid]);await db.query('insert into activity_registrations(activity_id) values($1),($1)',[aid]);
 await db.exec('set role anon');await assert.rejects(db.query('select * from obtener_plazas_actividad($1)',[aid]),e=>e.code==='42501');
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[sid]);await db.exec("set role authenticated;select set_config('test.access','false',false)");await assert.rejects(db.query('select * from obtener_plazas_actividad($1)',[aid]),e=>e.code==='42501');
 await db.exec("select set_config('test.access','true',false)");assert.equal((await db.query('select count(*)::int n from activity_registrations')).rows[0].n,0);
 const counts=(await db.query('select * from obtener_plazas_actividad($1)',[aid])).rows[0];assert.equal(Number(counts.inscritos),2);assert.equal(Number(counts.plazas_disponibles),1);
 await assert.rejects(db.query('select public.controlar_plazas()'),e=>e.code==='42501');await db.exec('reset role');
});
