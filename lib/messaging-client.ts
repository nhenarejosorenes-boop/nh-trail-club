import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClubMessage, Conversation } from "./messaging-model";
const columns = "id,seq,athlete_id,sender_id,body,created_at,training_id,training_title,training_date";
export async function loadInbox(client: SupabaseClient) {
  const { data, error } = await client.rpc("messaging_inbox");
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("No se pudo cargar la bandeja.");
  return data as Conversation[];
}
export async function loadMessagePage(client: SupabaseClient, athlete: string, before?: number) {
  if (!athlete) throw new Error("Selecciona una conversación.");
  let query = client.from("club_messages").select(columns).eq("athlete_id", athlete).order("seq", { ascending: false }).limit(50);
  if (before !== undefined) query = query.lt("seq", before);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as ClubMessage[]).reverse();
}
export async function loadMessageUpdates(client: SupabaseClient, athlete: string, after: number) {
  if (!athlete) throw new Error("Selecciona una conversación.");
  const messages: ClubMessage[] = [];
  let cursor = after;
  for (;;) {
    const { data, error } = await client.from("club_messages").select(columns).eq("athlete_id", athlete)
      .gt("seq", cursor).order("seq", { ascending: true }).limit(100);
    if (error) throw error;
    const rows = (data ?? []) as ClubMessage[];
    messages.push(...rows);
    if (rows.length < 100) return messages;
    const next = rows.at(-1)!.seq;
    if (next <= cursor) throw new Error("No se pudo actualizar la conversación.");
    cursor = next;
  }
}
