export type ClubMessage = { id: string; seq: number; athlete_id: string; sender_id: string; body: string; created_at: string; training_id: string | null; training_title: string | null; training_date: string | null };
export type Conversation = { athlete_id: string; name: string; preview: string | null; latest_seq: number | null; latest_at: string | null; unread: number };
export function messageBody(value: string) {
  const body = value.trim();
  if (!body || Array.from(body).length > 2000) throw new Error("Escribe entre 1 y 2000 caracteres.");
  return body;
}
export function mergeMessages(current: readonly ClubMessage[], incoming: readonly ClubMessage[]) {
  const byId = new Map(current.map(message => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.seq - b.seq);
}
export function totalUnread(conversations: readonly Conversation[]) { return conversations.reduce((sum, c) => sum + c.unread, 0); }
export function initialConversation(conversations: readonly Conversation[], requested: string | null, ownId: string, admin: boolean) {
  if (!admin) return conversations.some(c => c.athlete_id === ownId) ? ownId : "";
  return conversations.some(c => c.athlete_id === requested) ? requested! : conversations[0]?.athlete_id ?? "";
}
