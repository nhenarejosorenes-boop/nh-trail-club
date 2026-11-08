-- No account is linked during installation. All operations require a current admin.
create schema nh_accounts;
revoke all on schema nh_accounts from public, anon;
grant usage on schema nh_accounts to authenticated;

-- Already present in production; retain the same invariant in clean environments.
create unique index if not exists deportistas_user_id_unique on public.deportistas(user_id);

create table nh_accounts.link_events (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null,
  user_id uuid not null,
  actor_id uuid not null,
  linked_at timestamptz not null default now()
);
alter table nh_accounts.link_events enable row level security;
revoke all on nh_accounts.link_events from public, anon, authenticated;

-- Needs definer only to read the confirmed Auth email and record the link atomically.
-- Keep the privileged implementation outside the exposed Data API schema.
create function nh_accounts.account_link_operation(
  p_card_id uuid, p_email text, p_user_id uuid, p_commit boolean
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  caller uuid := (select auth.uid());
  card public.deportistas%rowtype;
  candidate record;
  email_key text := lower(btrim(p_email));
begin
  if caller is null or not exists (
    select 1 from public.profiles where id=caller and role='admin'
  ) then raise exception 'ACCOUNT_LINK_ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_card_id is null or email_key is null or length(email_key)>254
     or email_key !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or p_commit is null or (p_commit and p_user_id is null)
  then raise exception 'ACCOUNT_LINK_INVALID_INPUT' using errcode='22023'; end if;

  select * into card from public.deportistas where id=p_card_id for update;
  if not found then raise exception 'ACCOUNT_LINK_CARD_MISSING'; end if;
  if lower(btrim(coalesce(card.email,'')))<>email_key then
    raise exception 'ACCOUNT_LINK_EMAIL_CHANGED';
  end if;
  if card.user_id is not null and (not p_commit or card.user_id is distinct from p_user_id) then
    raise exception 'ACCOUNT_LINK_CARD_ALREADY_LINKED';
  end if;

  begin
    select u.id,u.email,p.full_name into strict candidate
    from auth.users u join public.profiles p on p.id=u.id
    where lower(btrim(u.email))=email_key and u.email_confirmed_at is not null
      and u.deleted_at is null and not u.is_anonymous
      and (u.banned_until is null or u.banned_until<=now())
      and p.role='athlete'
    for share of u,p;
  exception
    when no_data_found then raise exception 'ACCOUNT_LINK_NO_ELIGIBLE_ACCOUNT';
    when too_many_rows then raise exception 'ACCOUNT_LINK_AMBIGUOUS_ACCOUNT';
  end;
  if p_commit and candidate.id is distinct from p_user_id then
    raise exception 'ACCOUNT_LINK_ACCOUNT_CHANGED';
  end if;
  if exists(select 1 from public.deportistas where user_id=candidate.id and id<>p_card_id) then
    raise exception 'ACCOUNT_LINK_ACCOUNT_IN_USE';
  end if;

  if p_commit and card.user_id is null then
    begin
      update public.deportistas set user_id=candidate.id where id=p_card_id and user_id is null;
    exception when unique_violation then raise exception 'ACCOUNT_LINK_ACCOUNT_IN_USE';
    end;
    insert into nh_accounts.link_events(card_id,user_id,actor_id) values(p_card_id,candidate.id,caller);
  end if;
  return jsonb_build_object('card_id',card.id,'user_id',candidate.id,'email',candidate.email,
    'full_name',candidate.full_name,'linked',p_commit);
end;
$fn$;
revoke all on function nh_accounts.account_link_operation(uuid,text,uuid,boolean) from public, anon;
grant execute on function nh_accounts.account_link_operation(uuid,text,uuid,boolean) to authenticated;

create function public.preview_athlete_account_link(p_card_id uuid,p_email text)
returns jsonb language sql security invoker set search_path='' as $fn$
  select nh_accounts.account_link_operation(p_card_id,p_email,null,false);
$fn$;
create function public.confirm_athlete_account_link(p_card_id uuid,p_email text,p_user_id uuid)
returns jsonb language sql security invoker set search_path='' as $fn$
  select nh_accounts.account_link_operation(p_card_id,p_email,p_user_id,true);
$fn$;
revoke all on function public.preview_athlete_account_link(uuid,text) from public, anon;
revoke all on function public.confirm_athlete_account_link(uuid,text,uuid) from public, anon;
grant execute on function public.preview_athlete_account_link(uuid,text) to authenticated;
grant execute on function public.confirm_athlete_account_link(uuid,text,uuid) to authenticated;
