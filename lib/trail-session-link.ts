import type { SupabaseClient } from '@supabase/supabase-js';
export type TrailSessionChoice = { id: string; session_date: string; title: string };
export const isSessionId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function validTrailDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '2000-01-01' && value <= '2100-12-31';
}
export function trailLinkContext(params: URLSearchParams, today: string) {
  const id = params.get('session') ?? '', date = params.get('date') ?? '';
  return { session: isSessionId(id) ? id : '', date: validTrailDate(date) && date <= today ? date : today };
}
export function trailSessionHref(path: '/importar-actividad' | '/seguimiento-trail', session: TrailSessionChoice) {
  return path + '?' + new URLSearchParams({ session: session.id, date: session.session_date }).toString();
}
export async function loadTrailSessionChoices(client: SupabaseClient, athlete: string, date: string, retainId = '') {
  if (!athlete || !validTrailDate(date) || (retainId && !isSessionId(retainId))) throw new Error('Selecciona una fecha y una sesión válidas.');
  const start = new Date(date + 'T12:00:00Z'), end = new Date(start);
  start.setUTCDate(start.getUTCDate() - 7); end.setUTCDate(end.getUTCDate() + 7);
  const rows: TrailSessionChoice[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await client.from('weekly_training_plan').select('id,session_date,title')
      .eq('athlete_id', athlete).eq('category', 'trail')
      .gte('session_date', start.toISOString().slice(0, 10)).lte('session_date', end.toISOString().slice(0, 10))
      .order('session_date').order('id').range(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []) as TrailSessionChoice[]);
    if (!data || data.length < 500) break;
  }
  if (retainId && !rows.some(r => r.id === retainId)) {
    const { data, error } = await client.from('weekly_training_plan').select('id,session_date,title')
      .eq('athlete_id', athlete).eq('category', 'trail').eq('id', retainId).maybeSingle();
    if (error) throw error;
    if (data) rows.push(data as TrailSessionChoice);
  }
  return rows.sort((a, b) => a.session_date.localeCompare(b.session_date) || a.id.localeCompare(b.id));
}
