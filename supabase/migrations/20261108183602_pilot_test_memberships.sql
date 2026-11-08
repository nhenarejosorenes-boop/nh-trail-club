-- Test subscriptions are temporary entitlements, not payments or commercial requests.
create table public.club_pilot_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check(plan in ('basic','plus','plus_performance')),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check(expires_at>starts_at and expires_at<=starts_at+interval '30 days')
);
alter table public.club_pilot_memberships enable row level security;
revoke all on public.club_pilot_memberships from public, anon, authenticated;
grant select on public.club_pilot_memberships to authenticated;
create policy pilot_membership_read on public.club_pilot_memberships for select to authenticated
using(user_id=(select auth.uid()) or exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));

-- Test accounts cannot accidentally generate ordinary commercial requests.
create policy no_pilot_commercial_requests on public.club_subscription_requests
as restrictive for insert to authenticated
with check(not exists(select 1 from public.club_pilot_memberships p where p.user_id=club_subscription_requests.user_id));

create or replace function nh_access.has_paid_access(p_require_premium boolean)
returns boolean language plpgsql stable security definer set search_path='' as $fn$
declare caller uuid := (select auth.uid());
begin
  if caller is null or p_require_premium is null then return false; end if;
  if exists(select 1 from public.profiles where id=caller and role='admin') then return true; end if;
  if exists(
    select 1 from public.club_pilot_memberships m
    join public.profiles p on p.id=m.user_id and p.role='athlete'
    join auth.users u on u.id=m.user_id
    where m.user_id=caller and m.starts_at<=now() and m.expires_at>now()
      and (not p_require_premium or m.plan in ('plus','plus_performance'))
      and u.email_confirmed_at is not null and u.deleted_at is null and not u.is_anonymous
      and (u.banned_until is null or u.banned_until<=now())
  ) then return true; end if;
  return exists(
    select 1 from public.club_subscription_requests s
    join public.club_subscription_monthly_dues d on d.subscription_id=s.id
    where s.user_id=caller and s.status='approved' and s.plan in ('basic','plus','plus_performance')
      and (not p_require_premium or s.plan in ('plus','plus_performance'))
      and d.status='paid' and d.amount_eur>0
      and d.period_month=date_trunc('month',now() at time zone 'Europe/Madrid')::date
  );
end;
$fn$;
revoke all on function nh_access.has_paid_access(boolean) from public, anon;
grant execute on function nh_access.has_paid_access(boolean) to authenticated;
