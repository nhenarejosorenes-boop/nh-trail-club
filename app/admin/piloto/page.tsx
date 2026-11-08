"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from "@/lib/supabase-browser";
import PilotReadinessContent from '@/components/PilotReadiness';
import { loadPilotReadiness, type PilotReadiness } from '@/lib/pilot-readiness';
import { AthleteAccessError } from '@/lib/athlete-detail';
import { membershipMonth } from '@/lib/membership-model';
import styles from '@/components/athlete-panels.module.css';


export default function PilotPage() {
  const [reload,setReload] = useState(0);
  const [result,setResult] = useState<{ key: number; data: PilotReadiness | null; error: string } | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => setReload(value => value+1);
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus',refresh); document.addEventListener('visibilitychange',visible);
    loadPilotReadiness(supabase).then(data => {
      if (!active) return;
      if (data.period !== membershipMonth()) { refresh(); return; }
      setResult({key:reload,data,error:''});
    }).catch(error => {
      if (!active) return;
      if (error instanceof AthleteAccessError && error.reason === 'login') { setResult(null); window.location.replace('/login'); return; }
      setResult({key:reload,data:null,error:error instanceof AthleteAccessError ? error.message : 'No se pudo comprobar la preparación del piloto. Reintenta la consulta.'});
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') { active=false; setResult(null); window.location.replace('/login'); }
      else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') { active=false; setResult(null); refresh(); }
    });
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    },60000);
    return () => { active=false; subscription.unsubscribe(); window.removeEventListener('focus',refresh); document.removeEventListener('visibilitychange',visible); window.clearInterval(timer); };
  },[reload]);
  const loaded = result?.key === reload ? result : null;
  return <main className={styles.page}><div className={styles.inner}>
    <p className={styles.brand}>NH / ADMINISTRACIÓN</p><h1>Preparación del piloto</h1>
    <p className={styles.intro}>Básica, PLUS y PLUS Performance · Requisitos actuales y guía para las pruebas con corredores.</p>
    <nav className={styles.nav}><Link className={styles.link} href="/dashboard">Panel principal</Link><Link className={styles.link} href="/admin">Administración</Link></nav>
    <button className={styles.field} type="button" disabled={!loaded} onClick={() => setReload(value => value+1)}>Actualizar comprobaciones</button>
    {!loaded ? <p role="status">Comprobando acceso, fichas y cuotas…</p> : loaded.error ? <p className={styles.error} role="alert">{loaded.error}</p> : loaded.data ? <PilotReadinessContent data={loaded.data}/> : null}
  </div></main>;
}
