import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const admin = '11111111-1111-4111-8111-111111111111';
const athlete = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const card = '44444444-4444-4444-8444-444444444444';
const second = '55555555-5555-4555-8555-555555555555';
const db = new PGlite();
before(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
    $$;
    grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz,is_anonymous boolean not null default false);
    create table public.profiles(id uuid primary key,role text,full_name text);
    create table public.deportistas(id uuid primary key,nombre text not null,email text,user_id uuid references auth.users(id));
    alter table public.profiles enable row level security;
    alter table public.deportistas enable row level security;
    grant select on public.profiles,public.deportistas to authenticated;
    grant update on public.deportistas to authenticated;
    create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
    create policy card_read on public.deportistas for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.profiles where id=auth.uid() and role='admin'));
    create policy card_update on public.deportistas for update to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and role='admin')) with check(exists(select 1 from public.profiles where id=auth.uid() and role='admin'));
  `);
  await db.exec(readFileSync(new URL('../migrations/20261108175452_athlete_account_linking.sql', import.meta.url), 'utf8'));
});
after(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false);
    truncate public.deportistas,public.profiles,auth.users,nh_accounts.link_events;
    insert into auth.users(id,email,email_confirmed_at) values('${admin}','admin@example.test',now()),('${athlete}','Runner@example.test',now()),('${other}','other@example.test',now());
    insert into public.profiles values('${admin}','admin','Administrador'),('${athlete}','athlete','Corredor'),('${other}','athlete','Otro');
    insert into public.deportistas(id,nombre,email) values('${card}','Ficha','runner@example.test'),('${second}','Otra ficha','runner@example.test');`);
});
async function asUser(id, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`set role ${role}`);
}
async function preview(id = card, email = 'runner@example.test') {
  const r = await db.query('select public.preview_athlete_account_link($1,$2) as value', [id,email]);
  return r.rows[0].value;
}
async function confirm(id = card, email = 'runner@example.test', user = athlete) {
  const r = await db.query('select public.confirm_athlete_account_link($1,$2,$3) as value', [id,email,user]);
  return r.rows[0].value;
}
async function ownerQuery(sql, values) { await db.exec('reset role'); return db.query(sql, values); }

test('preview uses the confirmed Auth email and does not link or audit', async () => {
  await asUser(admin);
  assert.deepEqual(await preview(card,'  RUNNER@example.test '), {card_id:card,user_id:athlete,email:'Runner@example.test',full_name:'Corredor',linked:false});
  const state = await ownerQuery('select (select user_id from deportistas where id=$1) as user_id,(select count(*)::int from nh_accounts.link_events) as events',[card]);
  assert.deepEqual(state.rows[0],{user_id:null,events:0});
});
test('confirmation links exactly the reviewed account and records its actor once', async () => {
  await asUser(admin);
  assert.equal((await confirm()).linked,true);
  assert.equal((await confirm()).linked,true);
  const result = await ownerQuery('select card_id,user_id,actor_id from nh_accounts.link_events');
  assert.deepEqual(result.rows,[{card_id:card,user_id:athlete,actor_id:admin}]);
});
test('anonymous callers cannot execute the API', async () => {
  await asUser('', 'anon');
  await assert.rejects(preview(), /permission denied/);
  await assert.rejects(confirm(), /permission denied/);
});
test('ordinary athletes and missing identities cannot enumerate or link accounts', async () => {
  for (const id of [athlete, '']) {
    await asUser(id);
    await assert.rejects(preview(), /ACCOUNT_LINK_ADMIN_REQUIRED/);
    await assert.rejects(confirm(), /ACCOUNT_LINK_ADMIN_REQUIRED/);
    await assert.rejects(db.query('select nh_accounts.account_link_operation($1,$2,$3,true)',[card,'runner@example.test',athlete]), /ACCOUNT_LINK_ADMIN_REQUIRED/);
  }
});
test('caller role changes take effect immediately', async () => {
  await db.query("update public.profiles set role='athlete' where id=$1",[admin]);
  await asUser(admin);
  await assert.rejects(preview(), /ACCOUNT_LINK_ADMIN_REQUIRED/);
});
test('an unconfirmed email cannot be used', async () => {
  await db.query('update auth.users set email_confirmed_at=null where id=$1',[athlete]);
  await asUser(admin);
  await assert.rejects(preview(), /ACCOUNT_LINK_NO_ELIGIBLE_ACCOUNT/);
  await assert.rejects(confirm(), /ACCOUNT_LINK_NO_ELIGIBLE_ACCOUNT/);
});
test('banned, deleted, anonymous and administrator accounts are ineligible', async () => {
  for (const change of ["banned_until=now()+interval '1 day'",'deleted_at=now()','is_anonymous=true']) {
    await db.query(`update auth.users set ${change} where id=$1`,[athlete]);
    await asUser(admin);
    await assert.rejects(preview(), /ACCOUNT_LINK_NO_ELIGIBLE_ACCOUNT/);
    await db.exec('reset role');
    await db.query('update auth.users set banned_until=null,deleted_at=null,is_anonymous=false where id=$1',[athlete]);
  }
  await db.query("update profiles set role='admin' where id=$1",[athlete]);
  await asUser(admin);
  await assert.rejects(preview(), /ACCOUNT_LINK_NO_ELIGIBLE_ACCOUNT/);
});
test('profile email or a missing profile never substitutes for confirmed Auth identity', async () => {
  await db.query('delete from profiles where id=$1',[athlete]);
  await asUser(admin);
  await assert.rejects(preview(), /ACCOUNT_LINK_NO_ELIGIBLE_ACCOUNT/);
});
test('duplicate matching Auth identities fail closed', async () => {
  await db.query("update auth.users set email='runner@example.test' where id=$1",[other]);
  await asUser(admin);
  await assert.rejects(preview(), /ACCOUNT_LINK_AMBIGUOUS_ACCOUNT/);
});
test('missing, invalid and changed card context is rejected', async () => {
  await asUser(admin);
  await assert.rejects(preview(other), /ACCOUNT_LINK_CARD_MISSING/);
  await assert.rejects(preview(card,''), /ACCOUNT_LINK_INVALID_INPUT/);
  await assert.rejects(preview(card,'other@example.test'), /ACCOUNT_LINK_EMAIL_CHANGED/);
  await assert.rejects(confirm(card,'runner@example.test',null), /ACCOUNT_LINK_INVALID_INPUT/);
});
test('a candidate change after preview cannot link a different account', async () => {
  await asUser(admin); await preview();
  await db.exec('reset role');
  await db.query("update auth.users set email='old@example.test' where id=$1",[athlete]);
  await db.query("update auth.users set email='runner@example.test' where id=$1",[other]);
  await asUser(admin);
  await assert.rejects(confirm(), /ACCOUNT_LINK_ACCOUNT_CHANGED/);
});
test('linking cannot overwrite an existing account or reuse an account on another card', async () => {
  await asUser(admin); await confirm();
  await assert.rejects(preview(), /ACCOUNT_LINK_CARD_ALREADY_LINKED/);
  await assert.rejects(confirm(card,'runner@example.test',other), /ACCOUNT_LINK_CARD_ALREADY_LINKED/);
  await assert.rejects(preview(second), /ACCOUNT_LINK_ACCOUNT_IN_USE/);
  await assert.rejects(confirm(second), /ACCOUNT_LINK_ACCOUNT_IN_USE/);
});
test('database uniqueness blocks duplicate direct writes too', async () => {
  await asUser(admin); await confirm();
  await assert.rejects(db.query('update deportistas set user_id=$1 where id=$2',[athlete,second]), /duplicate key/);
});
test('link and audit are atomic when audit insertion fails', async () => {
  await db.exec("alter table nh_accounts.link_events add constraint test_audit_failure check(false)");
  try {
    await asUser(admin);
    await assert.rejects(confirm(), /test_audit_failure/);
    const result = await ownerQuery('select user_id from deportistas where id=$1',[card]);
    assert.equal(result.rows[0].user_id,null);
  } finally { await db.exec('reset role; alter table nh_accounts.link_events drop constraint test_audit_failure'); }
});
test('the link does not grant another athlete access to a card or expose audit records', async () => {
  await asUser(admin); await confirm();
  await asUser(athlete);
  assert.deepEqual((await db.query('select id from deportistas')).rows,[{id:card}]);
  await assert.rejects(db.query('select * from nh_accounts.link_events'), /permission denied/);
  await asUser(other);
  assert.equal((await db.query('select id from deportistas')).rows.length,0);
  assert.equal((await db.query('update deportistas set user_id=$1 where id=$2 returning id',[other,card])).rows.length,0);
});
test('only private helpers have definer rights and all functions fix search_path', async () => {
  const result=await db.query("select n.nspname,p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='nh_accounts' or p.proname in ('preview_athlete_account_link','confirm_athlete_account_link')");
  assert.equal(result.rows.length,3);
  for (const fn of result.rows) {
    assert.equal(fn.prosecdef,fn.nspname==='nh_accounts');
    assert.ok(fn.proconfig.some(value=>value.startsWith('search_path=')));
  }
});
