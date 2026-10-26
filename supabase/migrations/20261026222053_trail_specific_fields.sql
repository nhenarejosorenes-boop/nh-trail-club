-- Validate optional mountain-running segment fields while preserving version-1 sessions and permissions.
create or replace function public.training_structure_valid(p jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
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
$$;
