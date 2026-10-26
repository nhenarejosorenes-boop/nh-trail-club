-- Add structured prescriptions without changing existing training ownership/payment policies.
create function public.training_structure_valid(p jsonb) returns boolean
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
revoke all on function public.training_structure_valid(jsonb) from public,anon;
grant execute on function public.training_structure_valid(jsonb) to authenticated,service_role;
alter table public.weekly_training_plan add column structure jsonb;
alter table public.weekly_training_plan add constraint weekly_training_structure_valid check (public.training_structure_valid(structure));
create table public.training_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  category text not null check (category in ('fuerza','trail','movilidad','descanso')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  structure jsonb not null check (public.training_structure_valid(structure)),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create index training_templates_name_id on public.training_templates(name,id);
create index training_templates_created_by on public.training_templates(created_by);
alter table public.training_templates enable row level security;
revoke all on public.training_templates from public,anon,authenticated;
grant select,insert on public.training_templates to authenticated;
create policy templates_admin_read on public.training_templates for select to authenticated
  using (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create policy templates_admin_create on public.training_templates for insert to authenticated
  with check (created_by=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
