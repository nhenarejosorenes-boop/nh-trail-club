"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { athleteToday, monthRange, trainingProgress, type TrailEntry } from "@/lib/training-progress";
import { loadTrailMonth, trailRecord, type TrailDraft } from "@/lib/trail-log";
import styles from "@/components/athlete-panels.module.css";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
const emptyDraft = (): TrailDraft => ({ date: athleteToday(), distance: "", elevation: "", duration: "", effort: "", feelings: "" });
const field: React.CSSProperties = { width: "100%", boxSizing: "border-box" };
const button: React.CSSProperties = { background: "#f28c28", border: 0, borderRadius: 8, padding: "12px 18px", fontWeight: 700, cursor: "pointer", color: "#111" };

export default function SeguimientoTrail() {
  const [uid, setUid] = useState("");
  const [month, setMonth] = useState(() => athleteToday().slice(0, 7));
  const [entries, setEntries] = useState<TrailEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedMonth, setLoadedMonth] = useState("");
  const [busy, setBusy] = useState(false);
  const operationInFlight = useRef(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState<TrailDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const formSection = useRef<HTMLElement>(null);
  const today = athleteToday();
  const waiting = loading || loadedMonth !== month;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (!active) return;
        if (authError || !data.user) { window.location.replace("/login"); return; }
        setUid(data.user.id);
      } catch { if (active) { setLoadError("No se pudo comprobar tu sesión. Vuelve a cargar la página."); setLoading(false); } }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    setLoading(true); setLoadError("");
    (async () => {
      try {
        const data = await loadTrailMonth(supabase, uid, monthRange(month));
        if (active) { setEntries(data); setLoadedMonth(month); }
      } catch { if (active) setLoadError("No se pudieron cargar las salidas. Comprueba la conexión e inténtalo de nuevo."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [uid, month, reload]);

  function change(fieldName: keyof TrailDraft, value: string) { setDraft(d => ({ ...d, [fieldName]: value })); }
  function clearEditor() { setEditingId(null); setDraft(emptyDraft()); }
  function edit(entry: TrailEntry) {
    if (operationInFlight.current) return;
    setEditingId(entry.id);
    setDraft({ date: entry.activity_date, distance: String(entry.distance_km), elevation: String(entry.elevation_m), duration: String(entry.duration_minutes), effort: entry.effort === null ? "" : String(entry.effort), feelings: entry.feelings ?? "" });
    setError(""); setMessage("");
    formSection.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    formSection.current?.focus({ preventScroll: true });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uid || operationInFlight.current) return;
    let record;
    try { record = trailRecord(draft, today); }
    catch (e) { setError(e instanceof Error ? e.message : "Revisa los campos del entrenamiento."); return; }
    operationInFlight.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const result = editingId
        ? await supabase.from("trail_activity_log").update(record).eq("id", editingId).eq("athlete_id", uid).select("id")
        : await supabase.from("trail_activity_log").insert({ ...record, athlete_id: uid }).select("id");
      if (result.error) throw result.error;
      if (!result.data?.length) { setError("No se guardaron cambios. La salida puede haber sido eliminada; vuelve a cargar el historial."); return; }
      setMessage(editingId ? "Salida actualizada." : "Salida registrada.");
      clearEditor(); setMonth(record.activity_date.slice(0, 7)); setReload(n => n + 1); setLoading(true);
    } catch {
      setError("No se pudo confirmar el guardado. Vuelve a cargar el historial y comprueba si aparece la salida antes de intentarlo de nuevo.");
    } finally { operationInFlight.current = false; setBusy(false); }
  }
  async function remove(id: string) {
    if (!uid || operationInFlight.current || !window.confirm("¿Eliminar esta salida del registro?")) return;
    operationInFlight.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const result = await supabase.from("trail_activity_log").delete().eq("id", id).eq("athlete_id", uid).select("id");
      if (result.error) throw result.error;
      if (editingId === id) clearEditor();
      setMessage(result.data?.length ? "Salida eliminada." : "La salida ya no estaba disponible. Historial actualizado.");
      setReload(n => n + 1); setLoading(true);
    } catch { setError("No se pudo confirmar la eliminación. Vuelve a cargar el historial para comprobar el estado de la salida."); }
    finally { operationInFlight.current = false; setBusy(false); }
  }
  function retry() {
    if (!uid) { window.location.reload(); return; }
    setLoading(true); setReload(n => n + 1);
  }
  const progress = trainingProgress([], entries, month, today);
  const canShowHistory = !waiting && !loadError;
  return <main className={styles.page}><div className={styles.inner}>
    <p className={styles.brand}>NH TRAINING CONCEPT</p><h1>Seguimiento de trail running</h1>
    <p className={styles.intro}>Registra tus salidas realizadas, corrige sus datos y consulta el historial por mes.</p>
    <nav className={styles.nav}><Link className={styles.link} href="/dashboard">Mi panel</Link><Link className={styles.link} href="/progreso">Mi progreso</Link><Link className={styles.link} href="/entrenamientos/trail">Plan de trail</Link></nav>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {message && <p role="status" className={styles.done}>{message}</p>}
    <div className={styles.controls}>
      <label>Mes del historial<input className={styles.field} type="month" min="2000-01" max={today.slice(0, 7)} value={month} disabled={busy} onChange={e => {
        const value = e.target.value;
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= "2000-01" && value <= today.slice(0, 7) && value !== month) {
          setMonth(value); setLoading(true); clearEditor(); setError(""); setMessage("");
        }
      }} /></label>
      <button type="button" style={button} disabled={busy || loading} onClick={retry}>Volver a cargar historial</button>
    </div>
    {loadError ? <p role="alert" className={styles.error}>{loadError}</p> : waiting ? <p role="status">Cargando salidas del mes...</p> : <section className={styles.stats} aria-label="Resumen del mes seleccionado">
      {[["Kilómetros del mes", progress.km.toFixed(1) + " km"], ["Desnivel positivo", progress.elevation + " m+"], ["Tiempo total", Math.floor(progress.minutes / 60) + " h " + progress.minutes % 60 + " min"], ["Esfuerzo medio", progress.averageEffort === null ? "Sin datos" : progress.averageEffort.toFixed(1) + " / 10"], ["Salidas registradas", progress.runs]].map(([label, value]) => <div key={label} className={styles.stat}><p>{label}</p><strong>{value}</strong></div>)}
    </section>}
    <section className={styles.panel} ref={formSection} tabIndex={-1} aria-labelledby="trail-form-title">
      <h2 id="trail-form-title">{editingId ? "Editar salida" : "Añadir salida realizada"}</h2>
      <form onSubmit={save}><fieldset disabled={busy || !uid} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16 }}>
        <legend className={styles.note}>Datos de la salida</legend>
        <label>Fecha<input className={styles.field} style={field} type="date" min="2000-01-01" max={today} value={draft.date} onChange={e => change("date", e.target.value)} required /></label>
        <label>Distancia (km)<input className={styles.field} style={field} type="number" min="0" max="500" step=".01" value={draft.distance} onChange={e => change("distance", e.target.value)} required /></label>
        <label>Desnivel positivo (m)<input className={styles.field} style={field} type="number" min="0" max="30000" step="1" value={draft.elevation} onChange={e => change("elevation", e.target.value)} required /></label>
        <label>Duración (minutos)<input className={styles.field} style={field} type="number" min="1" max="10080" step="1" value={draft.duration} onChange={e => change("duration", e.target.value)} required /></label>
        <label>Esfuerzo percibido (1–10)<select className={styles.field} style={field} value={draft.effort} onChange={e => change("effort", e.target.value)}><option value="">Sin indicar</option>{Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
        <label style={{ gridColumn: "1/-1" }}>Sensaciones<textarea className={styles.field} style={field} rows={3} maxLength={1000} value={draft.feelings} onChange={e => change("feelings", e.target.value)} placeholder="Cómo te has encontrado, terreno, molestias..." /></label>
        <button style={button}>{busy ? "Guardando..." : editingId ? "Guardar cambios" : "Guardar salida"}</button>
        {editingId && <button type="button" className={styles.field} onClick={clearEditor}>Cancelar edición</button>}
      </fieldset></form>
    </section>
    <section><h2>Historial del mes</h2>
      {canShowHistory && (entries.length === 0 ? <p className={styles.intro}>No hay salidas registradas en el mes seleccionado.</p> : entries.map(entry => <article key={entry.id} className={styles.panel}>
        <div className={styles.row}><strong className={styles.link}>{new Date(entry.activity_date + "T12:00:00Z").toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "long", year: "numeric" })}</strong>
          <div style={{ display: "flex", gap: 12 }}><button type="button" style={button} disabled={busy} aria-label={"Editar salida del " + entry.activity_date} onClick={() => edit(entry)}>Editar</button><button type="button" className={styles.field} disabled={busy} aria-label={"Eliminar salida del " + entry.activity_date} onClick={() => void remove(entry.id)}>Eliminar</button></div>
        </div>
        <p>{Number(entry.distance_km).toFixed(2)} km · {entry.elevation_m} m+ · {entry.duration_minutes} min {entry.effort !== null ? "· Esfuerzo " + entry.effort + "/10" : ""}</p>
        {entry.feelings && <p className={styles.intro} style={{ whiteSpace: "pre-wrap" }}>{entry.feelings}</p>}
      </article>))}
    </section>
    <p className={styles.note}>El registro de una salida y la casilla de sesión completada del plan son independientes. Los totales usan las salidas del mes seleccionado.</p>
  </div></main>;
}
