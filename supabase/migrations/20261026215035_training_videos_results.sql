-- Preserve existing plan permissions and allow optional, canonical video links.
create function public.training_video_url_valid(value text) returns boolean
language sql immutable security invoker set search_path='' as $$
  select value is not null and (value='' or value ~ '^https://www[.]youtube[.]com/watch[?]v=[A-Za-z0-9_-]{11}$' or value ~ '^https://vimeo[.]com/[0-9]{1,12}$');
$$;
revoke all on function public.training_video_url_valid(text) from public,anon;
grant execute on function public.training_video_url_valid(text) to authenticated,service_role;
create or replace function public.training_structure_valid(p jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare b jsonb; i jsonb; key text; lim integer; seen text[]:='{}'; ids text[];
begin
  if p is null then return true; end if;
  if jsonb_typeof(p)<>'object' or p->>'version' is distinct from '1' or jsonb_typeof(p->'version')<>'number'
    or octet_length(p::text)>131072 or jsonb_typeof(p->'notes') is distinct from 'string' or char_length(p->>'notes')>6000
    or jsonb_typeof(p->'targets') is distinct from 'object' or jsonb_typeof(p->'blocks') is distinct from 'array' then return false; end if;
  if jsonb_array_length(p->'blocks')<>3 then return false; end if;
  foreach key in array array['distance','elevation','minutes','effort'] loop
    if jsonb_typeof(p->'targets'->key) is distinct from 'string' or char_length(p->'targets'->>key)>12 then return false; end if;
    if (p->'targets'->>key)<>'' then
      if (p->'targets'->>key)!~ '^\d+(\.\d+)?$' then return false; end if;
      if key='distance' and (p->'targets'->>key)::numeric not between 0 and 500 then return false; end if;
      if key='elevation' and ((p->'targets'->>key)::numeric not between 0 and 30000 or mod((p->'targets'->>key)::numeric,1)<>0) then return false; end if;
      if key='minutes' and ((p->'targets'->>key)::numeric not between 1 and 10080 or mod((p->'targets'->>key)::numeric,1)<>0) then return false; end if;
      if key='effort' and ((p->'targets'->>key)::numeric not between 1 and 10 or mod((p->'targets'->>key)::numeric,1)<>0) then return false; end if;
    end if;
  end loop;
  for b in select value from jsonb_array_elements(p->'blocks') loop
    if jsonb_typeof(b)<>'object' or b->>'stage' is null or b->>'stage' not in ('warmup','main','cooldown') or b->>'stage'=any(seen) or jsonb_typeof(b->'items') is distinct from 'array' then return false; end if;
    seen:=array_append(seen,b->>'stage');ids:='{}';
    if jsonb_array_length(b->'items')>30 then return false; end if;
    for i in select value from jsonb_array_elements(b->'items') loop
      if jsonb_typeof(i)<>'object' then return false; end if;
      foreach key in array array['id','name','sets','reps','weight','rest','duration','intensity','notes'] loop
        lim:=case key when 'id' then 80 when 'name' then 120 when 'sets' then 4 when 'reps' then 40 when 'weight' then 20 when 'rest' then 10 when 'duration' then 60 when 'intensity' then 80 else 1000 end;
        if jsonb_typeof(i->key) is distinct from 'string' or char_length(i->>key)>lim then return false; end if;
      end loop;
      if i ? 'videoUrl' and (jsonb_typeof(i->'videoUrl') is distinct from 'string' or not public.training_video_url_valid(i->>'videoUrl')) then return false; end if;
      if btrim(i->>'id')='' or btrim(i->>'name')='' or i->>'id'=any(ids) then return false; end if;
      ids:=array_append(ids,i->>'id');
      foreach key in array array['sets','weight','rest'] loop
        if (i->>key)<>'' then
          if (i->>key)!~ '^\d+(\.\d+)?$' then return false; end if;
          if key='sets' and ((i->>key)::numeric not between 1 and 30 or mod((i->>key)::numeric,1)<>0) then return false; end if;
          if key='weight' and (i->>key)::numeric not between 0 and 1000 then return false; end if;
          if key='rest' and ((i->>key)::numeric not between 0 and 3600 or mod((i->>key)::numeric,1)<>0) then return false; end if;
        end if;
      end loop;
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;
create table public.training_exercise_library (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text not null check (category in ('fuerza','trail','movilidad','descanso')),
  video_url text not null default '' check (public.training_video_url_valid(video_url)),
  notes text not null default '' check (char_length(notes)<=1000),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create unique index training_exercise_library_name_category on public.training_exercise_library(lower(btrim(name)),category);
create index training_exercise_library_creator on public.training_exercise_library(created_by);
alter table public.training_exercise_library enable row level security;
revoke all on public.training_exercise_library from public,anon,authenticated;
grant select,insert on public.training_exercise_library to authenticated;
create policy exercise_library_admin_read on public.training_exercise_library for select to authenticated
  using (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create policy exercise_library_admin_insert on public.training_exercise_library for insert to authenticated
  with check (created_by=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));

create function public.training_result_entries_valid(entries jsonb,prescription jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare e jsonb; b jsonb; expected integer:=0; seen text[]:='{}'; k text; matched boolean;
begin
  if entries is null or jsonb_typeof(entries)<>'array' or octet_length(entries::text)>131072 then return false; end if;
  if prescription is not null then
    if not public.training_structure_valid(prescription) then return false; end if;
    for b in select value from jsonb_array_elements(prescription->'blocks') loop expected:=expected+jsonb_array_length(b->'items'); end loop;
  end if;
  if jsonb_array_length(entries)<>expected then return false; end if;
  for e in select value from jsonb_array_elements(entries) loop
    if jsonb_typeof(e)<>'object' or jsonb_typeof(e->'completed') is distinct from 'boolean' then return false; end if;
    foreach k in array array['stage','id','sets','reps','weight','notes'] loop
      if jsonb_typeof(e->k) is distinct from 'string' then return false; end if;
    end loop;
    if char_length(e->>'id')>80 or char_length(e->>'sets')>2 or char_length(e->>'reps')>40 or char_length(e->>'weight')>20 or char_length(e->>'notes')>500 then return false; end if;
    k:=(e->>'stage')||':'||(e->>'id');if k=any(seen) then return false; end if;seen:=array_append(seen,k);
    select exists(select 1 from jsonb_array_elements(prescription->'blocks') block,
      lateral jsonb_array_elements(block->'items') item where block->>'stage'=e->>'stage' and item->>'id'=e->>'id') into matched;
    if not matched then return false; end if;
    if e->>'sets'<>'' and (e->>'sets'!~ '^[0-9]+$' or (e->>'sets')::numeric not between 0 and 30) then return false; end if;
    if e->>'weight'<>'' and (e->>'weight'!~ '^[0-9]+([.][0-9]+)?$' or (e->>'weight')::numeric not between 0 and 1000) then return false; end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;
revoke all on function public.training_result_entries_valid(jsonb,jsonb) from public,anon;
grant execute on function public.training_result_entries_valid(jsonb,jsonb) to authenticated,service_role;

create table public.training_session_results (
  session_id uuid primary key references public.weekly_training_plan(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id),
  prescription jsonb,
  entries jsonb not null default '[]',
  effort smallint check (effort between 1 and 10),
  sensations text not null default '' check (char_length(sensations)<=2000),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_result_entries_valid check (public.training_result_entries_valid(entries,prescription))
);
create index training_session_results_athlete on public.training_session_results(athlete_id);
alter table public.training_session_results enable row level security;
revoke all on public.training_session_results from public,anon,authenticated;
grant select,insert,update on public.training_session_results to authenticated;
create policy results_participant_read on public.training_session_results for select to authenticated
  using (exists(select 1 from public.weekly_training_plan p where p.id=session_id and p.athlete_id=training_session_results.athlete_id));
create policy results_owner_insert on public.training_session_results for insert to authenticated
  with check (athlete_id=(select auth.uid()) and exists(select 1 from public.weekly_training_plan p where p.id=session_id and p.athlete_id=(select auth.uid())));
create policy results_owner_update on public.training_session_results for update to authenticated
  using (athlete_id=(select auth.uid()) and exists(select 1 from public.weekly_training_plan p where p.id=session_id and p.athlete_id=(select auth.uid())))
  with check (athlete_id=(select auth.uid()) and exists(select 1 from public.weekly_training_plan p where p.id=session_id and p.athlete_id=(select auth.uid())));

-- Invoker trigger: parent visibility is checked with the caller's existing RLS.
create function public.protect_training_result() returns trigger
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid; original jsonb;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para guardar resultados' using errcode='42501'; end if;
  select athlete_id,structure into owner_id,original from public.weekly_training_plan where id=new.session_id;
  if not found or owner_id<>auth.uid() or new.athlete_id<>auth.uid() then raise exception 'Solo el deportista puede registrar sus resultados' using errcode='42501'; end if;
  if tg_op='UPDATE' then
    if new.session_id<>old.session_id or new.athlete_id<>old.athlete_id then raise exception 'No se puede cambiar la sesión de los resultados' using errcode='42501'; end if;
    new.prescription:=old.prescription;new.created_at:=old.created_at;new.revision:=old.revision+1;
  else
    new.prescription:=original;new.created_at:=now();new.revision:=1;
  end if;
  new.updated_at:=now();return new;
end;
$$;
revoke all on function public.protect_training_result() from public,anon,authenticated;
create trigger protect_training_result before insert or update on public.training_session_results
  for each row execute function public.protect_training_result();
