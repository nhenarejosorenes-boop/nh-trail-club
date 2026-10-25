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
