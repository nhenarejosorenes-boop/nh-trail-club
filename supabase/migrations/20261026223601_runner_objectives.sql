-- Goal-centred coaching. Legacy objetivos_deportivos data/policies remain unchanged.
create table public.runner_goals (
 id uuid primary key default gen_random_uuid(), athlete_id uuid not null references public.profiles(id),
 title text not null check(char_length(btrim(title)) between 1 and 160),
 goal_type text not null check(goal_type in ('race','consistency','distance','performance')),
 priority text not null check(priority in ('finish','improve','compete','consistency')),
 starts_on date not null,target_date date not null,check(starts_on<=target_date),
 distance_km numeric check(distance_km between 0 and 1000),elevation_m integer check(elevation_m between 0 and 100000),
 terrain text not null default '' check(char_length(terrain)<=200),experience text not null default '' check(char_length(experience)<=1000),
 baseline text not null default '' check(char_length(baseline)<=2000),available_days integer not null check(available_days between 1 and 7),
 weekly_minutes integer check(weekly_minutes between 1 and 10080),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','completed','archived')),
 revision integer not null default 1,created_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index runner_goals_one_active on public.runner_goals(athlete_id) where status='active';
create index runner_goals_athlete_date on public.runner_goals(athlete_id,target_date desc,id);
create index runner_goals_created_by on public.runner_goals(created_by);
alter table public.runner_goals enable row level security;
revoke all on public.runner_goals from public,anon,authenticated;
grant select,insert,update on public.runner_goals to authenticated;
create policy goal_owner_read on public.runner_goals for select to authenticated using(athlete_id=(select auth.uid()));
create policy goal_admin_manage on public.runner_goals for all to authenticated
 using(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'))
 with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create policy goal_paid_gate on public.runner_goals as restrictive for all to authenticated using((select nh_access.has_paid_access(true))) with check((select nh_access.has_paid_access(true)));

create table public.runner_goal_phases (
 id uuid primary key default gen_random_uuid(),goal_id uuid not null references public.runner_goals(id) on delete cascade,
 phase_type text not null check(phase_type in ('base','development','specific','approach','recovery')),
 starts_on date not null,ends_on date not null,check(starts_on<=ends_on),focus text not null check(char_length(btrim(focus)) between 1 and 1000),active boolean not null default true,
 revision integer not null default 1,created_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index runner_goal_phases_goal on public.runner_goal_phases(goal_id,starts_on,id);
create index runner_goal_phases_creator on public.runner_goal_phases(created_by);
alter table public.runner_goal_phases enable row level security;
revoke all on public.runner_goal_phases from public,anon,authenticated;
grant select,insert,update on public.runner_goal_phases to authenticated;
create policy phases_goal_read on public.runner_goal_phases for select to authenticated using(exists(select 1 from public.runner_goals where id=goal_id));
create policy phases_admin_manage on public.runner_goal_phases for all to authenticated
 using(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin') and exists(select 1 from public.runner_goals where id=goal_id))
 with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin') and exists(select 1 from public.runner_goals where id=goal_id));

create table public.runner_goal_reviews (
 id uuid primary key default gen_random_uuid(),goal_id uuid not null references public.runner_goals(id) on delete cascade,
 week_start date not null check(extract(isodow from week_start)=1),summary text not null check(char_length(btrim(summary)) between 1 and 2000),
 decision text not null check(decision in ('maintain','adjust','recover')),next_focus text not null check(char_length(btrim(next_focus)) between 1 and 2000),
 revision integer not null default 1,created_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(goal_id,week_start)
);
create index runner_goal_reviews_creator on public.runner_goal_reviews(created_by);
alter table public.runner_goal_reviews enable row level security;
revoke all on public.runner_goal_reviews from public,anon,authenticated;
grant select,insert,update on public.runner_goal_reviews to authenticated;
create policy reviews_goal_read on public.runner_goal_reviews for select to authenticated using(exists(select 1 from public.runner_goals where id=goal_id));
create policy reviews_admin_manage on public.runner_goal_reviews for all to authenticated
 using(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin') and exists(select 1 from public.runner_goals where id=goal_id))
 with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin') and exists(select 1 from public.runner_goals where id=goal_id));

create function public.protect_runner_coaching_record() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Solo el entrenador puede modificar la preparación' using errcode='42501';end if;
 if tg_op='UPDATE' then
  if new.id<>old.id then raise exception 'Identidad inmutable' using errcode='42501';end if;
  if tg_table_name='runner_goals' then
   if new.athlete_id<>old.athlete_id then raise exception 'No se puede reasignar el objetivo' using errcode='42501';end if;
  else
   if new.goal_id<>old.goal_id then raise exception 'No se puede reasignar la preparación' using errcode='42501';end if;
   if tg_table_name='runner_goal_reviews' then
    if new.week_start<>old.week_start then raise exception 'No se puede cambiar la semana de la revisión' using errcode='42501';end if;
   end if;
  end if;
  new.created_at:=old.created_at;new.created_by:=old.created_by;new.revision:=old.revision+1;
 else new.created_at:=now();new.created_by:=auth.uid();new.revision:=1;
 end if;
 new.updated_at:=now();
 if tg_table_name='runner_goal_phases' then
  perform 1 from public.runner_goals where id=new.goal_id for update;
  if not found then raise exception 'Objetivo no disponible' using errcode='42501';end if;
  if new.active and exists(select 1 from public.runner_goal_phases p where p.goal_id=new.goal_id and p.active and p.id<>new.id and p.starts_on<=new.ends_on and p.ends_on>=new.starts_on) then
   raise exception 'Las etapas activas no pueden solaparse. Revisa sus fechas.' using errcode='22023';
  end if;
 end if;
 return new;
end;
$$;
revoke all on function public.protect_runner_coaching_record() from public,anon,authenticated;
create trigger protect_runner_goal before insert or update on public.runner_goals for each row execute function public.protect_runner_coaching_record();
create trigger protect_runner_phase before insert or update on public.runner_goal_phases for each row execute function public.protect_runner_coaching_record();
create trigger protect_runner_review before insert or update on public.runner_goal_reviews for each row execute function public.protect_runner_coaching_record();

alter table public.weekly_training_plan add column goal_id uuid references public.runner_goals(id);
alter table public.weekly_training_plan add column purpose text not null default '' check(char_length(purpose)<=1000);
alter table public.weekly_training_plan add constraint linked_plan_purpose_required check(goal_id is null or char_length(btrim(purpose))>0);
create index weekly_training_plan_goal on public.weekly_training_plan(goal_id,session_date);
create function public.validate_training_goal_link() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.goal_id is not null and not exists(select 1 from public.runner_goals g where g.id=new.goal_id and g.athlete_id=new.athlete_id) then raise exception 'El objetivo no pertenece al deportista de esta sesión' using errcode='42501';end if;
 return new;
end;
$$;
revoke all on function public.validate_training_goal_link() from public,anon,authenticated;
create trigger validate_training_goal_link before insert or update on public.weekly_training_plan for each row execute function public.validate_training_goal_link();
