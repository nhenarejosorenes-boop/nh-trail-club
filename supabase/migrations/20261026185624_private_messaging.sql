-- Private client conversations. Existing profile and training permissions are preserved.
create schema nh_chat;
revoke all on schema nh_chat from public, anon;
grant usage on schema nh_chat to authenticated;

create table public.club_messages (
  id uuid primary key,
  seq bigint generated always as identity unique not null,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  training_id uuid,
  training_title text,
  training_date date,
  created_at timestamptz not null default now()
);
create index club_messages_thread_seq on public.club_messages(athlete_id, seq desc);
create index club_messages_sender on public.club_messages(sender_id);
create table public.club_message_reads (
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  reader_id uuid not null references public.profiles(id) on delete cascade,
  last_read_seq bigint not null default 0 check (last_read_seq >= 0),
  primary key (athlete_id, reader_id)
);
create index club_message_reads_reader on public.club_message_reads(reader_id);
alter table public.club_messages enable row level security;
alter table public.club_message_reads enable row level security;
revoke all on public.club_messages, public.club_message_reads from public, anon, authenticated;
revoke all on sequence public.club_messages_seq_seq from public, anon, authenticated;
grant select on public.club_messages, public.club_message_reads to authenticated;

create function nh_chat.is_coach() returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;
create policy messages_participant_read on public.club_messages for select to authenticated
  using ((select auth.uid()) = athlete_id or (select nh_chat.is_coach()));
create policy messages_own_receipt_read on public.club_message_reads for select to authenticated
  using ((select auth.uid()) = reader_id and ((select auth.uid()) = athlete_id or (select nh_chat.is_coach())));

create function nh_chat.require_thread(p_athlete uuid) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid())
    or not exists(select 1 from public.profiles where id=p_athlete and role='athlete')
    or (auth.uid() <> p_athlete and not nh_chat.is_coach()) then
    raise exception 'No tienes acceso a esta conversación.' using errcode='42501';
  end if;
end;
$$;

create function nh_chat.send(p_athlete uuid, p_id uuid, p_body text, p_training uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
    select p.title,p.session_date into title,training_day from public.weekly_training_plan p where p.id=p_training and p.athlete_id=p_athlete;
    if not found then raise exception 'La sesión no pertenece a esta conversación.' using errcode='42501'; end if;
  end if;
  insert into public.club_messages(id,athlete_id,sender_id,body,training_id,training_title,training_date)
    values(p_id,p_athlete,auth.uid(),btrim(p_body),p_training,title,training_day) returning * into result;
  return to_jsonb(result);
end;
$$;

create function nh_chat.mark_read(p_athlete uuid, p_seq bigint) returns void
language plpgsql security definer set search_path = '' as $$
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
$$;

create function nh_chat.inbox() returns jsonb language plpgsql stable security definer set search_path = '' as $$
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
$$;

create function public.messaging_send(p_athlete uuid,p_id uuid,p_body text,p_training uuid default null) returns jsonb
language sql security invoker set search_path = '' as $$ select nh_chat.send(p_athlete,p_id,p_body,p_training); $$;
create function public.messaging_mark_read(p_athlete uuid,p_seq bigint) returns void
language sql security invoker set search_path = '' as $$ select nh_chat.mark_read(p_athlete,p_seq); $$;
create function public.messaging_inbox() returns jsonb
language sql stable security invoker set search_path = '' as $$ select nh_chat.inbox(); $$;

revoke all on all functions in schema nh_chat from public,anon;
grant execute on all functions in schema nh_chat to authenticated;
revoke all on function public.messaging_send(uuid,uuid,text,uuid),public.messaging_mark_read(uuid,bigint),public.messaging_inbox() from public,anon;
grant execute on function public.messaging_send(uuid,uuid,text,uuid),public.messaging_mark_read(uuid,bigint),public.messaging_inbox() to authenticated;
