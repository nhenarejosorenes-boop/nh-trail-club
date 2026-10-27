import type { SupabaseClient } from '@supabase/supabase-js';
import { isSessionId } from './trail-session-link.ts';
import { monthRange, type ProgressSession } from './training-progress.ts';
import { loadTrailMonth } from './trail-log.ts';
import { loadRunnerGoals } from './runner-goals.ts';

export type AthleteCard = { id: string; nombre: string; email: string | null; telefono: string | null; nivel: string | null; created_at: string; user_id: string | null };
export type AthleteFeedback = { session_id: string; effort: number | null; sensations: string; updated_at: string };
export class AthleteAccessError extends Error {
  readonly reason: 'login' | 'forbidden';
  constructor(reason: 'login' | 'forbidden') { super(reason === 'login' ? 'Inicia sesión para consultar las fichas.' : 'Acceso exclusivo para administradores.'); this.reason = reason; }
}
export async function loadAthleteCard(client: SupabaseClient, id: string) {
  if (!isSessionId(id)) throw new Error('La ficha solicitada no es válida.');
  const auth = await client.auth.getUser();
  if (auth.error || !auth.data.user) throw new AthleteAccessError('login');
  const profile = await client.from('profiles').select('role').eq('id', auth.data.user.id).single();
  if (profile.error) throw profile.error;
  if (profile.data?.role !== 'admin') throw new AthleteAccessError('forbidden');
  const result = await client.from('deportistas').select('id,nombre,email,telefono,nivel,created_at,user_id').eq('id', id).maybeSingle();
  if (result.error) throw result.error;
  return result.data as AthleteCard | null;
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
export async function loadAthleteMonth(client: SupabaseClient, athlete: string, month: string) {
  if (!isSessionId(athlete) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month < '2000-01' || month > '2100-12') throw new Error('Revisa el deportista y el mes.');
  const range = monthRange(month);
  const [sessions, entries, goals] = await Promise.all([
    pages<ProgressSession>((from, to) => client.from('weekly_training_plan').select('id,session_date,category,title,completed')
      .eq('athlete_id', athlete).gte('session_date', range.start).lt('session_date', range.end)
      .order('session_date', { ascending: false }).order('id').range(from, to)),
    loadTrailMonth(client, athlete, range),
    loadRunnerGoals(client, athlete),
  ]);
  const feedback: AthleteFeedback[] = [];
  for (let offset = 0; offset < sessions.length; offset += 100) {
    const ids = sessions.slice(offset, offset + 100).map(s => s.id);
    feedback.push(...await pages<AthleteFeedback>((from, to) => client.from('training_session_results').select('session_id,effort,sensations,updated_at')
      .eq('athlete_id', athlete).in('session_id', ids).order('session_id').range(from, to)));
  }
  return { sessions, entries, goals, feedback };
}
export function loadAthleteRoster(client: SupabaseClient) {
  return pages<AthleteCard>((from, to) => client.from('deportistas').select('id,nombre,email,telefono,nivel,created_at,user_id')
    .order('created_at', { ascending: false }).order('id').range(from, to));
}
export type AthleteMonth = Awaited<ReturnType<typeof loadAthleteMonth>>;
export function athletePlanHref(athlete: string, date: string) {
  return '/entrenamientos/plan?' + new URLSearchParams({ athlete, date }).toString();
}
