import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrailEntry, ProgressSession } from "./training-progress";

export type CoachAthlete = { id: string; nombre: string; nivel: string | null; user_id: string | null };
export type CoachLog = TrailEntry & { athlete_id: string };
export type CoachPlan = ProgressSession & { athlete_id: string };

async function pages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await fetchPage(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}

export function loadCoachAthletes(client: SupabaseClient) {
  return pages<CoachAthlete>((from, to) => client.from("deportistas").select("id,nombre,nivel,user_id")
    .order("nombre").order("id").range(from, to));
}

// The caller verifies the administrator role; RLS remains authoritative for every page.
export async function loadCoachMonth(client: SupabaseClient, range: { start: string; end: string }) {
  const [logs, plans] = await Promise.all([
    pages<CoachLog>((from, to) => client.from("trail_activity_log")
      .select("id,athlete_id,activity_date,distance_km,elevation_m,duration_minutes,effort")
      .gte("activity_date", range.start).lt("activity_date", range.end)
      .order("activity_date", { ascending: false }).order("id").range(from, to)),
    pages<CoachPlan>((from, to) => client.from("weekly_training_plan")
      .select("id,athlete_id,session_date,category,title,completed")
      .gte("session_date", range.start).lt("session_date", range.end)
      .order("session_date", { ascending: false }).order("id").range(from, to)),
  ]);
  return { logs, plans };
}

export function plannerContext(athletes: readonly { user_id: string | null }[], fallbackId: string, requestedId: string | null, requestedDate: string | null) {
  const athleteId = requestedId && athletes.some(a => a.user_id === requestedId) ? requestedId : fallbackId;
  let week: string | null = null;
  if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate >= "2000-01-01" && requestedDate <= "2100-12-31") {
    const date = new Date(requestedDate + "T12:00:00Z");
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === requestedDate) {
      date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
      week = date.toISOString().slice(0, 10);
    }
  }
  return { athleteId, week };
}
