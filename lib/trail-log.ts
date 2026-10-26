import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrailEntry } from "./training-progress";

export async function loadTrailMonth(client: SupabaseClient, userId: string, range: { start: string; end: string }) {
  if (!userId) throw new Error("Inicia sesión para consultar tus salidas.");
  const entries: TrailEntry[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("trail_activity_log")
      .select("id,activity_date,distance_km,elevation_m,duration_minutes,effort,feelings")
      .eq("athlete_id", userId).gte("activity_date", range.start).lt("activity_date", range.end)
      .order("activity_date", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as TrailEntry[];
    entries.push(...page);
    if (page.length < pageSize) return entries;
  }
}

export type TrailDraft = { date: string; distance: string; elevation: string; duration: string; effort: string; feelings: string };

export function trailRecord(draft: TrailDraft, today: string) {
  const parsedDate = new Date(draft.date + "T12:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== draft.date || draft.date < "2000-01-01" || draft.date > today) {
    throw new Error("Selecciona una fecha válida, desde el año 2000 hasta hoy.");
  }
  function numeric(value: string, label: string, min: number, max: number, integer = false) {
    const n = Number(value);
    if (!value.trim() || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw new Error("Revisa el valor de " + label + ".");
    return n;
  }
  if (draft.feelings.trim().length > 1000) throw new Error("Las sensaciones deben tener como máximo 1000 caracteres.");
  return {
    activity_date: draft.date,
    distance_km: numeric(draft.distance, "distancia", 0, 500),
    elevation_m: numeric(draft.elevation, "desnivel", 0, 30000, true),
    duration_minutes: numeric(draft.duration, "duración", 1, 10080, true),
    effort: draft.effort === "" ? null : numeric(draft.effort, "esfuerzo", 1, 10, true),
    feelings: draft.feelings.trim(),
  };
}
