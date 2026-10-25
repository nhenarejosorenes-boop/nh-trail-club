-- NH Trail Club: planificación semanal individual
create table if not exists public.weekly_training_plan (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  session_date date not null,
  category text not null check (category in ('fuerza','trail','descanso','movilidad')),
  title text not null,
  details text not null default '',
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists weekly_training_plan_athlete_date_idx
  on public.weekly_training_plan (athlete_id, session_date);
alter table public.weekly_training_plan enable row level security;
drop policy if exists "athletes_read_own_training" on public.weekly_training_plan;
create policy "athletes_read_own_training" on public.weekly_training_plan
  for select to authenticated using (
    athlete_id = (select auth.uid())
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
drop policy if exists "admins_manage_training" on public.weekly_training_plan;
create policy "admins_manage_training" on public.weekly_training_plan
  for all to authenticated using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  ) with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
drop policy if exists "athletes_mark_own_training" on public.weekly_training_plan;
-- Completion is performed by an RPC so athletes cannot change prescribed content.
create or replace function public.mark_training_completed(p_id uuid, p_completed boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.weekly_training_plan
  set completed = p_completed
  where id = p_id and athlete_id = (select auth.uid());
  if not found then
    raise exception 'Sesión no encontrada o sin permisos';
  end if;
end;
$$;
revoke all on function public.mark_training_completed(uuid,boolean) from public, anon;
grant execute on function public.mark_training_completed(uuid,boolean) to authenticated;
