"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import AthleteOverview from '@/components/AthleteOverview';
import { AthleteAccessError, loadAthleteCard, type AthleteCard } from '@/lib/athlete-detail';
import styles from '@/components/athlete-panels.module.css';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
export default function AthleteCardPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{ key: string; card: AthleteCard | null; error: string } | null>(null);
  const key = id + ':' + reload;
  useEffect(() => {
    let active = true;
    loadAthleteCard(supabase, id).then(card => { if (active) setResult({ key, card, error: '' }); }).catch(error => {
      if (!active) return;
      if (error instanceof AthleteAccessError && error.reason === 'login') { window.location.replace('/login'); return; }
      setResult({ key, card: null, error: error instanceof AthleteAccessError ? error.message : 'No se pudo cargar la ficha. Comprueba la conexión y vuelve a intentarlo.' });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') { active = false; setResult(null); window.location.replace('/login'); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [id, key]);
  const loaded = result?.key === key ? result : null;
  const card = loaded?.card;
  return <main className={styles.page}><div className={styles.inner}>
    <p className={styles.brand}>NH TRAINING CONCEPT</p><h1>Ficha del deportista</h1><p className={styles.intro}>NH Trail Club · Entrenamientos, evolución y seguimiento individual.</p>
    <nav className={styles.nav}><Link className={styles.link} href="/deportistas">← Deportistas</Link><Link className={styles.link} href="/dashboard">Panel principal</Link></nav>
    {!loaded ? <p role="status">Comprobando acceso y cargando ficha…</p> : loaded.error ? <section className={styles.panel} role="alert"><p className={styles.error}>{loaded.error}</p><button type="button" className={styles.field} onClick={() => setReload(n => n + 1)}>Reintentar ficha</button></section> : !card ? <p className={styles.intro}>La ficha no existe o ya no está disponible.</p> : <>
      <section className={styles.panel}><h2>{card.nombre}</h2><div className={styles.cards}><div><p>Nivel: <strong>{card.nivel || 'Sin definir'}</strong></p><p>Correo: {card.email || 'Sin registrar'}</p></div><div><p>Teléfono: {card.telefono || 'Sin registrar'}</p><p>Alta: {new Date(card.created_at).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })}</p></div></div><span className={styles.badge}>{card.user_id ? 'Cuenta vinculada' : 'Sin cuenta vinculada'}</span></section>
      {card.user_id ? <AthleteOverview key={card.id + ':' + card.user_id} client={supabase} athlete={card.user_id} cardId={card.id}/> : <section className={styles.panel}><h2>Seguimiento de la cuenta</h2><p className={styles.intro}>Esta ficha no tiene una cuenta vinculada. Para mostrar entrenamientos, objetivos y salidas es necesario vincular una cuenta.</p><p className={styles.note}>Los datos de contacto se conservan. No se ha creado ni vinculado ninguna cuenta automáticamente.</p></section>}
    </>}
  </div></main>;
}
