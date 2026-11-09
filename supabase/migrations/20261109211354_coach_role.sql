-- Dedicated coaching role. No existing account is promoted by this migration.
create schema nh_staff;
revoke all on schema nh_staff from public,anon;
grant usage on schema nh_staff to authenticated,service_role;

create function nh_staff.is_coach() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.profiles p join auth.users u on u.id=p.id
  where p.id=auth.uid() and p.role='coach' and u.email_confirmed_at is not null
    and u.deleted_at is null and not u.is_anonymous
    and (u.banned_until is null or u.banned_until<=now())
 );
$$;
create function nh_staff.can_train(p_athlete uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select nh_staff.is_coach() and exists(
  select 1 from public.deportistas d join public.profiles p on p.id=d.user_id
  where d.user_id=p_athlete and p.role='athlete'
 );
$$;

create table nh_staff.role_events(
 id bigint generated always as identity primary key,
 user_id uuid not null references public.profiles(id),
 actor_id uuid not null references public.profiles(id),
 previous_role text not null,
 new_role text not null,
 created_at timestamptz not null default now()
);
alter table nh_staff.role_events enable row level security;
revoke all on nh_staff.role_events from public,anon,authenticated;
create policy role_events_private on nh_staff.role_events to authenticated using(false) with check(false);

create function nh_staff.require_admin() returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
  raise exception 'Solo administración puede gestionar entrenadores.' using errcode='42501';
 end if;
end;
$$;

create function nh_staff.lookup_account(p_email text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare account jsonb; matches integer;
begin
 perform nh_staff.require_admin();
 if p_email is null or length(btrim(p_email)) not between 3 and 254 then
  raise exception 'Introduce el correo completo de la cuenta.' using errcode='22023';
 end if;
 select count(*) into matches from auth.users u where lower(btrim(u.email))=lower(btrim(p_email));
 if matches<>1 then raise exception 'No hay una cuenta única con ese correo. Comprueba el registro.' using errcode='22023'; end if;
 select jsonb_build_object('id',p.id,'email',u.email,'full_name',p.full_name,'role',p.role) into account
 from auth.users u join public.profiles p on p.id=u.id
 where lower(btrim(u.email))=lower(btrim(p_email))
   and p.role in ('athlete','coach') and p.id<>auth.uid()
   and (p.role='coach' or (u.email_confirmed_at is not null and u.deleted_at is null and not u.is_anonymous
   and (u.banned_until is null or u.banned_until<=now())))
   and not exists(select 1 from public.club_pilot_memberships m where m.user_id=p.id);
 if account is null then raise exception 'La cuenta debe tener el correo confirmado, estar activa y no ser de administración ni de prueba.' using errcode='22023'; end if;
 return account;
end;
$$;

create or replace function public.proteger_rol_perfil() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.role is distinct from old.role then
  if current_user<>'postgres' or auth.uid() is null or new.id=auth.uid()
    or old.role not in ('athlete','coach') or new.role not in ('athlete','coach')
    or not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
   raise exception 'No se permite modificar el rol del usuario.' using errcode='42501';
  end if;
 end if;
 return new;
end;
$$;

create function nh_staff.set_coach(p_user uuid,p_email text,p_expected_role text,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare candidate jsonb; previous text; next_role text;
begin
 perform nh_staff.require_admin();
 if p_enabled is null or p_expected_role is null or p_expected_role not in ('athlete','coach') then
  raise exception 'Revisa la cuenta y vuelve a intentarlo.' using errcode='22023';
 end if;
 perform 1 from auth.users where id=p_user for share;
 select role into previous from public.profiles where id=p_user for update;
 -- Revalidate email, confirmation, identity, role and eligibility inside the write transaction.
 candidate:=nh_staff.lookup_account(p_email);
 if (candidate->>'id')::uuid is distinct from p_user or previous is distinct from p_expected_role then
  raise exception 'La cuenta ha cambiado. Vuelve a buscarla antes de confirmar.' using errcode='40001';
 end if;
 next_role:=case when p_enabled then 'coach' else 'athlete' end;
 if previous<>next_role then
  update public.profiles set role=next_role where id=p_user;
  insert into nh_staff.role_events(user_id,actor_id,previous_role,new_role)
    values(p_user,auth.uid(),previous,next_role);
 end if;
 return jsonb_build_object('id',p_user,'role',next_role);
end;
$$;

create function nh_staff.list_coaches() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform nh_staff.require_admin();
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'email',u.email,'full_name',p.full_name,'role',p.role) order by p.full_name,p.id)
 from public.profiles p join auth.users u on u.id=p.id where p.role='coach'),'[]'::jsonb);
end;
$$;

create function nh_staff.roster() returns table(id uuid,nombre text,nivel text,user_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
 if not nh_staff.is_coach() then raise exception 'Acceso exclusivo para entrenadores.' using errcode='42501'; end if;
 return query select d.id,d.nombre,d.nivel,d.user_id from public.deportistas d
 join public.profiles p on p.id=d.user_id and p.role='athlete' order by d.nombre,d.id;
end;
$$;

create function public.coaching_roster() returns table(id uuid,nombre text,nivel text,user_id uuid)
language sql stable security invoker set search_path='' as $$ select * from nh_staff.roster(); $$;
create function public.coach_account_lookup(p_email text) returns jsonb
language sql stable security invoker set search_path='' as $$ select nh_staff.lookup_account(p_email); $$;
create function public.coach_access_set(p_user uuid,p_email text,p_expected_role text,p_enabled boolean) returns jsonb
language sql security invoker set search_path='' as $$ select nh_staff.set_coach(p_user,p_email,p_expected_role,p_enabled); $$;
create function public.coach_accounts_list() returns jsonb
language sql stable security invoker set search_path='' as $$ select nh_staff.list_coaches(); $$;

revoke all on all functions in schema nh_staff from public,anon,authenticated;
grant execute on function nh_staff.is_coach(),nh_staff.can_train(uuid),nh_staff.roster(),
 nh_staff.lookup_account(text),nh_staff.set_coach(uuid,text,text,boolean),nh_staff.list_coaches() to authenticated;
revoke all on function public.coaching_roster(),public.coach_account_lookup(text),
 public.coach_access_set(uuid,text,text,boolean),public.coach_accounts_list() from public,anon;
grant execute on function public.coaching_roster(),public.coach_account_lookup(text),
 public.coach_access_set(uuid,text,text,boolean),public.coach_accounts_list() to authenticated;

-- Additional sports policies. Existing administrator and athlete policies are retained.
create policy coach_manage_training on public.weekly_training_plan for all to authenticated
 using(nh_staff.can_train(athlete_id)) with check(nh_staff.can_train(athlete_id));
create policy coach_read_activity on public.trail_activity_log for select to authenticated using(nh_staff.can_train(athlete_id));
create policy coach_manage_goals on public.runner_goals for all to authenticated
 using(nh_staff.can_train(athlete_id)) with check(nh_staff.can_train(athlete_id));
create policy coach_manage_phases on public.runner_goal_phases for all to authenticated
 using(exists(select 1 from public.runner_goals g where g.id=goal_id and nh_staff.can_train(g.athlete_id)))
 with check(exists(select 1 from public.runner_goals g where g.id=goal_id and nh_staff.can_train(g.athlete_id)));
create policy coach_manage_reviews on public.runner_goal_reviews for all to authenticated
 using(exists(select 1 from public.runner_goals g where g.id=goal_id and nh_staff.can_train(g.athlete_id)))
 with check(exists(select 1 from public.runner_goals g where g.id=goal_id and nh_staff.can_train(g.athlete_id)));
create policy coach_read_templates on public.training_templates for select to authenticated using((select nh_staff.is_coach()));
create policy coach_create_templates on public.training_templates for insert to authenticated
 with check(created_by=(select auth.uid()) and (select nh_staff.is_coach()));
create policy coach_read_exercises on public.training_exercise_library for select to authenticated using((select nh_staff.is_coach()));
create policy coach_create_exercises on public.training_exercise_library for insert to authenticated
 with check(created_by=(select auth.uid()) and (select nh_staff.is_coach()));

CREATE OR REPLACE FUNCTION nh_access.has_paid_access(p_require_premium boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller uuid := (select auth.uid());
begin
  if caller is null or p_require_premium is null then return false; end if;
  if nh_staff.is_coach() or exists(select 1 from public.profiles where id=caller and role='admin') then return true; end if;
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
$function$;

CREATE OR REPLACE FUNCTION public.protect_runner_coaching_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not (nh_staff.is_coach() or exists(select 1 from public.profiles where id=auth.uid() and role='admin')) then raise exception 'Solo el entrenador puede modificar la preparación' using errcode='42501';end if;
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
$function$;

CREATE OR REPLACE FUNCTION nh_chat.is_coach()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select auth.uid() is not null and (nh_staff.is_coach() or exists(select 1 from public.profiles where id=auth.uid() and role='admin'));
$function$;

CREATE OR REPLACE FUNCTION nh_staff.mark_training_completed(p_id uuid, p_completed boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE caller uuid := (SELECT auth.uid());
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE='42501'; END IF;
  IF p_completed IS NULL THEN RAISE EXCEPTION 'Estado de sesión obligatorio' USING ERRCODE='22004'; END IF;
  IF NOT nh_access.has_paid_access(true) THEN
    RAISE EXCEPTION 'Necesitas PLUS o Performance aprobada y con la cuota del mes pagada' USING ERRCODE='42501';
  END IF;
  UPDATE public.weekly_training_plan SET completed=p_completed
  WHERE id=p_id AND (
    athlete_id=caller OR nh_staff.can_train(athlete_id) OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=caller AND p.role='admin')
  );
  IF NOT FOUND THEN RAISE EXCEPTION 'Sesión no encontrada o sin permisos' USING ERRCODE='42501'; END IF;
END;
$function$;

create or replace function public.mark_training_completed(p_id uuid,p_completed boolean) returns void
language sql security invoker set search_path='' as $$ select nh_staff.mark_training_completed(p_id,p_completed); $$;
revoke all on function nh_staff.mark_training_completed(uuid,boolean) from public,anon;
grant execute on function nh_staff.mark_training_completed(uuid,boolean) to authenticated;
revoke all on function public.mark_training_completed(uuid,boolean) from public,anon;
grant execute on function public.mark_training_completed(uuid,boolean) to authenticated,service_role;
-- No new policy grants coach access to payments, subscriptions, profile administration,
-- contact records, athlete account linking, or activity administration.
