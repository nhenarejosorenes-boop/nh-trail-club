-- Production schema/policy snapshot (9 Nov 2026), without user data or credentials.
create role anon; create role authenticated; create role service_role;
create schema auth; create schema nh_access; create schema nh_chat; create schema nh_accounts;
grant usage on schema auth,nh_access,nh_chat,nh_accounts to authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,
 is_anonymous boolean not null default false,banned_until timestamptz,raw_user_meta_data jsonb);
set check_function_bodies=off;
create table public."activity_registrations"(
 "id" uuid default gen_random_uuid() not null,
 "activity_id" uuid not null,
 "user_id" uuid not null,
 "created_at" timestamp with time zone default now() not null
);
alter table public."activity_registrations" enable row level security;
grant select,insert,update,delete on public."activity_registrations" to authenticated;
create table public."club_activities"(
 "id" uuid default gen_random_uuid() not null,
 "title" text not null,
 "description" text,
 "activity_type" text not null,
 "starts_at" timestamp with time zone not null,
 "location" text,
 "max_participants" integer default 15 not null,
 "created_at" timestamp with time zone default now() not null
);
alter table public."club_activities" enable row level security;
grant select,insert,update,delete on public."club_activities" to authenticated;
create table public."club_membership_plans"(
 "plan" text not null,
 "monthly_price_eur" numeric(10,2) not null,
 "display_name" text not null
);
alter table public."club_membership_plans" enable row level security;
grant select,insert,update,delete on public."club_membership_plans" to authenticated;
create table public."club_message_reads"(
 "athlete_id" uuid not null,
 "reader_id" uuid not null,
 "last_read_seq" bigint default 0 not null
);
alter table public."club_message_reads" enable row level security;
grant select,insert,update,delete on public."club_message_reads" to authenticated;
create table public."club_messages"(
 "id" uuid not null,
 "seq" bigint generated always as identity not null,
 "athlete_id" uuid not null,
 "sender_id" uuid not null,
 "body" text not null,
 "training_id" uuid,
 "training_title" text,
 "training_date" date,
 "created_at" timestamp with time zone default now() not null
);
alter table public."club_messages" enable row level security;
grant select,insert,update,delete on public."club_messages" to authenticated;
create table public."club_pilot_memberships"(
 "user_id" uuid not null,
 "plan" text not null,
 "starts_at" timestamp with time zone not null,
 "expires_at" timestamp with time zone not null,
 "created_at" timestamp with time zone default now() not null
);
alter table public."club_pilot_memberships" enable row level security;
grant select,insert,update,delete on public."club_pilot_memberships" to authenticated;
create table public."club_subscription_monthly_dues"(
 "id" uuid default gen_random_uuid() not null,
 "subscription_id" uuid not null,
 "period_month" date not null,
 "amount_eur" numeric(10,2) not null,
 "due_date" date not null,
 "status" text default 'pending'::text not null,
 "paid_on" date,
 "payment_method" text,
 "notes" text,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 "revision" integer default 1 not null
);
alter table public."club_subscription_monthly_dues" enable row level security;
grant select,insert,update,delete on public."club_subscription_monthly_dues" to authenticated;
create table public."club_subscription_requests"(
 "id" uuid default gen_random_uuid() not null,
 "user_id" uuid not null,
 "plan" text not null,
 "status" text default 'pending'::text not null,
 "created_at" timestamp with time zone default now() not null,
 "reviewed_at" timestamp with time zone,
 "start_date" date,
 "next_due_date" date,
 "payment_status" text default 'not_recorded'::text not null
);
alter table public."club_subscription_requests" enable row level security;
grant select,insert,update,delete on public."club_subscription_requests" to authenticated;
create table public."deportistas"(
 "id" uuid default gen_random_uuid() not null,
 "nombre" text not null,
 "email" text,
 "telefono" text,
 "nivel" text default 'Iniciación'::text not null,
 "created_at" timestamp with time zone default now() not null,
 "user_id" uuid
);
alter table public."deportistas" enable row level security;
grant select,insert,update,delete on public."deportistas" to authenticated;
create table public."objetivos_deportivos"(
 "id" uuid default gen_random_uuid() not null,
 "deportista_id" uuid not null,
 "titulo" text not null,
 "descripcion" text,
 "fecha_objetivo" date,
 "estado" text default 'Pendiente'::text not null,
 "progreso" integer default 0 not null,
 "created_at" timestamp with time zone default now()
);
alter table public."objetivos_deportivos" enable row level security;
grant select,insert,update,delete on public."objetivos_deportivos" to authenticated;
create table public."profiles"(
 "id" uuid default auth.uid() not null,
 "created_at" timestamp with time zone default now() not null,
 "full_name" text,
 "email" text,
 "phone" text,
 "role" text default 'athlete'::text
);
alter table public."profiles" enable row level security;
grant select,insert,update,delete on public."profiles" to authenticated;
create table public."runner_goal_phases"(
 "id" uuid default gen_random_uuid() not null,
 "goal_id" uuid not null,
 "phase_type" text not null,
 "starts_on" date not null,
 "ends_on" date not null,
 "focus" text not null,
 "active" boolean default true not null,
 "revision" integer default 1 not null,
 "created_by" uuid default auth.uid() not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);
alter table public."runner_goal_phases" enable row level security;
grant select,insert,update,delete on public."runner_goal_phases" to authenticated;
create table public."runner_goal_reviews"(
 "id" uuid default gen_random_uuid() not null,
 "goal_id" uuid not null,
 "week_start" date not null,
 "summary" text not null,
 "decision" text not null,
 "next_focus" text not null,
 "revision" integer default 1 not null,
 "created_by" uuid default auth.uid() not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);
alter table public."runner_goal_reviews" enable row level security;
grant select,insert,update,delete on public."runner_goal_reviews" to authenticated;
create table public."runner_goals"(
 "id" uuid default gen_random_uuid() not null,
 "athlete_id" uuid not null,
 "title" text not null,
 "goal_type" text not null,
 "priority" text not null,
 "starts_on" date not null,
 "target_date" date not null,
 "distance_km" numeric,
 "elevation_m" integer,
 "terrain" text default ''::text not null,
 "experience" text default ''::text not null,
 "baseline" text default ''::text not null,
 "available_days" integer not null,
 "weekly_minutes" integer,
 "notes" text default ''::text not null,
 "status" text default 'active'::text not null,
 "revision" integer default 1 not null,
 "created_by" uuid default auth.uid() not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);
alter table public."runner_goals" enable row level security;
grant select,insert,update,delete on public."runner_goals" to authenticated;
create table public."session_bookings"(
 "id" uuid default gen_random_uuid() not null,
 "session_id" uuid not null,
 "user_id" uuid not null,
 "status" text default 'confirmed'::text not null,
 "created_at" timestamp with time zone default now() not null
);
alter table public."session_bookings" enable row level security;
grant select,insert,update,delete on public."session_bookings" to authenticated;
create table public."trail_activity_log"(
 "id" uuid default gen_random_uuid() not null,
 "athlete_id" uuid not null,
 "activity_date" date not null,
 "distance_km" numeric(7,2) not null,
 "elevation_m" integer not null,
 "duration_minutes" integer not null,
 "effort" integer,
 "feelings" text default ''::text not null,
 "created_at" timestamp with time zone default now() not null,
 "source" text default 'manual'::text not null,
 "file_hash" text,
 "import_key" text,
 "import_index" integer,
 "file_format" text,
 "started_at" timestamp with time zone,
 "import_summary" jsonb,
 "linked_session_id" uuid
);
alter table public."trail_activity_log" enable row level security;
grant select,insert,update,delete on public."trail_activity_log" to authenticated;
create table public."training_exercise_library"(
 "id" uuid default gen_random_uuid() not null,
 "name" text not null,
 "category" text not null,
 "video_url" text default ''::text not null,
 "notes" text default ''::text not null,
 "created_by" uuid default auth.uid() not null,
 "created_at" timestamp with time zone default now() not null
);
alter table public."training_exercise_library" enable row level security;
grant select,insert,update,delete on public."training_exercise_library" to authenticated;
create table public."training_session_results"(
 "session_id" uuid not null,
 "athlete_id" uuid not null,
 "prescription" jsonb,
 "entries" jsonb default '[]'::jsonb not null,
 "effort" smallint,
 "sensations" text default ''::text not null,
 "revision" integer default 1 not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);
alter table public."training_session_results" enable row level security;
grant select,insert,update,delete on public."training_session_results" to authenticated;
create table public."training_sessions"(
 "id" uuid default gen_random_uuid() not null,
 "created_at" timestamp with time zone default now() not null,
 "workout_id" uuid,
 "exercise_name" text,
 "sets" smallint,
 "reps" smallint,
 "weight" real,
 "rest_seconds" smallint,
 "notes" text
);
alter table public."training_sessions" enable row level security;
grant select,insert,update,delete on public."training_sessions" to authenticated;
create table public."training_templates"(
 "id" uuid default gen_random_uuid() not null,
 "name" text not null,
 "category" text not null,
 "title" text not null,
 "structure" jsonb not null,
 "created_by" uuid default auth.uid() not null,
 "created_at" timestamp with time zone default now() not null
);
alter table public."training_templates" enable row level security;
grant select,insert,update,delete on public."training_templates" to authenticated;
create table public."weekly_training_plan"(
 "id" uuid default gen_random_uuid() not null,
 "athlete_id" uuid not null,
 "session_date" date not null,
 "category" text not null,
 "title" text not null,
 "details" text default ''::text not null,
 "completed" boolean default false not null,
 "created_at" timestamp with time zone default now() not null,
 "structure" jsonb,
 "goal_id" uuid,
 "purpose" text default ''::text not null
);
alter table public."weekly_training_plan" enable row level security;
grant select,insert,update,delete on public."weekly_training_plan" to authenticated;
create table public."workouts"(
 "id" uuid default gen_random_uuid() not null,
 "created_at" timestamp with time zone default now() not null,
 "user_id" uuid,
 "title" text,
 "description" text,
 "workout_date" date,
 "completed" boolean default false
);
alter table public."workouts" enable row level security;
grant select,insert,update,delete on public."workouts" to authenticated;
alter table public."deportistas" add constraint "deportistas_pkey" PRIMARY KEY (id);
alter table public."training_sessions" add constraint "training_sessions_pkey" PRIMARY KEY (id);
alter table public."workouts" add constraint "workouts_pkey" PRIMARY KEY (id);
alter table public."objetivos_deportivos" add constraint "objetivos_deportivos_pkey" PRIMARY KEY (id);
alter table public."club_activities" add constraint "club_activities_pkey" PRIMARY KEY (id);
alter table public."activity_registrations" add constraint "activity_registrations_activity_id_user_id_key" UNIQUE (activity_id, user_id);
alter table public."activity_registrations" add constraint "activity_registrations_pkey" PRIMARY KEY (id);
alter table public."activity_registrations" add constraint "activity_registrations_unique_user" UNIQUE (activity_id, user_id);
alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);
alter table public."session_bookings" add constraint "session_bookings_pkey" PRIMARY KEY (id);
alter table public."session_bookings" add constraint "session_bookings_session_id_user_id_key" UNIQUE (session_id, user_id);
alter table public."club_membership_plans" add constraint "club_membership_plans_pkey" PRIMARY KEY (plan);
alter table public."weekly_training_plan" add constraint "weekly_training_plan_pkey" PRIMARY KEY (id);
alter table public."club_subscription_monthly_dues" add constraint "club_subscription_monthly_dues_pkey" PRIMARY KEY (id);
alter table public."club_subscription_monthly_dues" add constraint "unique_subscription_month" UNIQUE (subscription_id, period_month);
alter table public."club_subscription_requests" add constraint "club_subscription_requests_pkey" PRIMARY KEY (id);
alter table public."training_exercise_library" add constraint "training_exercise_library_pkey" PRIMARY KEY (id);
alter table public."club_messages" add constraint "club_messages_pkey" PRIMARY KEY (id);
alter table public."club_messages" add constraint "club_messages_seq_key" UNIQUE (seq);
alter table public."club_message_reads" add constraint "club_message_reads_pkey" PRIMARY KEY (athlete_id, reader_id);
alter table public."training_templates" add constraint "training_templates_pkey" PRIMARY KEY (id);
alter table public."training_session_results" add constraint "training_session_results_pkey" PRIMARY KEY (session_id);
alter table public."runner_goals" add constraint "runner_goals_pkey" PRIMARY KEY (id);
alter table public."runner_goal_phases" add constraint "runner_goal_phases_pkey" PRIMARY KEY (id);
alter table public."runner_goal_reviews" add constraint "runner_goal_reviews_goal_id_week_start_key" UNIQUE (goal_id, week_start);
alter table public."runner_goal_reviews" add constraint "runner_goal_reviews_pkey" PRIMARY KEY (id);
alter table public."trail_activity_log" add constraint "trail_activity_log_pkey" PRIMARY KEY (id);
alter table public."club_pilot_memberships" add constraint "club_pilot_memberships_pkey" PRIMARY KEY (user_id);
CREATE OR REPLACE FUNCTION nh_chat.require_thread(p_athlete uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid())
    or not exists(select 1 from public.profiles where id=p_athlete and role='athlete')
    or (auth.uid() <> p_athlete and not nh_chat.is_coach()) then
    raise exception 'No tienes acceso a esta conversación.' using errcode='42501';
  end if;
end;
$function$;
CREATE OR REPLACE FUNCTION nh_chat.mark_read(p_athlete uuid, p_seq bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare last_seq bigint;
begin
  perform nh_chat.require_thread(p_athlete);
  if p_seq is null or p_seq < 0 then raise exception 'Lectura no válida.' using errcode='22023'; end if;
  select coalesce(max(seq),0) into last_seq from public.club_messages where athlete_id=p_athlete;
  insert into public.club_message_reads(athlete_id,reader_id,last_read_seq)
    values(p_athlete,auth.uid(),least(p_seq,last_seq))
    on conflict(athlete_id,reader_id) do update
      set last_read_seq=greatest(public.club_message_reads.last_read_seq,excluded.last_read_seq);
end;
$function$;
CREATE OR REPLACE FUNCTION nh_chat.send(p_athlete uuid, p_id uuid, p_body text, p_training uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare existing public.club_messages; result public.club_messages; title text; training_day date;
begin
  perform nh_chat.require_thread(p_athlete);
  if p_id is null or p_body is null or p_body !~ '[^[:space:]]' or char_length(btrim(p_body)) not between 1 and 2000 then
    raise exception 'Escribe entre 1 y 2000 caracteres.' using errcode='22023';
  end if;
  -- Serialize writes in a conversation so read cursors follow committed message order.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_athlete::text, 0));
  select * into existing from public.club_messages where id=p_id;
  if found then
    if existing.athlete_id=p_athlete and existing.sender_id=auth.uid() and existing.body=btrim(p_body)
      and existing.training_id is not distinct from p_training then return to_jsonb(existing); end if;
    raise exception 'El identificador del mensaje ya está en uso.' using errcode='22023';
  end if;
  if p_training is not null then
    if not nh_access.has_paid_access(true) then
      raise exception 'Necesitas una modalidad con planificación individual para asociar una sesión.' using errcode='42501';
    end if;
    select p.title,p.session_date into title,training_day from public.weekly_training_plan p where p.id=p_training and p.athlete_id=p_athlete;
    if not found then raise exception 'La sesión no pertenece a esta conversación.' using errcode='42501'; end if;
  end if;
  insert into public.club_messages(id,athlete_id,sender_id,body,training_id,training_title,training_date)
    values(p_id,p_athlete,auth.uid(),btrim(p_body),p_training,title,training_day) returning * into result;
  return to_jsonb(result);
end;
$function$;
CREATE OR REPLACE FUNCTION public.controlar_plazas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  plazas_maximas integer;
  inscritos integer;
BEGIN
  SELECT max_participants
  INTO plazas_maximas
  FROM public.club_activities
  WHERE id = NEW.activity_id
  FOR UPDATE;

  IF plazas_maximas IS NULL THEN
    RAISE EXCEPTION 'Actividad no disponible';
  END IF;

  SELECT COUNT(*)
  INTO inscritos
  FROM public.activity_registrations
  WHERE activity_id = NEW.activity_id;

  IF inscritos >= plazas_maximas THEN
    RAISE EXCEPTION 'No quedan plazas disponibles';
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.validate_training_goal_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.goal_id is not null and not exists(select 1 from public.runner_goals g where g.id=new.goal_id and g.athlete_id=new.athlete_id) then raise exception 'El objetivo no pertenece al deportista de esta sesión' using errcode='42501';end if;
 return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.proteger_rol_perfil()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'No se permite modificar el rol del usuario';
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.proteger_reserva()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id
     OR OLD.user_id IS DISTINCT FROM NEW.user_id
     OR OLD.session_id IS DISTINCT FROM NEW.session_id
     OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION
      'No se pueden modificar los datos de la reserva';
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status
     AND NOT (
       OLD.status = 'confirmed'
       AND NEW.status = 'cancelled'
     )
  THEN
    RAISE EXCEPTION
      'Solo se permite cancelar una reserva confirmada';
  END IF;

  IF NEW.status IS NULL
     OR NEW.status NOT IN ('confirmed', 'cancelled')
  THEN
    RAISE EXCEPTION
      'Estado de reserva no permitido';
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  nombre_deportista text;
BEGIN

  nombre_deportista := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    SPLIT_PART(NEW.email, '@', 1)
  );

  -- Crear perfil del usuario
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    'athlete'
  );

  -- Crear ficha del deportista si no existe
  INSERT INTO public.deportistas (
    nombre,
    email,
    nivel,
    user_id
  )
  SELECT
    nombre_deportista,
    NEW.email,
    'Iniciación',
    NEW.id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.deportistas d
    WHERE d.user_id = NEW.id
       OR LOWER(TRIM(d.email)) =
          LOWER(TRIM(NEW.email))
  );

  RETURN NEW;

END;
$function$;
CREATE OR REPLACE FUNCTION public.set_subscription_reviewed_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.status is distinct from old.status then
  if new.status in ('approved','rejected','cancelled') then new.reviewed_at=now(); else new.reviewed_at=null; end if;
 end if;
 return new;
end;$function$;
CREATE OR REPLACE FUNCTION nh_access.has_paid_access(p_require_premium boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.mark_training_completed(p_id uuid, p_completed boolean)
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
    athlete_id=caller OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=caller AND p.role='admin')
  );
  IF NOT FOUND THEN RAISE EXCEPTION 'Sesión no encontrada o sin permisos' USING ERRCODE='42501'; END IF;
END;
$function$;
CREATE OR REPLACE FUNCTION nh_chat.is_coach()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$function$;
CREATE OR REPLACE FUNCTION nh_chat.inbox()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb; coach boolean;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid()) then
    raise exception 'Inicia sesión para consultar tus mensajes.' using errcode='42501';
  end if;
  coach := nh_chat.is_coach();
  select coalesce(jsonb_agg(to_jsonb(t) order by t.latest_at desc nulls last,t.name,t.athlete_id),'[]'::jsonb) into result
  from (
    select p.id as athlete_id,coalesce(nullif(btrim(p.full_name),''),'Deportista') as name,
      latest.body as preview, latest.seq as latest_seq,latest.created_at as latest_at,
      (select count(*) from public.club_messages m where m.athlete_id=p.id and m.sender_id<>auth.uid()
        and m.seq>coalesce(r.last_read_seq,0)) as unread
    from public.profiles p
    left join public.club_message_reads r on r.athlete_id=p.id and r.reader_id=auth.uid()
    left join lateral (select left(m.body,120) as body,m.seq,m.created_at from public.club_messages m where m.athlete_id=p.id order by m.seq desc limit 1) latest on true
    where p.role='athlete' and (coach or p.id=auth.uid())
  ) t;
  return result;
end;
$function$;
CREATE OR REPLACE FUNCTION public.messaging_send(p_athlete uuid, p_id uuid, p_body text, p_training uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select nh_chat.send(p_athlete,p_id,p_body,p_training); $function$;
CREATE OR REPLACE FUNCTION public.messaging_mark_read(p_athlete uuid, p_seq bigint)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select nh_chat.mark_read(p_athlete,p_seq); $function$;
CREATE OR REPLACE FUNCTION public.messaging_inbox()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select nh_chat.inbox(); $function$;
CREATE OR REPLACE FUNCTION public.training_video_url_valid(value text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select value is not null and (value='' or value ~ '^https://www[.]youtube[.]com/watch[?]v=[A-Za-z0-9_-]{11}$' or value ~ '^https://vimeo[.]com/[0-9]{1,12}$');
$function$;
CREATE OR REPLACE FUNCTION public.training_result_entries_valid(entries jsonb, prescription jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.protect_training_result()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.training_structure_valid(p jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
      foreach key in array array['trailDistance','trailElevation','trailDescent','trailTerrain','trailRecovery'] loop
        if i ? key then
          lim:=case when key in ('trailTerrain','trailRecovery') then 80 else 12 end;
          if jsonb_typeof(i->key) is distinct from 'string' or char_length(i->>key)>lim then return false; end if;
          if key in ('trailDistance','trailElevation','trailDescent') and i->>key<>'' then
            if i->>key !~ '^[0-9]+([.][0-9]+)?$' then return false; end if;
            if key='trailDistance' and (i->>key)::numeric not between 0 and 500 then return false; end if;
            if key in ('trailElevation','trailDescent') and ((i->>key)::numeric not between 0 and 30000 or mod((i->>key)::numeric,1)<>0) then return false; end if;
          end if;
        end if;
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
$function$;
CREATE OR REPLACE FUNCTION public.protect_runner_coaching_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.validate_trail_import()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op='UPDATE' and (new.source,new.file_hash,new.import_key,new.import_index,new.file_format,new.started_at,new.import_summary,new.athlete_id)
    is distinct from (old.source,old.file_hash,old.import_key,old.import_index,old.file_format,old.started_at,old.import_summary,old.athlete_id) then
    raise exception 'La procedencia de una salida no se puede modificar.' using errcode='23514';
  end if;
  if new.source='file' then
    if new.activity_date < date '2000-01-01' or new.activity_date > (now() at time zone 'Europe/Madrid')::date
      or new.started_at < timestamptz '2000-01-01 UTC' or new.started_at > now()+interval '5 minutes' then
      raise exception 'La fecha de la actividad no es válida.' using errcode='23514';
    end if;
    if exists(select 1 from jsonb_object_keys(new.import_summary) k where k not in ('title','duration_seconds','average_heart_rate','max_heart_rate'))
      or jsonb_typeof(new.import_summary->'title') is distinct from 'string'
      or length(new.import_summary->>'title')>160
      or jsonb_typeof(new.import_summary->'duration_seconds') is distinct from 'number'
      or not ((new.import_summary->>'duration_seconds')::numeric > 0 and (new.import_summary->>'duration_seconds')::numeric<=604800) then
      raise exception 'Resumen de importación no válido.' using errcode='23514';
    end if;
    if exists(select 1 from jsonb_each(new.import_summary) e where e.key in ('average_heart_rate','max_heart_rate') and e.value<>'null'::jsonb
      and (jsonb_typeof(e.value)<>'number' or not (e.value::text::numeric between 20 and 250))) then
      raise exception 'Frecuencia cardiaca no válida.' using errcode='23514';
    end if;
  end if;
  if new.linked_session_id is not null and not exists(select 1 from public.weekly_training_plan p where p.id=new.linked_session_id and p.athlete_id=new.athlete_id and p.category='trail') then
    raise exception 'Selecciona una sesión de trail de tu propio plan.' using errcode='23514';
  end if;
  return new;
end $function$;
CREATE OR REPLACE FUNCTION public.import_trail_activity(p_record jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_id uuid; v_created boolean := false;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.' using errcode='42501'; end if;
  insert into public.trail_activity_log(athlete_id,activity_date,distance_km,elevation_m,duration_minutes,effort,feelings,source,file_hash,import_key,import_index,file_format,started_at,import_summary,linked_session_id)
  values(auth.uid(),(p_record->>'activity_date')::date,(p_record->>'distance_km')::numeric,(p_record->>'elevation_m')::integer,(p_record->>'duration_minutes')::integer,
    (p_record->>'effort')::integer,coalesce(p_record->>'feelings',''),'file',p_record->>'file_hash',p_record->>'import_key',(p_record->>'import_index')::integer,
    p_record->>'file_format',(p_record->>'started_at')::timestamptz,p_record->'import_summary',nullif(p_record->>'linked_session_id','')::uuid)
  on conflict do nothing returning id into v_id;
  v_created:=v_id is not null;
  if not v_created then
    select id into v_id from public.trail_activity_log where athlete_id=auth.uid() and source='file'
      and ((file_hash=p_record->>'file_hash' and import_index=(p_record->>'import_index')::integer) or import_key=p_record->>'import_key')
      order by created_at,id limit 1;
    if v_id is null then raise exception 'No se pudo confirmar la importación. Reinténtalo.'; end if;
  end if;
  return jsonb_build_object('id',v_id,'created',v_created);
end $function$;
CREATE OR REPLACE FUNCTION nh_access.activity_slots(p_activity_id uuid)
 RETURNS TABLE(inscritos bigint, plazas_disponibles bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT nh_access.has_paid_access(false) THEN
  RAISE EXCEPTION 'Necesitas acceso activo al club' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT count(r.id)::bigint,
 CASE WHEN a.max_participants IS NULL THEN NULL ELSE greatest(a.max_participants::bigint-count(r.id),0) END
 FROM public.club_activities a LEFT JOIN public.activity_registrations r ON r.activity_id=a.id
 WHERE a.id=p_activity_id GROUP BY a.id,a.max_participants;
END;
$function$;
CREATE OR REPLACE FUNCTION public.obtener_plazas_actividad(p_activity_id uuid)
 RETURNS TABLE(inscritos bigint, plazas_disponibles bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT * FROM nh_access.activity_slots(p_activity_id);
$function$;
CREATE OR REPLACE FUNCTION nh_accounts.account_link_operation(p_card_id uuid, p_email text, p_user_id uuid, p_commit boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.preview_athlete_account_link(p_card_id uuid, p_email text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select nh_accounts.account_link_operation(p_card_id,p_email,null,false);
$function$;
CREATE OR REPLACE FUNCTION public.confirm_athlete_account_link(p_card_id uuid, p_email text, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select nh_accounts.account_link_operation(p_card_id,p_email,p_user_id,true);
$function$;
CREATE OR REPLACE FUNCTION public.protect_monthly_due()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.subscription_id IS DISTINCT FROM OLD.subscription_id OR NEW.period_month IS DISTINCT FROM OLD.period_month THEN
   RAISE EXCEPTION 'La identidad de una cuota no puede cambiar' USING ERRCODE='23514';
  END IF;
  NEW.created_at:=OLD.created_at;
  NEW.revision:=OLD.revision+1;
 ELSE NEW.revision:=1;
 END IF;
 IF NEW.status='paid' THEN
  IF NEW.paid_on IS NULL OR NEW.paid_on>(now() AT TIME ZONE 'Europe/Madrid')::date THEN
   RAISE EXCEPTION 'Fecha de cobro obligatoria y no posterior a hoy' USING ERRCODE='23514';
  END IF;
 ELSE NEW.paid_on:=NULL;
 END IF;
 NEW.updated_at:=clock_timestamp();
 RETURN NEW;
END;
$function$;
create policy "Users can view own profile" on public."profiles" as PERMISSIVE for SELECT to authenticated using((auth.uid() = id));
create policy "Users can update own profile" on public."profiles" as PERMISSIVE for UPDATE to authenticated using((auth.uid() = id));
create policy "Users can view own workouts" on public."workouts" as PERMISSIVE for SELECT to authenticated using((auth.uid() = user_id));
create policy "Users can insert own workouts" on public."workouts" as PERMISSIVE for INSERT to authenticated with check((auth.uid() = user_id));
create policy "Users can update own workouts" on public."workouts" as PERMISSIVE for UPDATE to authenticated using((auth.uid() = user_id)) with check((auth.uid() = user_id));
create policy "Users can view own training sessions " on public."training_sessions" as PERMISSIVE for SELECT to authenticated using((EXISTS ( SELECT 1
   FROM workouts
  WHERE ((workouts.id = training_sessions.workout_id) AND (workouts.user_id = auth.uid())))));
create policy "Enable insert for authenticated users only" on public."training_sessions" as PERMISSIVE for INSERT to authenticated with check(((workout_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = training_sessions.workout_id) AND (w.user_id = ( SELECT auth.uid() AS uid)))))));
create policy "Enable delete for users based on user_id" on public."training_sessions" as PERMISSIVE for DELETE to authenticated using((EXISTS ( SELECT 1
   FROM workouts
  WHERE ((workouts.id = training_sessions.workout_id) AND (workouts.user_id = auth.uid())))));
create policy "Users can update own training sessions" on public."training_sessions" as PERMISSIVE for UPDATE to authenticated using((EXISTS ( SELECT 1
   FROM workouts
  WHERE ((workouts.id = training_sessions.workout_id) AND (workouts.user_id = auth.uid()))))) with check((EXISTS ( SELECT 1
   FROM workouts
  WHERE ((workouts.id = training_sessions.workout_id) AND (workouts.user_id = auth.uid())))));
create policy "Users can view own bookings" on public."session_bookings" as PERMISSIVE for SELECT to authenticated using((auth.uid() = user_id));
create policy "Objetivos lectura autenticada" on public."objetivos_deportivos" as PERMISSIVE for SELECT to authenticated using((EXISTS ( SELECT 1
   FROM deportistas d
  WHERE ((d.id = objetivos_deportivos.deportista_id) AND (d.user_id = ( SELECT auth.uid() AS uid))))));
create policy "Objetivos eliminacion autenticada" on public."objetivos_deportivos" as PERMISSIVE for DELETE to authenticated using((EXISTS ( SELECT 1
   FROM deportistas d
  WHERE ((d.id = objetivos_deportivos.deportista_id) AND (d.user_id = ( SELECT auth.uid() AS uid))))));
create policy "Objetivos alta autenticada" on public."objetivos_deportivos" as PERMISSIVE for INSERT to authenticated with check((EXISTS ( SELECT 1
   FROM deportistas d
  WHERE ((d.id = objetivos_deportivos.deportista_id) AND (d.user_id = ( SELECT auth.uid() AS uid))))));
create policy "Objetivos edicion autenticada" on public."objetivos_deportivos" as PERMISSIVE for UPDATE to authenticated using((EXISTS ( SELECT 1
   FROM deportistas d
  WHERE ((d.id = objetivos_deportivos.deportista_id) AND (d.user_id = ( SELECT auth.uid() AS uid)))))) with check((EXISTS ( SELECT 1
   FROM deportistas d
  WHERE ((d.id = objetivos_deportivos.deportista_id) AND (d.user_id = ( SELECT auth.uid() AS uid))))));
create policy "Deportistas alta autenticada" on public."deportistas" as PERMISSIVE for INSERT to authenticated with check((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
create policy "Users can insert own profile" on public."profiles" as PERMISSIVE for INSERT to authenticated with check(((id = ( SELECT auth.uid() AS uid)) AND (role = 'athlete'::text)));
create policy "Deportistas eliminación autenticada" on public."deportistas" as PERMISSIVE for DELETE to authenticated using((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
create policy "Deportistas edición autenticada" on public."deportistas" as PERMISSIVE for UPDATE to authenticated using((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))) with check((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
create policy "Deportistas lectura autenticada" on public."deportistas" as PERMISSIVE for SELECT to authenticated using(((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))));
create policy "Usuarios crean sus reservas" on public."session_bookings" as PERMISSIVE for INSERT to authenticated with check(((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'confirmed'::text)));
create policy "Administradores ven todas las reservas" on public."session_bookings" as PERMISSIVE for SELECT to authenticated using((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
create policy "Usuarios ven actividades" on public."club_activities" as PERMISSIVE for SELECT to authenticated using(true);
create policy "Usuarios ven sus inscripciones" on public."activity_registrations" as PERMISSIVE for SELECT to authenticated using((user_id = ( SELECT auth.uid() AS uid)));
create policy "Usuarios cancelan sus inscripciones" on public."activity_registrations" as PERMISSIVE for DELETE to authenticated using((user_id = ( SELECT auth.uid() AS uid)));
create policy "Usuarios crean sus inscripciones" on public."activity_registrations" as PERMISSIVE for INSERT to authenticated with check((user_id = ( SELECT auth.uid() AS uid)));
create policy "Admins crean actividades" on public."club_activities" as PERMISSIVE for INSERT to authenticated with check((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
create policy "Admins editan actividades" on public."club_activities" as PERMISSIVE for UPDATE to authenticated using((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))) with check((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
create policy "Admins eliminan actividades" on public."club_activities" as PERMISSIVE for DELETE to authenticated using((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
create policy "Usuarios cancelan sus reservas" on public."session_bookings" as PERMISSIVE for UPDATE to authenticated using(((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'confirmed'::text))) with check(((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'cancelled'::text)));
create policy "Administradores ven todas las inscripciones" on public."activity_registrations" as PERMISSIVE for SELECT to authenticated using((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
create policy "athletes_read_own_training" on public."weekly_training_plan" as PERMISSIVE for SELECT to authenticated using(((athlete_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text))))));
create policy "admins_manage_training" on public."weekly_training_plan" as PERMISSIVE for ALL to authenticated using((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text))))) with check((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text)))));
create policy "athlete_read_log" on public."trail_activity_log" as PERMISSIVE for SELECT to authenticated using(((athlete_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text))))));
create policy "athlete_insert_log" on public."trail_activity_log" as PERMISSIVE for INSERT to authenticated with check((athlete_id = ( SELECT auth.uid() AS uid)));
create policy "athlete_update_log" on public."trail_activity_log" as PERMISSIVE for UPDATE to authenticated using((athlete_id = ( SELECT auth.uid() AS uid))) with check((athlete_id = ( SELECT auth.uid() AS uid)));
create policy "athlete_delete_log" on public."trail_activity_log" as PERMISSIVE for DELETE to authenticated using((athlete_id = ( SELECT auth.uid() AS uid)));
create policy "member_read_own_subscription" on public."club_subscription_requests" as PERMISSIVE for SELECT to authenticated using(((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text))))));
create policy "member_request_subscription" on public."club_subscription_requests" as PERMISSIVE for INSERT to authenticated with check(((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text) AND (reviewed_at IS NULL)));
create policy "admin_review_subscription" on public."club_subscription_requests" as PERMISSIVE for UPDATE to authenticated using((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text))))) with check((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text)))));
create policy "dues_admin_select_or_owner" on public."club_subscription_monthly_dues" as PERMISSIVE for SELECT to authenticated using(((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM club_subscription_requests r
  WHERE ((r.id = club_subscription_monthly_dues.subscription_id) AND (r.user_id = ( SELECT auth.uid() AS uid)))))));
create policy "dues_admin_insert" on public."club_subscription_monthly_dues" as PERMISSIVE for INSERT to authenticated with check(((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text)))) AND (EXISTS ( SELECT 1
   FROM club_subscription_requests r
  WHERE ((r.id = club_subscription_monthly_dues.subscription_id) AND (r.status = 'approved'::text))))));
create policy "dues_admin_update" on public."club_subscription_monthly_dues" as PERMISSIVE for UPDATE to authenticated using((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text))))) with check((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text)))));
create policy "members_read_plan_prices" on public."club_membership_plans" as PERMISSIVE for SELECT to authenticated using(true);
create policy "nh_paid_premium_gate" on public."weekly_training_plan" as RESTRICTIVE for ALL to authenticated using(( SELECT nh_access.has_paid_access(true) AS has_paid_access)) with check(( SELECT nh_access.has_paid_access(true) AS has_paid_access));
create policy "nh_paid_premium_gate" on public."workouts" as RESTRICTIVE for ALL to authenticated using(( SELECT nh_access.has_paid_access(true) AS has_paid_access)) with check(( SELECT nh_access.has_paid_access(true) AS has_paid_access));
create policy "nh_paid_premium_gate" on public."training_sessions" as RESTRICTIVE for ALL to authenticated using(( SELECT nh_access.has_paid_access(true) AS has_paid_access)) with check(( SELECT nh_access.has_paid_access(true) AS has_paid_access));
create policy "nh_paid_club_read_gate" on public."club_activities" as RESTRICTIVE for SELECT to authenticated using(( SELECT nh_access.has_paid_access(false) AS has_paid_access));
create policy "nh_paid_registration_gate" on public."activity_registrations" as RESTRICTIVE for INSERT to authenticated with check(( SELECT nh_access.has_paid_access(false) AS has_paid_access));
create policy "nh_paid_booking_gate" on public."session_bookings" as RESTRICTIVE for INSERT to authenticated with check(( SELECT nh_access.has_paid_access(false) AS has_paid_access));
create policy "messages_participant_read" on public."club_messages" as PERMISSIVE for SELECT to authenticated using(((( SELECT auth.uid() AS uid) = athlete_id) OR ( SELECT nh_chat.is_coach() AS is_coach)));
create policy "messages_own_receipt_read" on public."club_message_reads" as PERMISSIVE for SELECT to authenticated using(((( SELECT auth.uid() AS uid) = reader_id) AND ((( SELECT auth.uid() AS uid) = athlete_id) OR ( SELECT nh_chat.is_coach() AS is_coach))));
create policy "templates_admin_read" on public."training_templates" as PERMISSIVE for SELECT to authenticated using((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
create policy "templates_admin_create" on public."training_templates" as PERMISSIVE for INSERT to authenticated with check(((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))));
create policy "exercise_library_admin_read" on public."training_exercise_library" as PERMISSIVE for SELECT to authenticated using((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
create policy "exercise_library_admin_insert" on public."training_exercise_library" as PERMISSIVE for INSERT to authenticated with check(((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))));
create policy "results_participant_read" on public."training_session_results" as PERMISSIVE for SELECT to authenticated using((EXISTS ( SELECT 1
   FROM weekly_training_plan p
  WHERE ((p.id = training_session_results.session_id) AND (p.athlete_id = training_session_results.athlete_id)))));
create policy "results_owner_insert" on public."training_session_results" as PERMISSIVE for INSERT to authenticated with check(((athlete_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM weekly_training_plan p
  WHERE ((p.id = training_session_results.session_id) AND (p.athlete_id = ( SELECT auth.uid() AS uid)))))));
create policy "results_owner_update" on public."training_session_results" as PERMISSIVE for UPDATE to authenticated using(((athlete_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM weekly_training_plan p
  WHERE ((p.id = training_session_results.session_id) AND (p.athlete_id = ( SELECT auth.uid() AS uid))))))) with check(((athlete_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM weekly_training_plan p
  WHERE ((p.id = training_session_results.session_id) AND (p.athlete_id = ( SELECT auth.uid() AS uid)))))));
create policy "goal_owner_read" on public."runner_goals" as PERMISSIVE for SELECT to authenticated using((athlete_id = ( SELECT auth.uid() AS uid)));
create policy "goal_admin_manage" on public."runner_goals" as PERMISSIVE for ALL to authenticated using((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))) with check((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
create policy "goal_paid_gate" on public."runner_goals" as RESTRICTIVE for ALL to authenticated using(( SELECT nh_access.has_paid_access(true) AS has_paid_access)) with check(( SELECT nh_access.has_paid_access(true) AS has_paid_access));
create policy "phases_goal_read" on public."runner_goal_phases" as PERMISSIVE for SELECT to authenticated using((EXISTS ( SELECT 1
   FROM runner_goals
  WHERE (runner_goals.id = runner_goal_phases.goal_id))));
create policy "phases_admin_manage" on public."runner_goal_phases" as PERMISSIVE for ALL to authenticated using(((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))) AND (EXISTS ( SELECT 1
   FROM runner_goals
  WHERE (runner_goals.id = runner_goal_phases.goal_id))))) with check(((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))) AND (EXISTS ( SELECT 1
   FROM runner_goals
  WHERE (runner_goals.id = runner_goal_phases.goal_id)))));
create policy "reviews_goal_read" on public."runner_goal_reviews" as PERMISSIVE for SELECT to authenticated using((EXISTS ( SELECT 1
   FROM runner_goals
  WHERE (runner_goals.id = runner_goal_reviews.goal_id))));
create policy "reviews_admin_manage" on public."runner_goal_reviews" as PERMISSIVE for ALL to authenticated using(((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))) AND (EXISTS ( SELECT 1
   FROM runner_goals
  WHERE (runner_goals.id = runner_goal_reviews.goal_id))))) with check(((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))) AND (EXISTS ( SELECT 1
   FROM runner_goals
  WHERE (runner_goals.id = runner_goal_reviews.goal_id)))));
create policy "pilot_membership_read" on public."club_pilot_memberships" as PERMISSIVE for SELECT to authenticated using(((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))));
create policy "no_pilot_commercial_requests" on public."club_subscription_requests" as RESTRICTIVE for INSERT to authenticated with check((NOT (EXISTS ( SELECT 1
   FROM club_pilot_memberships p
  WHERE (p.user_id = club_subscription_requests.user_id)))));

grant usage,select on all sequences in schema public to authenticated;
create trigger proteger_rol_perfil before update on public.profiles for each row execute function public.proteger_rol_perfil();
create trigger protect_runner_goal before insert or update on public.runner_goals for each row execute function public.protect_runner_coaching_record();
create trigger protect_runner_phase before insert or update on public.runner_goal_phases for each row execute function public.protect_runner_coaching_record();
create trigger protect_runner_review before insert or update on public.runner_goal_reviews for each row execute function public.protect_runner_coaching_record();
create trigger protect_training_result before insert or update on public.training_session_results for each row execute function public.protect_training_result();
