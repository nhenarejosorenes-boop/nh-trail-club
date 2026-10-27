import type { SupabaseClient } from '@supabase/supabase-js';
import { readStructure, type TrainingSession } from './training-builder.ts';
import type { TrailEntry } from './training-progress.ts';

export type LinkedTrailEntry = TrailEntry & { athlete_id: string };
export async function loadLinkedTrail(client: SupabaseClient, athlete: string, sessionIds: readonly string[]) {
  if (!athlete) throw new Error('Selecciona un deportista.');
  const ids = [...new Set(sessionIds)];
  const rows: LinkedTrailEntry[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    for (let from = 0; ; from += 500) {
      const { data, error } = await client.from('trail_activity_log')
        .select('id,athlete_id,activity_date,distance_km,elevation_m,duration_minutes,effort,linked_session_id')
        .eq('athlete_id', athlete).in('linked_session_id', ids.slice(offset, offset + 100))
        .order('id').range(from, from + 499);
      if (error) throw error;
      rows.push(...(data ?? []) as LinkedTrailEntry[]);
      if (!data || data.length < 500) break;
    }
  }
  return rows;
}

function target(value: string | undefined, max: number, min = 0) {
  if (!value?.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}
export function compareTrailSession(session: TrainingSession, entries: readonly LinkedTrailEntry[]) {
  const runs = session.category === 'trail' ? [...new Map(entries.filter(e => e.athlete_id === session.athlete_id && e.linked_session_id === session.id).map(e => [e.id, e])).values()] : [];
  const t = session.category === 'trail' ? readStructure(session.structure)?.targets : undefined;
  const minutes = runs.reduce((sum, r) => sum + r.duration_minutes, 0);
  const reported = runs.filter(r => r.effort !== null);
  // Multiple linked activities are a single session comparison, never extra plan completions.
  return {
    runs, planned: { distance: target(t?.distance, 500), elevation: target(t?.elevation, 30000), minutes: target(t?.minutes, 10080, 1), effort: target(t?.effort, 10, 1) },
    actual: runs.length ? {
      distance: runs.reduce((sum, r) => sum + Number(r.distance_km), 0),
      elevation: runs.reduce((sum, r) => sum + r.elevation_m, 0), minutes,
      effort: reported.length === runs.length && minutes > 0 ? reported.reduce((sum, r) => sum + r.duration_minutes * r.effort!, 0) / minutes : null,
    } : null,
    missingEffort: runs.length - reported.length,
  };
}
