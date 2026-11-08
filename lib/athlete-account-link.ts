import type { SupabaseClient } from '@supabase/supabase-js';
import { isSessionId } from './trail-session-link.ts';

export type AccountLinkCandidate = { card_id: string; user_id: string; email: string; full_name: string | null; linked: boolean };
export function accountEmail(value: string | null) { return (value ?? '').trim().toLowerCase(); }
const messages: Record<string, string> = {
  ACCOUNT_LINK_ADMIN_REQUIRED: 'Solo un administrador puede vincular cuentas.',
  ACCOUNT_LINK_INVALID_INPUT: 'Revisa el correo y la ficha del deportista.',
  ACCOUNT_LINK_CARD_MISSING: 'La ficha ya no está disponible.',
  ACCOUNT_LINK_EMAIL_CHANGED: 'El correo de la ficha ha cambiado. Recarga la ficha y compruébalo.',
  ACCOUNT_LINK_CARD_ALREADY_LINKED: 'La ficha ya tiene una cuenta vinculada. Recarga para comprobarla.',
  ACCOUNT_LINK_NO_ELIGIBLE_ACCOUNT: 'No hay una cuenta de deportista disponible con ese correo confirmado. Comprueba que haya creado su cuenta y confirmado el correo.',
  ACCOUNT_LINK_AMBIGUOUS_ACCOUNT: 'Hay más de una cuenta coincidente. Revisa las cuentas antes de continuar.',
  ACCOUNT_LINK_ACCOUNT_CHANGED: 'La cuenta encontrada ha cambiado. Busca de nuevo antes de confirmar.',
  ACCOUNT_LINK_ACCOUNT_IN_USE: 'Esta cuenta ya está vinculada a otra ficha.',
};
export function accountLinkError(error: unknown) {
  if (error && typeof error === 'object') {
    const value = error as { message?: unknown; code?: unknown };
    if (typeof value.message === 'string' && messages[value.message]) return messages[value.message];
    if (value.code === 'PGRST202' || value.code === '42883') return 'La vinculación de cuentas todavía no está disponible. Contacta con administración.';
  }
  return 'No se pudo confirmar la operación. Comprueba la conexión y recarga la ficha antes de volver a intentarlo.';
}
function validate(cardId: string, email: string) {
  if (!isSessionId(cardId) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ACCOUNT_LINK_INVALID_INPUT');
}
function candidate(data: unknown, cardId: string, email: string, linked: boolean): AccountLinkCandidate {
  const row = data as AccountLinkCandidate | null;
  if (!row || row.card_id !== cardId || !isSessionId(row.user_id) || typeof row.email !== 'string'
    || accountEmail(row.email) !== email || row.linked !== linked
    || (row.full_name !== null && typeof row.full_name !== 'string')) throw new Error('Invalid account link response');
  return row;
}
export async function previewAccountLink(client: SupabaseClient, cardId: string, contactEmail: string) {
  const email = accountEmail(contactEmail); validate(cardId, email);
  const { data, error } = await client.rpc('preview_athlete_account_link', { p_card_id: cardId, p_email: email });
  if (error) throw error;
  return candidate(data, cardId, email, false);
}
export async function confirmAccountLink(client: SupabaseClient, preview: AccountLinkCandidate) {
  const email = accountEmail(preview.email); validate(preview.card_id, email);
  if (!isSessionId(preview.user_id) || preview.linked) throw new Error('Invalid account link preview');
  const { data, error } = await client.rpc('confirm_athlete_account_link', { p_card_id: preview.card_id, p_email: email, p_user_id: preview.user_id });
  if (error) throw error;
  const result = candidate(data, preview.card_id, email, true);
  if (result.user_id !== preview.user_id) throw new Error('Account link response changed');
  return result;
}
