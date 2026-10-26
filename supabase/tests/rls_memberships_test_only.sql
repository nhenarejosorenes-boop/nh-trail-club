-- TEST ONLY: rollback-only RLS integration suite. Never execute on production.
-- Uses synthetic, non-login identities. No emails, credentials or charges are created.
CREATE OR REPLACE FUNCTION pg_temp.nh_rls_suite() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER AS $suite$
DECLARE
  ids uuid[] := ARRAY[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
  subs uuid[] := ARRAY[]::uuid[];
  workouts_ids uuid[] := ARRAY[]::uuid[];
  weekly_ids uuid[] := ARRAY[]::uuid[];
  sessions_ids uuid[] := ARRAY[]::uuid[];
  labels text[] := ARRAY['basic_paid','plus_paid','performance_paid','plus_unpaid','plus_overdue','plus_pending','plus_previous_month','admin'];
  plans text[] := ARRAY['basic','plus','plus_performance','plus','plus','plus','plus','basic'];
  activity uuid := gen_random_uuid();
  i int; n int; subid uuid; wid uuid; sid uuid; bid uuid;
  outcome jsonb := '[]'::jsonb; checks jsonb; c record; granted boolean;
BEGIN
  IF current_database() <> 'postgres' OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE proname='nh_test_paid' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION 'Expected NH Trail Club TEST schema';
  END IF;
  BEGIN
    FOR i IN 1..8 LOOP
      INSERT INTO auth.users(id,aud,role) VALUES(ids[i],'authenticated','authenticated');
      INSERT INTO public.profiles(id,full_name,role) VALUES(ids[i],'RLS temporary '||labels[i],CASE WHEN i=8 THEN 'admin' ELSE 'athlete' END);
      INSERT INTO public.club_subscription_requests(user_id,plan,status)
        VALUES(ids[i],plans[i],CASE WHEN i=6 THEN 'pending' ELSE 'approved' END) RETURNING id INTO subid;
      subs := array_append(subs,subid);
      INSERT INTO public.club_subscription_monthly_dues(subscription_id,period_month,amount_eur,due_date,status)
        VALUES(subid,CASE WHEN i=7 THEN (date_trunc('month',current_date)-interval '1 month')::date ELSE date_trunc('month',current_date)::date END,
          CASE WHEN i=1 THEN 10 WHEN i=3 THEN 100 ELSE 60 END,current_date,
          CASE WHEN i=4 THEN 'pending' WHEN i=5 THEN 'overdue' ELSE 'paid' END);
      INSERT INTO public.weekly_training_plan(athlete_id,session_date,category,title) VALUES(ids[i],current_date,'trail','RLS temporary plan') RETURNING id INTO wid;
      weekly_ids:=array_append(weekly_ids,wid);
      INSERT INTO public.workouts(user_id,title) VALUES(ids[i],'RLS temporary workout') RETURNING id INTO wid;
      workouts_ids := array_append(workouts_ids,wid);
      INSERT INTO public.training_sessions(workout_id,exercise_name) VALUES(wid,'RLS temporary exercise') RETURNING id INTO sid;
      sessions_ids := array_append(sessions_ids,sid);
    END LOOP;
    INSERT INTO public.club_activities(id,title,activity_type,starts_at,max_participants) VALUES(activity,'RLS temporary outing','trail',now()+interval '1 day',20);
    FOR i IN 1..7 LOOP
      PERFORM set_config('request.jwt.claims',json_build_object('sub',ids[i],'role','authenticated')::text,true);
      PERFORM set_config('role','authenticated',true);
      IF current_user <> 'authenticated' OR auth.uid() <> ids[i] THEN RAISE EXCEPTION 'Role simulation failed'; END IF;
      SELECT jsonb_build_object(
        'new_gate_general',nh_access.has_paid_access(false)=(i<=3),
        'new_gate_premium',nh_access.has_paid_access(true)=(i IN (2,3)),
        'new_gate_null_denied',NOT nh_access.has_paid_access(NULL),
        'general_membership',public.nh_test_paid(false)=(i<=3),
        'premium_membership',public.nh_test_paid(true)=(i IN (2,3)),
        'own_plan',(SELECT count(*) FROM public.weekly_training_plan WHERE athlete_id=ids[i])=CASE WHEN i IN (2,3) THEN 1 ELSE 0 END,
        'other_plans_hidden',(SELECT count(*) FROM public.weekly_training_plan WHERE athlete_id<>ids[i])=0,
        'own_workout',(SELECT count(*) FROM public.workouts WHERE user_id=ids[i])=CASE WHEN i IN (2,3) THEN 1 ELSE 0 END,
        'other_workouts_hidden',(SELECT count(*) FROM public.workouts WHERE user_id<>ids[i])=0,
        'own_exercises',(SELECT count(*) FROM public.training_sessions WHERE id=sessions_ids[i])=CASE WHEN i IN (2,3) THEN 1 ELSE 0 END,
        'other_exercises_hidden',(SELECT count(*) FROM public.training_sessions WHERE id=ANY(sessions_ids) AND id<>sessions_ids[i])=0,
        'own_subscription_visible',(SELECT count(*) FROM public.club_subscription_requests WHERE id=subs[i])=1,
        'other_subscriptions_hidden',(SELECT count(*) FROM public.club_subscription_requests WHERE id=ANY(subs) AND id<>subs[i])=0,
        'own_dues_visible',(SELECT count(*) FROM public.club_subscription_monthly_dues WHERE subscription_id=subs[i])=1,
        'other_dues_hidden',(SELECT count(*) FROM public.club_subscription_monthly_dues WHERE subscription_id=ANY(subs) AND subscription_id<>subs[i])=0,
        'outing_visibility',(SELECT count(*) FROM public.club_activities WHERE id=activity)=CASE WHEN i<=3 THEN 1 ELSE 0 END
      ) INTO checks;
      FOR c IN SELECT key,value FROM jsonb_each(checks) LOOP
        outcome := outcome||jsonb_build_array(jsonb_build_object('case',labels[i],'check',c.key,'pass',c.value));
      END LOOP;
      UPDATE public.profiles SET role='admin' WHERE id=ids[i]; GET DIAGNOSTICS n=ROW_COUNT;
      outcome:=outcome||jsonb_build_array(jsonb_build_object('case',labels[i],'check','cannot_promote_self','pass',n=0));
      UPDATE public.club_subscription_requests SET status='approved' WHERE id=subs[i]; GET DIAGNOSTICS n=ROW_COUNT;
      outcome:=outcome||jsonb_build_array(jsonb_build_object('case',labels[i],'check','cannot_approve_self','pass',n=0));
      granted:=false;
      BEGIN
        UPDATE public.club_subscription_monthly_dues SET status='paid' WHERE subscription_id=subs[i]; GET DIAGNOSTICS n=ROW_COUNT;
        granted:=n>0;
      EXCEPTION WHEN insufficient_privilege THEN granted:=false; END;
      outcome:=outcome||jsonb_build_array(jsonb_build_object('case',labels[i],'check','cannot_mark_own_payment','pass',NOT granted));
      granted:=false;
      BEGIN
        INSERT INTO public.activity_registrations(activity_id,user_id) VALUES(activity,ids[i]); granted:=true;
      EXCEPTION WHEN insufficient_privilege THEN granted:=false; END;
      outcome:=outcome||jsonb_build_array(jsonb_build_object('case',labels[i],'check','registration_requires_payment','pass',granted=(i<=3)));
      granted:=false;
      BEGIN
        INSERT INTO public.activity_registrations(activity_id,user_id) VALUES(activity,ids[8]); granted:=true;
      EXCEPTION WHEN insufficient_privilege THEN granted:=false; END;
      outcome:=outcome||jsonb_build_array(jsonb_build_object('case',labels[i],'check','cannot_register_another_athlete','pass',NOT granted));
      -- Booking references the same controlled fixture session for every general club member.
      granted:=false; bid:=null;
      BEGIN
        INSERT INTO public.session_bookings(session_id,user_id,status) VALUES(sessions_ids[8],ids[i],'confirmed') RETURNING id INTO bid; granted:=true;
      EXCEPTION WHEN insufficient_privilege THEN granted:=false; END;
      outcome:=outcome||jsonb_build_array(jsonb_build_object('case',labels[i],'check','booking_requires_payment','pass',granted=(i<=3)));
      IF bid IS NOT NULL THEN
        UPDATE public.session_bookings SET status='cancelled' WHERE id=bid; GET DIAGNOSTICS n=ROW_COUNT;
        outcome:=outcome||jsonb_build_array(jsonb_build_object('case',labels[i],'check','can_cancel_own_booking','pass',n=1));
      END IF;
      granted:=false;
      BEGIN
        PERFORM public.mark_training_completed(weekly_ids[i],true);
        granted:=true;
      EXCEPTION WHEN insufficient_privilege THEN granted:=false; END;
      outcome:=outcome||jsonb_build_array(jsonb_build_object('case',labels[i],'check','completion_rpc_requires_premium','pass',granted=(i IN (2,3))));
      granted:=false;
      BEGIN
        PERFORM public.mark_training_completed(weekly_ids[8],true);
        granted:=true;
      EXCEPTION WHEN insufficient_privilege THEN granted:=false; END;
      outcome:=outcome||jsonb_build_array(jsonb_build_object('case',labels[i],'check','completion_rpc_cannot_change_foreign_plan','pass',NOT granted));
      granted:=false;
      BEGIN
        PERFORM public.mark_training_completed(NULL,NULL);
        granted:=true;
      EXCEPTION WHEN null_value_not_allowed THEN granted:=false; END;
      outcome:=outcome||jsonb_build_array(jsonb_build_object('case',labels[i],'check','completion_rpc_rejects_null_state','pass',NOT granted));
      PERFORM set_config('role','postgres',true);
    END LOOP;
    PERFORM set_config('request.jwt.claims',json_build_object('sub',ids[8],'role','authenticated')::text,true);
    PERFORM set_config('role','authenticated',true);
    SELECT count(*) INTO n FROM public.weekly_training_plan WHERE athlete_id=ANY(ids);
    outcome:=outcome||jsonb_build_array(jsonb_build_object('case','admin','check','all_fixture_plans_visible','pass',n=8));
    UPDATE public.club_subscription_requests SET status='approved' WHERE id=subs[6]; GET DIAGNOSTICS n=ROW_COUNT;
    outcome:=outcome||jsonb_build_array(jsonb_build_object('case','admin','check','can_approve_subscription','pass',n=1));
    UPDATE public.club_subscription_monthly_dues SET status='paid' WHERE subscription_id=subs[4]; GET DIAGNOSTICS n=ROW_COUNT;
    outcome:=outcome||jsonb_build_array(jsonb_build_object('case','admin','check','can_record_test_payment','pass',n=1));
    PERFORM public.mark_training_completed(weekly_ids[1],true);
    SELECT count(*) INTO n FROM public.weekly_training_plan WHERE athlete_id=ids[1] AND completed;
    outcome:=outcome||jsonb_build_array(jsonb_build_object('case','admin','check','can_complete_foreign_plan','pass',n=1));
    PERFORM set_config('role','anon',true);
    PERFORM set_config('request.jwt.claims','{}',true);
    SELECT count(*) INTO n FROM public.weekly_training_plan WHERE athlete_id=ANY(ids);
    outcome:=outcome||jsonb_build_array(jsonb_build_object('case','anon','check','plans_hidden','pass',n=0));
    SELECT count(*) INTO n FROM public.club_subscription_monthly_dues WHERE subscription_id=ANY(subs);
    outcome:=outcome||jsonb_build_array(jsonb_build_object('case','anon','check','dues_hidden','pass',n=0));
    RAISE EXCEPTION USING ERRCODE='ZNH01',MESSAGE='rollback synthetic fixtures';
  EXCEPTION WHEN SQLSTATE 'ZNH01' THEN NULL;
  END;
  RETURN jsonb_build_object('total',jsonb_array_length(outcome),
    'passed',(SELECT count(*) FROM jsonb_array_elements(outcome) t WHERE t->>'pass'='true'),
    'failed',(SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM jsonb_array_elements(outcome) t WHERE t->>'pass'<>'true'),
    'synthetic_users_remaining',(SELECT count(*) FROM auth.users WHERE id=ANY(ids)),
    'scope','NH Trail Club TEST only; SQL roles and RLS; no browser sign-in or production validation');
END;
$suite$;
SELECT pg_temp.nh_rls_suite() AS test_results;
