-- Additive membership gates. Preserve every existing ownership/admin policy.
-- Validated in TEST only. Production rollout is a separate action.
CREATE SCHEMA nh_access;
REVOKE ALL ON SCHEMA nh_access FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA nh_access TO authenticated;

-- Definer is required to read the caller's billing state without recursive RLS.
-- This schema is not exposed through the Data API; the helper returns only a boolean.
CREATE FUNCTION nh_access.has_paid_access(p_require_premium boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE caller uuid := (SELECT auth.uid());
BEGIN
  IF caller IS NULL OR p_require_premium IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=caller AND p.role='admin') THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.club_subscription_requests s
    JOIN public.club_subscription_monthly_dues d ON d.subscription_id=s.id
    WHERE s.user_id=caller AND s.status='approved'
      AND s.plan IN ('basic','plus','plus_performance')
      AND (NOT p_require_premium OR s.plan IN ('plus','plus_performance'))
      AND d.status='paid' AND d.amount_eur>0
      AND d.period_month=date_trunc('month',now() AT TIME ZONE 'Europe/Madrid')::date
  );
END;
$fn$;
REVOKE ALL ON FUNCTION nh_access.has_paid_access(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION nh_access.has_paid_access(boolean) TO authenticated;

-- RESTRICTIVE policies combine with existing policies using AND.
-- These policies cannot grant access to another athlete's rows.
CREATE POLICY nh_paid_premium_gate ON public.weekly_training_plan
AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT nh_access.has_paid_access(true)))
WITH CHECK ((SELECT nh_access.has_paid_access(true)));
CREATE POLICY nh_paid_premium_gate ON public.workouts
AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT nh_access.has_paid_access(true)))
WITH CHECK ((SELECT nh_access.has_paid_access(true)));
CREATE POLICY nh_paid_premium_gate ON public.training_sessions
AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT nh_access.has_paid_access(true)))
WITH CHECK ((SELECT nh_access.has_paid_access(true)));
CREATE POLICY nh_paid_club_read_gate ON public.club_activities
AS RESTRICTIVE FOR SELECT TO authenticated
USING ((SELECT nh_access.has_paid_access(false)));
CREATE POLICY nh_paid_registration_gate ON public.activity_registrations
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK ((SELECT nh_access.has_paid_access(false)));
CREATE POLICY nh_paid_booking_gate ON public.session_bookings
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK ((SELECT nh_access.has_paid_access(false)));

-- This narrow RPC intentionally remains definer: athletes may change completed
-- only, without gaining table UPDATE permissions for the prescribed content.
CREATE OR REPLACE FUNCTION public.mark_training_completed(p_id uuid,p_completed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
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
$fn$;
REVOKE ALL ON FUNCTION public.mark_training_completed(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mark_training_completed(uuid,boolean) TO authenticated;

