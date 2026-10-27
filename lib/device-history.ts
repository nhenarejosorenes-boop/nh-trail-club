import type { SupabaseClient } from '@supabase/supabase-js';

export type DeviceImport = {
  id: string; activity_date: string; created_at: string;
  distance_km: number | string; elevation_m: number; duration_minutes: number;
  file_format: string; linked_session_id: string | null;
};
export const IMPORT_PAGE_SIZE = 20;

export async function loadDeviceImports(client: SupabaseClient, userId: string, offset = 0) {
  if (!userId || !Number.isSafeInteger(offset) || offset < 0) throw new Error('Consulta no válida.');
  const { data, error } = await client.from('trail_activity_log')
    .select('id,activity_date,created_at,distance_km,elevation_m,duration_minutes,file_format,linked_session_id')
    .eq('athlete_id', userId).eq('source', 'file')
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .range(offset, offset + IMPORT_PAGE_SIZE);
  if (error) throw error;
  const rows = (data ?? []) as DeviceImport[];
  return { entries: rows.slice(0, IMPORT_PAGE_SIZE), hasMore: rows.length > IMPORT_PAGE_SIZE };
}
