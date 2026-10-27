import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProgressSession, TrailEntry } from './training-progress.ts';
import { validTrailDate, isSessionId } from './trail-session-link.ts';

export function shiftDay(date: string, days: number) {
  const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function madridWeekBounds(today: string) {
  if (!validTrailDate(today)) throw new Error('Fecha no válida.');
  const weekday = new Date(today + 'T12:00:00Z').getUTCDay();
  const start = shiftDay(today, -(weekday + 6) % 7);
  return [start, shiftDay(start, 7)] as const;
}
async function pages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await fetchPage(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}
export async function loadDailyTraining(client: SupabaseClient, athlete: string, today: string, premium: boolean) {
  if (!athlete || !validTrailDate(today)) throw new Error('No se pudo comprobar el contexto del panel.');
  const [sessions, entries] = await Promise.all([
    premium ? pages<ProgressSession>((from, to) => client.from('weekly_training_plan')
      .select('id,session_date,category,title,completed').eq('athlete_id', athlete)
      .gte('session_date', today).lt('session_date', shiftDay(today, 14))
      .order('session_date').order('id').range(from, to)) : Promise.resolve([] as ProgressSession[]),
    pages<TrailEntry>((from, to) => client.from('trail_activity_log')
      .select('id,activity_date,distance_km,elevation_m,duration_minutes,effort,linked_session_id')
      .eq('athlete_id', athlete).gte('activity_date', shiftDay(today, -29)).lt('activity_date', shiftDay(today, 1))
      .order('activity_date', { ascending: false }).order('id').range(from, to)),
  ]);
  return dailyTraining(sessions, entries, today);
}
export function dailyTraining(sessions: readonly ProgressSession[], entries: readonly TrailEntry[], today: string) {
  const plan = sessions.filter(s => s.session_date >= today && s.session_date < shiftDay(today, 14))
    .toSorted((a, b) => a.session_date.localeCompare(b.session_date) || a.id.localeCompare(b.id));
  const recent = entries.filter(e => e.activity_date >= shiftDay(today, -29) && e.activity_date <= today)
    .toSorted((a, b) => b.activity_date.localeCompare(a.activity_date) || a.id.localeCompare(b.id));
  return {
    todaySessions: plan.filter(s => s.session_date === today),
    next: plan.find(s => s.session_date > today && !s.completed) ?? null,
    missingEffort: recent.filter(e => e.effort === null),
    unlinked: recent.filter(e => !e.linked_session_id),
    toReview: recent.filter(e => e.effort === null || !e.linked_session_id),
    start: shiftDay(today, -29), end: today,
  };
}
export type DailyTraining = ReturnType<typeof dailyTraining>;
export function sessionPlanHref(session: Pick<ProgressSession, 'id' | 'session_date'>) {
  return '/entrenamientos/plan?' + new URLSearchParams({ date: session.session_date, session: session.id }).toString();
}
export function trailEntryHref(entry: Pick<TrailEntry, 'id' | 'activity_date'>) {
  return '/seguimiento-trail?' + new URLSearchParams({ date: entry.activity_date, entry: entry.id }).toString();
}
export function requestedEntry(params: URLSearchParams) {
  const id = params.get('entry') ?? '';
  return isSessionId(id) ? id : '';
}
