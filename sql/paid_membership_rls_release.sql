-- STAGED ONLY: apply during the coordinated release, not before the UI is deployed.
-- RLS restrictive policies are AND-ed with existing permissive policies.
-- A member is active only if an approved subscription has a paid due for the current calendar month.
-- Admins retain access to club operations regardless of personal dues.
create or replace function public.nh_member_paid_for_current_month(p_user_id uuid)
returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.club_subscription_requests s
    join public.club_subscription_monthly_dues d on d.subscription_id = s.id
    where s.user_id = p_user_id
      and s.status = 'approved'
      and d.status = 'paid'
      and d.period_month = date_trunc('month', current_date)::date
  );
$$;
revoke all on function public.nh_member_paid_for_current_month(uuid) from public, anon;
grant execute on function public.nh_member_paid_for_current_month(uuid) to authenticated;
-- Use auth.uid() as the only caller-controlled identity; never accept a client-supplied user ID in policies.
drop policy if exists nh_paid_activities_read on public.club_activities;
create policy nh_paid_activities_read on public.club_activities
as restrictive for select to authenticated
using (
  exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role='admin')
  or (select public.nh_member_paid_for_current_month((select auth.uid())))
);
drop policy if exists nh_paid_training_read on public.weekly_training_plan;
create policy nh_paid_training_read on public.weekly_training_plan
as restrictive for select to authenticated
using (
  exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role='admin')
  or (select public.nh_member_paid_for_current_month((select auth.uid())))
);
drop policy if exists nh_paid_registration_read on public.activity_registrations;
create policy nh_paid_registration_read on public.activity_registrations
as restrictive for select to authenticated
using (
  exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role='admin')
  or (select public.nh_member_paid_for_current_month((select auth.uid())))
);
drop policy if exists nh_paid_registration_insert on public.activity_registrations;
create policy nh_paid_registration_insert on public.activity_registrations
as restrictive for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select public.nh_member_paid_for_current_month((select auth.uid())))
);
-- Subscription requests and own dues stay readable while unpaid.
-- Review other sports-data tables before enabling paid access in production.

-- Harden callable functions before enabling paid access.
-- Trigger functions do not require direct EXECUTE grants for normal trigger execution.
revoke execute on function public.controlar_plazas() from public, anon, authenticated;
-- A SECURITY DEFINER function can bypass RLS. Enforce authorization inside each RPC.
create or replace function public.obtener_plazas_actividad(p_activity_id uuid)
returns table(inscritos bigint, plazas_disponibles bigint)
language sql stable security definer set search_path = ''
as $$
  select count(r.id)::bigint,
         case when a.max_participants is null then null
              else greatest(a.max_participants::bigint - count(r.id), 0) end
  from public.club_activities a
  left join public.activity_registrations r on r.activity_id = a.id
  where a.id = p_activity_id
    and (
      exists (select 1 from public.profiles p
              where p.id = (select auth.uid()) and p.role = 'admin')
      or public.nh_member_paid_for_current_month((select auth.uid()))
    )
  group by a.id, a.max_participants;
$$;
revoke execute on function public.obtener_plazas_actividad(uuid) from public, anon;
grant execute on function public.obtener_plazas_actividad(uuid) to authenticated;

create or replace function public.mark_training_completed(p_id uuid, p_completed boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Debes iniciar sesion';
  end if;
  if not (
    exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
    or public.nh_member_paid_for_current_month((select auth.uid()))
  ) then
    raise exception 'Cuota del mes sin verificar';
  end if;
  update public.weekly_training_plan
  set completed = p_completed
  where id = p_id and (
    athlete_id = (select auth.uid())
    or exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
  if not found then raise exception 'Sesion no encontrada o sin permisos'; end if;
end;
$$;
revoke execute on function public.mark_training_completed(uuid, boolean) from public, anon;
grant execute on function public.mark_training_completed(uuid, boolean) to authenticated;
