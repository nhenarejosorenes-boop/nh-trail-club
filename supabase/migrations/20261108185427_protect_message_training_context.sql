-- Require premium access before reading a new training-context snapshot.
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
$function$

