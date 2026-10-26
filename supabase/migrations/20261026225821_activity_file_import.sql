-- Summaries only: original files and GPS coordinates stay on the user's device.
alter table public.trail_activity_log
  add column source text not null default 'manual' check (source in ('manual','file')),
  add column file_hash text,
  add column import_key text,
  add column import_index integer,
  add column file_format text,
  add column started_at timestamptz,
  add column import_summary jsonb,
  add column linked_session_id uuid references public.weekly_training_plan(id) on delete set null,
  add constraint trail_import_provenance check (
    (source='manual' and file_hash is null and import_key is null and import_index is null and file_format is null and started_at is null and import_summary is null)
    or (source='file' and file_hash is not null and file_hash ~ '^[0-9a-f]{64}$'
      and import_key is not null and import_key ~ '^[0-9a-f]{64}$'
      and import_index is not null and import_index between 0 and 31
      and file_format is not null and file_format in ('fit','tcx','gpx') and started_at is not null
      and import_summary is not null and jsonb_typeof(import_summary)='object' and octet_length(import_summary::text)<=2000)
  );
create unique index trail_import_file_unique on public.trail_activity_log(athlete_id,file_hash,import_index) where source='file';
create unique index trail_import_activity_unique on public.trail_activity_log(athlete_id,import_key) where source='file';
create index trail_import_session_index on public.trail_activity_log(linked_session_id) where linked_session_id is not null;

create function public.validate_trail_import() returns trigger language plpgsql security invoker set search_path='' as $$
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
end $$;
create trigger validate_trail_import before insert or update on public.trail_activity_log for each row execute function public.validate_trail_import();
revoke all on function public.validate_trail_import() from public,anon,authenticated;

-- Invoker: the existing ownership policies apply to both insert and duplicate lookup.
create function public.import_trail_activity(p_record jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
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
end $$;
revoke all on function public.import_trail_activity(jsonb) from public,anon;
grant execute on function public.import_trail_activity(jsonb) to authenticated;
