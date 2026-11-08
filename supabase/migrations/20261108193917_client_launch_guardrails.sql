-- Optimistic billing edits: a stale admin cannot overwrite a more recent payment.
ALTER TABLE public.club_subscription_monthly_dues ADD COLUMN revision integer NOT NULL DEFAULT 1;
CREATE FUNCTION public.protect_monthly_due() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
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
$fn$;
REVOKE ALL ON FUNCTION public.protect_monthly_due() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER protect_monthly_due BEFORE INSERT OR UPDATE ON public.club_subscription_monthly_dues FOR EACH ROW EXECUTE FUNCTION public.protect_monthly_due();

-- Keep aggregate capacity accurate despite registration RLS, with an explicit gate.
CREATE FUNCTION nh_access.activity_slots(p_activity_id uuid)
RETURNS TABLE(inscritos bigint,plazas_disponibles bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT nh_access.has_paid_access(false) THEN
  RAISE EXCEPTION 'Necesitas acceso activo al club' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT count(r.id)::bigint,
 CASE WHEN a.max_participants IS NULL THEN NULL ELSE greatest(a.max_participants::bigint-count(r.id),0) END
 FROM public.club_activities a LEFT JOIN public.activity_registrations r ON r.activity_id=a.id
 WHERE a.id=p_activity_id GROUP BY a.id,a.max_participants;
END;
$fn$;
REVOKE ALL ON FUNCTION nh_access.activity_slots(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION nh_access.activity_slots(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.obtener_plazas_actividad(p_activity_id uuid)
RETURNS TABLE(inscritos bigint,plazas_disponibles bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $fn$
 SELECT * FROM nh_access.activity_slots(p_activity_id);
$fn$;
REVOKE ALL ON FUNCTION public.obtener_plazas_actividad(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.obtener_plazas_actividad(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.controlar_plazas() FROM PUBLIC,anon,authenticated;
