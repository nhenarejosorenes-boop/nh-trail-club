-- TEST ONLY. Match the production ownership policies before exercising writes.
do $$ begin
 if not exists(select 1 from pg_proc where proname='nh_test_paid') then raise exception 'TEST schema required';end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='trail_activity_log' and policyname='athlete_insert_log') then
   create policy athlete_insert_log on public.trail_activity_log for insert to authenticated with check (athlete_id=(select auth.uid()));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='trail_activity_log' and policyname='athlete_update_log') then
   create policy athlete_update_log on public.trail_activity_log for update to authenticated using (athlete_id=(select auth.uid())) with check (athlete_id=(select auth.uid()));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='trail_activity_log' and policyname='athlete_delete_log') then
   create policy athlete_delete_log on public.trail_activity_log for delete to authenticated using (athlete_id=(select auth.uid()));
 end if;
end $$;
