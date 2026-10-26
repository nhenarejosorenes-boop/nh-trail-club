-- TEST ONLY. All synthetic records are rolled back. No login identities or messages are delivered.
create or replace function pg_temp.builder_suite() returns jsonb language plpgsql security invoker as $suite$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); basic uuid:=gen_random_uuid(); sub uuid; tid uuid; sid uuid; copied uuid; n int; checks jsonb:='{}'; denied boolean; shape jsonb:='{"version":1,"notes":"Indicaciones","targets":{"distance":"10","elevation":"300","minutes":"60","effort":"6"},"blocks":[{"stage":"warmup","items":[]},{"stage":"main","items":[{"id":"exercise-a","name":"Sentadilla","sets":"3","reps":"8 por lado","weight":"22.5","rest":"60","duration":"","intensity":"RPE 6","notes":"Control técnico"}]},{"stage":"cooldown","items":[]}]}';
begin
  if not exists(select 1 from pg_proc where proname='nh_test_paid' and pronamespace='public'::regnamespace) then raise exception 'TEST schema required'; end if;
  begin
    insert into auth.users(id,aud,role) values(a,'authenticated','authenticated'),(b,'authenticated','authenticated'),(c,'authenticated','authenticated'),(basic,'authenticated','authenticated');
    insert into public.profiles(id,role,full_name) values(a,'athlete','Builder fixture A'),(b,'athlete','Builder fixture B'),(c,'admin','Builder fixture coach'),(basic,'athlete','Builder fixture basic');
    insert into public.club_subscription_requests(user_id,plan,status) values(a,'plus','approved') returning id into sub;
    insert into public.club_subscription_monthly_dues(subscription_id,period_month,amount_eur,due_date,status) values(sub,date_trunc('month',current_date)::date,60,current_date,'paid');
    insert into public.club_subscription_requests(user_id,plan,status) values(basic,'basic','approved') returning id into sub;
    insert into public.club_subscription_monthly_dues(subscription_id,period_month,amount_eur,due_date,status) values(sub,date_trunc('month',current_date)::date,10,current_date,'paid');
    checks:=checks||jsonb_build_object('valid_shape',public.training_structure_valid(shape),'legacy_null',public.training_structure_valid(null),'bad_version_denied',not public.training_structure_valid(jsonb_set(shape,'{version}','2')),'bad_blocks_denied',not public.training_structure_valid(jsonb_set(shape,'{blocks}','[]')),'blank_name_denied',not public.training_structure_valid(jsonb_set(shape,'{blocks,1,items,0,name}','" "')),'invalid_series_denied',not public.training_structure_valid(jsonb_set(shape,'{blocks,1,items,0,sets}','"-1"')),'invalid_targets_denied',not public.training_structure_valid(jsonb_set(shape,'{targets,effort}','"11"')),'duplicate_stage_denied',not public.training_structure_valid(jsonb_set(shape,'{blocks,2,stage}','"main"')));
    perform set_config('request.jwt.claims',json_build_object('sub',c,'role','authenticated')::text,true);perform set_config('role','authenticated',true);
    insert into public.training_templates(name,category,title,structure) values('Builder fixture template','fuerza','Fuerza',shape) returning id into tid;
    checks:=checks||jsonb_build_object('coach_template_create',(select count(*) from public.training_templates where id=tid and created_by=c)=1);
    insert into public.weekly_training_plan(athlete_id,session_date,category,title,details,structure) values(a,current_date,'fuerza','Builder fixture session','Original text',shape) returning id into sid;
    checks:=checks||jsonb_build_object('coach_session_roundtrip',(select structure=shape from public.weekly_training_plan where id=sid));
    update public.weekly_training_plan set structure=jsonb_set(shape,'{blocks,1,items,0,sets}','"4"') where id=sid;
    checks:=checks||jsonb_build_object('edit_structure_preserved',(select structure->'blocks'->1->'items'->0->>'sets'='4' from public.weekly_training_plan where id=sid));
    insert into public.weekly_training_plan(athlete_id,session_date,category,title,details,structure) select b,current_date+1,category,title,details,structure from public.weekly_training_plan where id=sid returning id into copied;
    checks:=checks||jsonb_build_object('duplicate_not_completed',(select not completed and athlete_id=b from public.weekly_training_plan where id=copied));
    denied:=false;begin insert into public.training_templates(name,category,title,structure,created_by) values('Forged','fuerza','T',shape,a);exception when insufficient_privilege then denied:=true;end;checks:=checks||jsonb_build_object('template_owner_cannot_be_forged',denied);
    denied:=false;begin update public.weekly_training_plan set structure='{}' where id=sid;exception when check_violation then denied:=true;end;checks:=checks||jsonb_build_object('malformed_write_denied',denied);
    perform set_config('role','postgres',true);
    insert into public.weekly_training_plan(athlete_id,session_date,category,title,details) values(a,current_date,'trail','Legacy fixture','Legacy original');
    insert into public.weekly_training_plan(athlete_id,session_date,category,title,structure) values(basic,current_date,'trail','Basic private fixture',shape);
    perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);perform set_config('role','authenticated',true);
    checks:=checks||jsonb_build_object('client_own_structure_visible',(select count(*) from public.weekly_training_plan where id=sid)=1,'client_foreign_hidden',(select count(*) from public.weekly_training_plan where id=copied)=0,'client_templates_hidden',(select count(*) from public.training_templates where id=tid)=0,'legacy_visible',(select count(*) from public.weekly_training_plan where athlete_id=a and structure is null and details='Legacy original')=1);
    update public.weekly_training_plan set structure=shape where id=sid;get diagnostics n=row_count;checks:=checks||jsonb_build_object('client_cannot_edit_prescription',n=0);
    denied:=false;begin insert into public.training_templates(name,category,title,structure) values('Forbidden','fuerza','T',shape);exception when insufficient_privilege then denied:=true;end;checks:=checks||jsonb_build_object('client_cannot_create_template',denied);
    perform public.mark_training_completed(sid,true);checks:=checks||jsonb_build_object('completion_preserves_structure',(select completed and structure->'blocks'->1->'items'->0->>'sets'='4' from public.weekly_training_plan where id=sid));
    perform set_config('role','postgres',true);perform set_config('request.jwt.claims',json_build_object('sub',basic,'role','authenticated')::text,true);perform set_config('role','authenticated',true);
    checks:=checks||jsonb_build_object('basic_paid_still_cannot_read_private_plan',(select count(*) from public.weekly_training_plan where athlete_id=basic)=0);
    perform set_config('role','postgres',true);perform set_config('request.jwt.claims','{}',true);perform set_config('role','anon',true);
    denied:=false;begin perform 1 from public.training_templates;exception when insufficient_privilege then denied:=true;end;checks:=checks||jsonb_build_object('anon_templates_denied',denied);
    perform set_config('role','postgres',true);
    raise exception using errcode='P0002',message='Rollback builder fixtures';
  exception when no_data_found then null;
  end;
  return jsonb_build_object('checks',checks,'passed',(select count(*) from jsonb_each(checks) where value='true'::jsonb),'failed',(select count(*) from jsonb_each(checks) where value<>'true'::jsonb),'fixture_users',(select count(*) from auth.users where id in(a,b,c,basic)),'fixture_templates',(select count(*) from public.training_templates where id=tid));
end;
$suite$;
select pg_temp.builder_suite();
