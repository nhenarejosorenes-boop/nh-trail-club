"use client";

import { useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AthleteCard } from '@/lib/athlete-detail';
import { accountEmail, accountLinkError, previewAccountLink, confirmAccountLink, type AccountLinkCandidate } from '@/lib/athlete-account-link';
import styles from './athlete-panels.module.css';

export default function AthleteAccountLink({ client, card, onRefresh }: { client: SupabaseClient; card: AthleteCard; onRefresh: () => void }) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<AccountLinkCandidate | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [saved, setSaved] = useState(false);
  async function find() {
    if (lock.current || uncertain || saved) return;
    lock.current = true; setBusy(true); setError(''); setPreview(null); setConfirmed(false);
    try { setPreview(await previewAccountLink(client, card.id, card.email ?? '')); }
    catch (failure) { setError(accountLinkError(failure)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function link() {
    if (lock.current || !preview || !confirmed || uncertain || saved) return;
    lock.current = true; setBusy(true); setError('');
    try { await confirmAccountLink(client, preview); setSaved(true); setPreview(null); }
    catch (failure) { setError(accountLinkError(failure)); setUncertain(true); setPreview(null); }
    finally { lock.current = false; setBusy(false); }
  }
  if (card.user_id) return null;
  return <section className={styles.panel} aria-labelledby="account-link-title" aria-busy={busy}>
    <h2 id="account-link-title">Vincular la cuenta del deportista</h2>
    <p className={styles.intro}>Busca la cuenta con el mismo correo de esta ficha y revisa su identidad antes de vincularla.</p>
    <p>Correo de la ficha: <strong>{card.email || 'Sin registrar'}</strong></p>
    <p className={styles.note}>El deportista debe haber creado su cuenta y confirmado su correo. La vinculación permite gestionar su seguimiento desde esta ficha.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {busy && <p role="status">Comprobando la cuenta…</p>}
    {saved ? <div role="status"><p className={styles.done}>Cuenta vinculada correctamente.</p><button className={styles.field} type="button" onClick={onRefresh}>Abrir seguimiento de la cuenta</button></div>
      : uncertain ? <div><p className={styles.note}>Comprueba el estado actualizado antes de repetir la operación.</p><button className={styles.field} type="button" onClick={onRefresh}>Recargar ficha y comprobar estado</button></div>
      : preview ? <div>
        <h3>Revisa la cuenta encontrada</h3>
        <p>Nombre de la cuenta: <strong>{preview.full_name || 'Sin nombre registrado'}</strong></p>
        <p>Correo confirmado: <strong>{preview.email}</strong></p>
        <p className={styles.note}>El nombre lo declara el usuario. Verifica con el deportista que esta es su cuenta.</p>
        <label className={styles.intro}><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /> He comprobado que esta cuenta pertenece a {card.nombre}.</label>
        <div className={styles.controls}><button className={styles.field} type="button" disabled={busy || !confirmed} onClick={() => void link()}>Confirmar vinculación</button><button className={styles.field} type="button" disabled={busy} onClick={() => { setPreview(null); setConfirmed(false); }}>Cancelar</button></div>
      </div> : <><button className={styles.field} type="button" disabled={busy || !accountEmail(card.email)} onClick={() => void find()}>Buscar cuenta por este correo</button>{!accountEmail(card.email) && <p className={styles.note}>Añade primero el correo correcto editando la ficha en Deportistas.</p>}</>}
  </section>;
}
