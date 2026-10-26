"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import MembershipNotice from "@/components/MembershipNotice";
import { loadMembershipAccess } from "@/lib/membership-client";
import type { MembershipAccess } from "@/lib/membership-model";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
type Session = { id: string; athlete_id: string; session_date: string; category: string; title: string; details: string; completed: boolean };
type Athlete = { user_id: string | null; nombre: string };
type ExerciseDraft = { id: string; name: string; sets: string; reps: string; weight: string; rest: string };
const card: React.CSSProperties = { background: "#202020", borderRadius: 12, padding: 20, marginBottom: 14 };
const input: React.CSSProperties = { width: "100%", padding: 10, marginTop: 6, marginBottom: 14, background: "#292929", color: "white", border: "1px solid #555", borderRadius: 8, boxSizing: "border-box" };
const button: React.CSSProperties = { background: "#f28c28", color: "#111", border: 0, padding: "11px 16px", borderRadius: 8, fontWeight: "bold", cursor: "pointer" };
function dateString(d: Date) { const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,"0"); const day = String(d.getDate()).padStart(2,"0"); return y+"-"+m+"-"+day; }
function monday(d: Date) { const x = new Date(d); x.setHours(12,0,0,0); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; }

type TrainingPlanProps = { categoryFilter?: "fuerza" | "trail"; showEditor?: boolean };

export default function TrainingPlan({ categoryFilter, showEditor = false }: TrainingPlanProps) {
  const [userId, setUserId] = useState("");
  const [admin, setAdmin] = useState(false);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selected, setSelected] = useState("");
  const [week, setWeek] = useState(dateString(monday(new Date())));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [membership, setMembership] = useState<MembershipAccess | null>(null);
  const [accessError, setAccessError] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState<string>(categoryFilter ?? "trail");
  const [date, setDate] = useState(dateString(new Date()));
  const [exercises, setExercises] = useState<ExerciseDraft[]>([]);
  const [trailTarget, setTrailTarget] = useState({ distance: "", elevation: "", minutes: "", effort: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const titleInput = useRef<HTMLInputElement>(null);

  function clearEditor() {
    setEditingId(null); setTitle(""); setDetails(""); setExercises([]);
    setTrailTarget({ distance: "", elevation: "", minutes: "", effort: "" });
  }
  function editSession(session: Session) {
    clearEditor(); setEditingId(session.id); setTitle(session.title); setDetails(session.details);
    setCategory(session.category); setDate(session.session_date); setError(""); setMessage("");
    titleInput.current?.focus();
  }

  function updateExercise(id: string, field: Exclude<keyof ExerciseDraft, "id">, value: string) {
    setExercises(rows => rows.map(row => row.id === id ? { ...row, [field]: value } : row));
  }

  useEffect(() => {
    let active = true;
    async function init() {
      try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !auth.user) { window.location.replace("/login"); return; }
      setUserId(auth.user.id);
      const access = await loadMembershipAccess(supabase, auth.user.id);
      if (!active) return;
      setMembership(access);
      if (!access.premium) { setLoading(false); return; }
      setSelected(auth.user.id);
      if (access.state === "admin") {
        setAdmin(true);
        const { data, error: athletesError } = await supabase.from("deportistas").select("user_id,nombre").not("user_id","is",null).order("nombre");
        if (!active) return;
        if (athletesError) setError(athletesError.message);
        else setAthletes((data ?? []) as Athlete[]);
      }
      setLoading(false);
      } catch {
        if (active) { setAccessError(true); setLoading(false); }
      }
    }
    void init();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    async function load() {
      setLoading(true);
      const start = new Date(week+"T12:00:00");
      const end = new Date(start); end.setDate(end.getDate()+7);
      const { data, error: queryError } = await supabase.from("weekly_training_plan").select("id,athlete_id,session_date,category,title,details,completed")
        .eq("athlete_id", selected).gte("session_date",dateString(start)).lt("session_date",dateString(end)).order("session_date");
      if (active) { setSessions((data ?? []) as Session[]); setError(queryError?.message ?? ""); setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [selected,week]);

  async function refresh() {
    const start = new Date(week+"T12:00:00"); const end = new Date(start); end.setDate(end.getDate()+7);
    const { data, error: e } = await supabase.from("weekly_training_plan").select("id,athlete_id,session_date,category,title,details,completed")
      .eq("athlete_id",selected).gte("session_date",dateString(start)).lt("session_date",dateString(end)).order("session_date");
    if (e) setError(e.message); else setSessions((data ?? []) as Session[]);
  }
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!admin || !showEditor || !selected || busy) return;
    if (!title.trim()) { setError("Escribe el título de la sesión."); return; }
    const start = new Date(week+"T12:00:00"); const end = new Date(start); end.setDate(end.getDate()+7);
    if (date < dateString(start) || date >= dateString(end)) { setError("Selecciona una fecha dentro de la semana visible."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
    const prescribed = category === "fuerza" ? exercises.filter(row => row.name.trim()).map((row, i) =>
      (i + 1) + ". " + row.name.trim() + " · " + row.sets + " series × " + row.reps + " repeticiones" + (row.weight ? " · " + row.weight + " kg" : "") + (row.rest ? " · Descanso " + row.rest + " s" : "")).join("\n") : category === "trail" ?
      [trailTarget.distance && "Distancia objetivo: " + trailTarget.distance + " km", trailTarget.elevation && "Desnivel positivo objetivo: " + trailTarget.elevation + " m+", trailTarget.minutes && "Duración objetivo: " + trailTarget.minutes + " min", trailTarget.effort && "Esfuerzo objetivo: " + trailTarget.effort + "/10"].filter(Boolean).join("\n") : "";
    const sessionDetails = [details.trim(), prescribed].filter(Boolean).join("\n\n");
    const record = { session_date: date, category, title: title.trim(), details: sessionDetails };
    const result = editingId ? await supabase.from("weekly_training_plan").update(record).eq("id", editingId).eq("athlete_id", selected).select("id") :
      await supabase.from("weekly_training_plan").insert({ ...record, athlete_id: selected }).select("id");
    if (result.error) setError(result.error.message);
    else if (!result.data?.length) setError("No se pudo guardar la sesión. Actualiza la planificación e inténtalo de nuevo.");
    else { setMessage(editingId ? "Sesión actualizada." : "Sesión programada."); clearEditor(); await refresh(); }
    } catch { setError("No se pudo guardar la sesión. Comprueba tu conexión."); }
    finally { setBusy(false); }
  }
  async function toggle(s: Session) {
    if (busy || (!admin && s.athlete_id !== userId)) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.rpc("mark_training_completed",{ p_id:s.id, p_completed:!s.completed });
    if (err) setError(err.message); else await refresh();
    setBusy(false);
  }
  async function remove(s: Session) {
    if (!admin || busy || !window.confirm("¿Eliminar esta sesión?")) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.from("weekly_training_plan").delete().eq("id",s.id);
    if (err) setError(err.message); else await refresh();
    setBusy(false);
  }
  function moveWeek(days: number) {
    if (busy) return;
    const d = new Date(week+"T12:00:00"); d.setDate(d.getDate()+days);
    const next = dateString(d); setWeek(next); setDate(next); setError(""); setMessage(""); clearEditor();
  }
  const visibleSessions = categoryFilter ? sessions.filter(s => s.category === categoryFilter) : sessions;
  const heading = categoryFilter === "fuerza" ? "Entrenamiento de fuerza" : categoryFilter === "trail" ? "Entrenamiento Trail Running" : showEditor ? "Planificación semanal" : "Mis entrenamientos";
  const weekEnd = new Date(week+"T12:00:00"); weekEnd.setDate(weekEnd.getDate()+6);
  if (loading && !membership && !accessError) return <main style={{ padding: 40, background: "#111", color: "white", minHeight: "100vh" }}><p role="status">Comprobando tu acceso...</p></main>;
  if (accessError || !membership?.premium) return <MembershipNotice access={membership} error={accessError} />;
  return <main style={{ minHeight:"100vh", background:"#111", color:"white", padding:"35px 20px", fontFamily:"Arial,sans-serif" }}>
    <div style={{ maxWidth:900, margin:"0 auto" }}>
      <p style={{ color:"#f28c28", fontWeight:"bold" }}>NH TRAINING CONCEPT</p>
      <Link href="/dashboard" style={{ color: "#f28c28", display: "inline-block", marginBottom: 12 }}>← Volver a mi panel</Link>
      <h1>{heading}</h1>
      <p style={{ color:"#bbb" }}>Fuerza, trail, movilidad y recuperación · NH Trail Club</p>
      {categoryFilter === "trail" && <p><Link href="/seguimiento-trail" style={{ ...button, display: "inline-block", textDecoration: "none" }}>Registrar salida realizada →</Link></p>}
      <nav aria-label="Tipos de entrenamiento" style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "22px 0" }}>
        {[{ href: "/entrenamientos", text: "Todos", active: !categoryFilter && !showEditor }, { href: "/entrenamientos/fuerza", text: "Fuerza", active: categoryFilter === "fuerza" }, { href: "/entrenamientos/trail", text: "Trail", active: categoryFilter === "trail" }, { href: "/entrenamientos/plan", text: admin ? "Gestionar planificación" : "Plan semanal", active: showEditor }].map(item => <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} style={{ ...button, display: "inline-block", textDecoration: "none", background: item.active ? "#f28c28" : "#292929", color: item.active ? "#111" : "white", border: "1px solid #555" }}>{item.text}</Link>)}
      </nav>
      {admin && <label>Deportista
        <select style={input} value={selected} disabled={busy} onChange={e=>{setSelected(e.target.value);clearEditor();setMessage("");}}>
          <option value={userId}>Mi planificación</option>
          {athletes.filter(a=>a.user_id && a.user_id!==userId).map(a=><option key={a.user_id!} value={a.user_id!}>{a.nombre}</option>)}
        </select>
      </label>}
      <div style={{ display:"flex", alignItems:"center", gap:15, flexWrap:"wrap", margin:"25px 0" }}>
        <button style={button} disabled={busy} onClick={()=>moveWeek(-7)}>← Anterior</button>
        <strong>{new Date(week+"T12:00:00").toLocaleDateString("es-ES")} — {weekEnd.toLocaleDateString("es-ES")}</strong>
        <button style={button} disabled={busy} onClick={()=>moveWeek(7)}>Siguiente →</button>
      </div>
      {error && <p role="alert" style={{ color:"#ff9999" }}>{error}</p>}
      {message && <p role="status" style={{ color: "#8fddaa" }}>{message}</p>}
      {!loading && !error && <section aria-label="Resumen de la semana" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 22 }}>{[["Programadas", visibleSessions.length], ["Completadas", visibleSessions.filter(s => s.completed).length], ["Pendientes", visibleSessions.filter(s => !s.completed).length]].map(([label, value]) => <div key={label} style={card}><p style={{ color: "#bbb", fontSize: 13 }}>{label}</p><strong style={{ color: "#f28c28", fontSize: 28 }}>{value}</strong></div>)}</section>}
      {loading ? <p>Cargando planificación...</p> : error ? null : visibleSessions.length === 0 ? <section style={card}><h2>{categoryFilter ? "Sin sesiones de " + (categoryFilter === "fuerza" ? "fuerza" : "trail") + " esta semana" : "Sin sesiones programadas esta semana"}</h2><p style={{ color: "#ccc", lineHeight: 1.6 }}>{admin ? "Selecciona un deportista o utiliza la planificación para programar sus sesiones." : "Aquí aparecerán las sesiones que te asigne tu entrenador. Puedes consultar otras semanas con los botones Anterior y Siguiente."}</p>{categoryFilter && <Link href="/entrenamientos" style={{ color: "#f28c28" }}>Ver todos mis entrenamientos →</Link>}{admin && !showEditor && <p><Link href="/entrenamientos/plan" style={{ color: "#f28c28" }}>Programar entrenamientos →</Link></p>}</section> :
        visibleSessions.map(s=><article key={s.id} style={card}>
          <p style={{ color:"#f28c28", fontWeight:"bold" }}>{new Date(s.session_date+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})} · {s.category.toUpperCase()}</p>
          <h2>{s.title}</h2><p style={{ whiteSpace:"pre-wrap", color:"#ccc" }}>{s.details}</p>
          <label style={{ display:"inline-flex", alignItems:"center", gap:10 }}>
            <input type="checkbox" checked={s.completed} disabled={busy} onChange={()=>void toggle(s)} /> Sesión completada
          </label>
          {admin && showEditor && <button disabled={busy} onClick={()=>void remove(s)} style={{ ...button, marginLeft:20, background:"#7a3333", color:"white" }}>Eliminar</button>}
          {admin && showEditor && <button disabled={busy} onClick={() => editSession(s)} style={{ ...button, marginLeft: 12 }}>Editar</button>}
        </article>)}
      {admin && showEditor && <section style={{ ...card, marginTop:30 }}>
        <h2>{editingId ? "Editar sesión" : "Programar sesión"}</h2>
        <form onSubmit={add}>
          <label>Fecha<input style={input} type="date" value={date} min={week} max={dateString(weekEnd)} onChange={e=>setDate(e.target.value)} required /></label>
          <label>Tipo<select style={input} value={category} onChange={e=>setCategory(e.target.value)}>
            <option value="trail">Trail</option><option value="fuerza">Fuerza</option><option value="movilidad">Movilidad</option><option value="descanso">Descanso</option>
          </select></label>
          <label>Título<input ref={titleInput} style={input} value={title} onChange={e=>setTitle(e.target.value)} required maxLength={120} /></label>
          <label>Indicaciones<textarea style={input} value={details} onChange={e=>setDetails(e.target.value)} rows={4} /></label>
          {category === "fuerza" && <section style={{ marginBottom: 22 }}><h3>Ejercicios de fuerza</h3><p style={{ color: "#bbb" }}>Añade los ejercicios prescritos. Se guardarán junto a las indicaciones de esta sesión.</p>
            {exercises.map((row, index) => <fieldset key={row.id} style={{ border: "1px solid #555", borderRadius: 10, padding: 16, marginBottom: 14 }}><legend>Ejercicio {index + 1}</legend>
              <label>Nombre del ejercicio<input style={input} value={row.name} maxLength={80} required onChange={e => updateExercise(row.id, "name", e.target.value)} /></label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12 }}>
                <label>Series<input style={input} type="number" min="1" max="30" step="1" required value={row.sets} onChange={e => updateExercise(row.id, "sets", e.target.value)} /></label>
                <label>Repeticiones<input style={input} type="number" min="1" max="100" step="1" required value={row.reps} onChange={e => updateExercise(row.id, "reps", e.target.value)} /></label>
                <label>Carga (kg, opcional)<input style={input} type="number" min="0" max="1000" step="0.5" value={row.weight} onChange={e => updateExercise(row.id, "weight", e.target.value)} /></label>
                <label>Descanso (segundos)<input style={input} type="number" min="0" max="3600" step="1" value={row.rest} onChange={e => updateExercise(row.id, "rest", e.target.value)} /></label>
              </div><button type="button" style={{ ...button, background: "#333", color: "white" }} aria-label={"Quitar ejercicio " + (index + 1)} onClick={() => setExercises(rows => rows.filter(e => e.id !== row.id))}>Quitar ejercicio</button>
            </fieldset>)}
            <button type="button" style={button} onClick={() => setExercises(rows => [...rows, { id: crypto.randomUUID(), name: "", sets: "3", reps: "8", weight: "", rest: "60" }])}>Añadir ejercicio</button>
          </section>}
          {category === "trail" && <fieldset style={{ border: "1px solid #555", borderRadius: 10, padding: 16, marginBottom: 22 }}><legend>Objetivos de trail (opcionales)</legend><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            <label>Distancia (km)<input style={input} type="number" min="0" max="500" step="0.1" value={trailTarget.distance} onChange={e => setTrailTarget(t => ({ ...t, distance: e.target.value }))} /></label>
            <label>Desnivel positivo (m)<input style={input} type="number" min="0" max="30000" step="1" value={trailTarget.elevation} onChange={e => setTrailTarget(t => ({ ...t, elevation: e.target.value }))} /></label>
            <label>Duración (minutos)<input style={input} type="number" min="1" max="10080" step="1" value={trailTarget.minutes} onChange={e => setTrailTarget(t => ({ ...t, minutes: e.target.value }))} /></label>
            <label>Esfuerzo (1–10)<input style={input} type="number" min="1" max="10" step="1" value={trailTarget.effort} onChange={e => setTrailTarget(t => ({ ...t, effort: e.target.value }))} /></label>
          </div></fieldset>}
          <button style={button} disabled={busy || !title.trim()}>{busy ? "Guardando..." : editingId ? "Guardar cambios" : "Guardar sesión"}</button>
          {editingId && <button type="button" disabled={busy} style={{ ...button, marginLeft: 12, background: "#333", color: "white" }} onClick={clearEditor}>Cancelar edición</button>}
        </form>
      </section>}
      <div style={{ marginTop:35, display: "flex", gap: 20, flexWrap: "wrap" }}><Link href="/dashboard" style={{ color:"#f28c28" }}>Volver a mi panel</Link><Link href="/salidas" style={{ color:"#f28c28" }}>Salidas del club</Link><Link href="/progreso" style={{ color:"#f28c28" }}>Mi progreso</Link></div>
    </div>
  </main>;
}

