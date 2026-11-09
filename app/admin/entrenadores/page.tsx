"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import styles from "@/components/athlete-panels.module.css";

type Account = { id: string; email: string; full_name: string | null; role: "athlete" | "coach" };
function message(error: unknown) {
  return error && typeof error === "object" && "message" in error ? String(error.message) : "No se pudo completar la operación. Comprueba tu conexión.";
}

export default function CoachesPage() {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [email, setEmail] = useState("");
  const [coaches, setCoaches] = useState<Account[]>([]);
  const [candidate, setCandidate] = useState<Account | null>(null);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [uncertain, setUncertain] = useState(false);
  async function list() {
    const result = await supabase.rpc("coach_accounts_list");
    if (result.error) throw result.error;
    setCoaches(result.data as Account[]);
  }
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const auth = await supabase.auth.getUser();
        if (!active) return;
        if (auth.error || !auth.data.user) { window.location.replace("/login"); return; }
        const profile = await supabase.from("profiles").select("role").eq("id", auth.data.user.id).single();
        if (profile.error) throw profile.error;
        if (!active) return;
        if (profile.data?.role !== "admin") { setError("Solo administración puede gestionar entrenadores."); return; }
        const result = await supabase.rpc("coach_accounts_list");
        if (result.error) throw result.error;
        if (active) { setCoaches(result.data as Account[]); setAllowed(true); }
      } catch (failure) { if (active) setError(message(failure)); }
      finally { if (active) setChecking(false); }
    })();
    return () => { active = false; };
  }, []);
  async function search(event: FormEvent) {
    event.preventDefault();
    if (lock.current || uncertain) return;
    lock.current = true; setBusy(true); setError(""); setStatus(""); setCandidate(null); setVerified(false);
    try {
      const result = await supabase.rpc("coach_account_lookup", { p_email: email.trim() });
      if (result.error) throw result.error;
      setCandidate(result.data as Account);
    } catch (failure) { setError(message(failure)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function save() {
    if (lock.current || !candidate || !verified || uncertain) return;
    const account = candidate;
    lock.current = true; setBusy(true); setError(""); setStatus("");
    try {
      const result = await supabase.rpc("coach_access_set", {
        p_user: account.id, p_email: account.email, p_expected_role: account.role, p_enabled: account.role !== "coach",
      });
      if (result.error) throw result.error;
      setCandidate(null); setVerified(false);
      setStatus(account.role === "coach" ? "Acceso de entrenador retirado. La cuenta vuelve a ser de deportista." : "Perfil Entrenador activado. Ya puede acceder con su propia cuenta.");
      await list();
    } catch (failure) {
      setError(message(failure)); setUncertain(true); setCandidate(null); setStatus("");
    } finally { lock.current = false; setBusy(false); }
  }
  return <main className={styles.page}><div className={styles.inner}>
    <p className={styles.brand}>NH CLUB TRAIL RUNNING ALICANTE · ADMINISTRACIÓN</p>
    <Link className={styles.back} href="/dashboard">← Mi panel</Link>
    <h1>Entrenadores</h1>
    {checking ? <p role="status">Comprobando permisos…</p> : allowed ? <>
      <p className={styles.intro}>El entrenador debe registrarse con su propio correo y confirmarlo. Después puedes buscar su cuenta y activar su acceso.</p>
      <section className={styles.panel}><h2>Permisos del perfil Entrenador</h2>
        <p>Puede programar fuerza y trail, gestionar objetivos y etapas, consultar resultados deportivos y responder mensajes de los deportistas del club.</p>
        <p>Las cuotas, suscripciones, altas y vinculación de fichas, permisos y administración del club quedan reservados a administración.</p>
      </section>
      <section className={styles.panel} aria-busy={busy}>
        <h2>Gestionar acceso de una cuenta</h2>
        <form onSubmit={search}><label>Correo de registro
          <input className={styles.field} type="email" value={email} required maxLength={254} disabled={busy || uncertain} onChange={event => { setEmail(event.target.value); setCandidate(null); setVerified(false); }} />
        </label><p><button className={styles.field} disabled={busy || uncertain} type="submit">Buscar cuenta</button></p></form>
        {candidate && <div><h3>Revisa la cuenta</h3><p>{candidate.full_name || "Sin nombre"} · {candidate.email}</p>
          <p>Perfil actual: {candidate.role === "coach" ? "Entrenador" : "Deportista"}</p>
          <label><input type="checkbox" checked={verified} disabled={busy} onChange={event => setVerified(event.target.checked)} /> He comprobado la identidad y quiero {candidate.role === "coach" ? "retirar" : "conceder"} el acceso de entrenador a esta cuenta.</label>
          <p><button className={styles.field} type="button" disabled={busy || !verified} onClick={() => void save()}>{candidate.role === "coach" ? "Retirar acceso de entrenador" : "Activar perfil Entrenador"}</button></p>
        </div>}
        {busy && <p role="status">Comprobando y guardando…</p>}
        {uncertain && <p>Recarga y comprueba el perfil antes de repetir la operación. <button type="button" onClick={() => window.location.reload()}>Recargar estado</button></p>}
      </section>
      <section className={styles.panel}><h2>Entrenadores del club</h2>
        {coaches.length ? <ul>{coaches.map(account => <li key={account.id}><strong>{account.full_name || "Entrenador"}</strong> · {account.email}</li>)}</ul> : <p>Todavía no has activado ningún entrenador.</p>}
      </section>
    </> : <button type="button" onClick={() => window.location.reload()}>Volver a comprobar</button>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {status && <p className={styles.done} role="status">{status}</p>}
  </div></main>;
}
