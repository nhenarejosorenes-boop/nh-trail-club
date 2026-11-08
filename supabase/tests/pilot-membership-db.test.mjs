import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const ids={admin:'11111111-1111-4111-8111-111111111111',basic:'22222222-2222-4222-8222-222222222222',plus:'33333333-3333-4333-8333-333333333333',plus_performance:'44444444-4444-4444-8444-444444444444',ordinary:'55555555-5555-4555-8555-555555555555'};
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema nh_access;grant usage on schema auth,nh_access to authenticated;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz,deleted_at timestamptz,is_anonymous boolean not null default false,banned_until timestamptz);
 create table public.profiles(id uuid primary key,role text);
 create table public.club_subscription_requests(id uuid primary key default gen_random_uuid(),user_id uuid not null,plan text,status text);
 create table public.club_subscription_monthly_dues(subscription_id uuid,period_month date,amount_eur numeric,status text);
 alter table public.profiles enable row level security;create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());grant select on public.profiles to authenticated;
 alter table public.club_subscription_requests enable row level security;grant select,insert on public.club_subscription_requests to authenticated;
 create policy request_own_insert on public.club_subscription_requests for insert to authenticated with check(user_id=auth.uid());
 create policy request_own_read on public.club_subscription_requests for select to authenticated using(user_id=auth.uid());`);
 await db.exec(readFileSync(new URL('../migrations/20261108183602_pilot_test_memberships.sql',import.meta.url),'utf8'));
});
after(()=>db.close());
beforeEach(async()=>{
 await db.exec('reset role;truncate public.club_pilot_memberships,auth.users,public.profiles,public.club_subscription_requests,public.club_subscription_monthly_dues cascade;');
 for(const [role,id] of Object.entries(ids)){
  await db.query('insert into auth.users(id,email_confirmed_at) values($1,now())',[id]);
  await db.query('insert into profiles values($1,$2)',[id,role==='admin'?'admin':'athlete']);
 }
 for(const plan of ['basic','plus','plus_performance'])await db.query("insert into club_pilot_memberships(user_id,plan,starts_at,expires_at) values($1,$2,now()-interval '1 minute',now()+interval '7 days')",[ids[plan],plan]);
});
async function asUser(id,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec(`set role ${role}`);}
async function access(){return (await db.query('select nh_access.has_paid_access(false) as club,nh_access.has_paid_access(true) as premium')).rows[0];}
test('test subscriptions grant the expected modality without paid dues',async()=>{
 for(const plan of ['basic','plus','plus_performance']){await asUser(ids[plan]);assert.deepEqual(await access(),{club:true,premium:plan!=='basic'});}
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int as n from club_subscription_monthly_dues')).rows[0].n,0);
});
test('ordinary accounts cannot gain test access and existing paid access still works',async()=>{
 await asUser(ids.ordinary);assert.deepEqual(await access(),{club:false,premium:false});
 await db.exec('reset role');
 const s=(await db.query("insert into club_subscription_requests(user_id,plan,status) values($1,'plus','approved') returning id",[ids.ordinary])).rows[0].id;
 await db.query("insert into club_subscription_monthly_dues values($1,date_trunc('month',now() at time zone 'Europe/Madrid')::date,60,'paid')",[s]);
 await asUser(ids.ordinary);assert.deepEqual(await access(),{club:true,premium:true});
});
test('test access expires and future grants are not active early',async()=>{
 await db.query("update club_pilot_memberships set starts_at=now()-interval '8 days',expires_at=now()-interval '1 day' where user_id=$1",[ids.plus]);
 await db.query("update club_pilot_memberships set starts_at=now()+interval '1 day',expires_at=now()+interval '8 days' where user_id=$1",[ids.basic]);
 for(const id of [ids.plus,ids.basic]){await asUser(id);assert.deepEqual(await access(),{club:false,premium:false});}
});
test('test accounts cannot create commercial subscription requests, including after expiry',async()=>{
 for(const id of [ids.basic,ids.plus]){
  await asUser(id);await assert.rejects(db.query("insert into club_subscription_requests(user_id,plan,status) values($1,'plus','pending')",[id]),/row-level security/);
 }
 await db.exec('reset role');await db.query("update club_pilot_memberships set starts_at=now()-interval '8 days',expires_at=now()-interval '1 day' where user_id=$1",[ids.basic]);
 await asUser(ids.basic);await assert.rejects(db.query("insert into club_subscription_requests(user_id,plan,status) values($1,'basic','pending')",[ids.basic]),/row-level security/);
 await asUser(ids.ordinary);assert.equal((await db.query("insert into club_subscription_requests(user_id,plan,status) values($1,'basic','pending') returning id",[ids.ordinary])).rows.length,1);
});
test('clients cannot create, extend, delete or inspect other pilot memberships',async()=>{
 await asUser(ids.basic);
 assert.deepEqual((await db.query('select user_id from club_pilot_memberships')).rows,[{user_id:ids.basic}]);
 await assert.rejects(db.query("update club_pilot_memberships set plan='plus'"),/permission denied/);
 await assert.rejects(db.query('delete from club_pilot_memberships'),/permission denied/);
 await assert.rejects(db.query("insert into club_pilot_memberships values($1,'plus',now(),now()+interval '7 days',now())",[ids.ordinary]),/permission denied/);
 await asUser(ids.admin);assert.equal((await db.query('select user_id from club_pilot_memberships')).rows.length,3);
});
test('anonymous and identity-less calls have no pilot access',async()=>{
 await asUser('','anon');await assert.rejects(db.query('select * from club_pilot_memberships'),/permission denied/);
 await asUser('');assert.deepEqual(await access(),{club:false,premium:false});
});
test('blocked, unconfirmed, deleted or anonymous identities cannot use pilot grants',async()=>{
 for(const change of ["banned_until=now()+interval '1 day'",'email_confirmed_at=null','deleted_at=now()','is_anonymous=true']){
  await db.query(`update auth.users set ${change} where id=$1`,[ids.plus]);
  await asUser(ids.plus);assert.deepEqual(await access(),{club:false,premium:false});
  await db.exec('reset role');await db.query('update auth.users set banned_until=null,email_confirmed_at=now(),deleted_at=null,is_anonymous=false where id=$1',[ids.plus]);
 }
});
test('admin access and null argument behavior remain unchanged',async()=>{
 await asUser(ids.admin);assert.deepEqual(await access(),{club:true,premium:true});
 assert.equal((await db.query('select nh_access.has_paid_access(null) as granted')).rows[0].granted,false);
});
test('grant duration and plan values are constrained',async()=>{
 await assert.rejects(db.query("update club_pilot_memberships set expires_at=starts_at+interval '31 days'"),/check constraint/);
 await assert.rejects(db.query("update club_pilot_memberships set plan='admin'"),/check constraint/);
});
