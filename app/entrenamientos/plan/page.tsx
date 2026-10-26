"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import MembershipNotice from "@/components/MembershipNotice";
import { loadMembershipAccess } from "@/lib/membership-client";
import type { MembershipAccess } from "@/lib/membership-model";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
type Session = { id: string; athlete_id: string; session_date: string; category: string; title: string; details: string; completed: boolean };
type Athlete = { user_id: string | null; nombre: string };
const card: React.CSSProperties = { background: "#202020", borderRadius: 12, padding: 20, marginBottom: 14 };
const input: React.CSSProperties = { width: "100%", padding: 10, marginTop: 6, marginBottom: 14, background: "#292929", color: "white", border: "1px solid #555", borderRadius: 8, boxSizing: "border-box" };
const button: React.CSSProperties = { background: "#f28c28", color: "#111", border: 0, padding: "11px 16px", borderRadius: 8, fontWeight: "bold", cursor: "pointer" };
function dateString(d: Date) { const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,"0"); const day = String(d.getDate()).padStart(2,"0"); return y+"-"+m+"-"+day; }
function monday(d: Date) { const x = new Date(d); x.setHours(12,0,0,0); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; }

export default function PlanSemanalPage() {
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
  const [category, setCategory] = useState("trail");
  const [date, setDate] = useState(dateString(new Date()));

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
    e.preventDefault(); if (!admin || !selected || busy) return;
    const start = new Date(week+"T12:00:00"); const end = new Date(start); end.setDate(end.getDate()+7);
    if (date < dateString(start) || date >= dateString(end)) { setError("Selecciona una fecha dentro de la semana visible."); return; }
    setBusy(true); setError("");
    const { error: err } = await supabase.from("weekly_training_plan").insert({ athlete_id:selected, session_date:date, category, title:title.trim(), details:details.trim() });
    if (err) setError(err.message); else { setTitle(""); setDetails(""); await refresh(); }
    setBusy(false);
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
    const d = new Date(week+"T12:00:00"); d.setDate(d.getDate()+days);
    const next = dateString(d); setWeek(next); setDate(next); setError("");
  }
  const weekEnd = new Date(week+"T12:00:00"); weekEnd.setDate(weekEnd.getDate()+6);
  if (loading && !membership && !accessError) return <main style={{ padding: 40, background: "#111", color: "white", minHeight: "100vh" }}><p role="status">Comprobando tu acceso...</p></main>;
  if (accessError || !membership?.premium) return <MembershipNotice access={membership} error={accessError} />;
  return <main style={{ minHeight:"100vh", background:"#111", color:"white", padding:"35px 20px", fontFamily:"Arial,sans-serif" }}>
    <div style={{ maxWidth:900, margin:"0 auto" }}>
      <p style={{ color:"#f28c28", fontWeight:"bold" }}>NH TRAINING CONCEPT</p>
      <h1>Planificación semanal</h1>
      <p style={{ color:"#bbb" }}>Fuerza, trail, movilidad y recuperación · NH Trail Club</p>
      {admin && <label>Deportista
        <select style={input} value={selected} onChange={e=>setSelected(e.target.value)}>
          <option value={userId}>Mi planificación</option>
          {athletes.filter(a=>a.user_id && a.user_id!==userId).map(a=><option key={a.user_id!} value={a.user_id!}>{a.nombre}</option>)}
        </select>
      </label>}
      <div style={{ display:"flex", alignItems:"center", gap:15, flexWrap:"wrap", margin:"25px 0" }}>
        <button style={button} onClick={()=>moveWeek(-7)}>← Anterior</button>
        <strong>{new Date(week+"T12:00:00").toLocaleDateString("es-ES")} — {weekEnd.toLocaleDateString("es-ES")}</strong>
        <button style={button} onClick={()=>moveWeek(7)}>Siguiente →</button>
      </div>
      {error && <p role="alert" style={{ color:"#ff9999" }}>{error}</p>}
      {loading ? <p>Cargando planificación...</p> : sessions.length === 0 ? <p>No hay sesiones programadas para esta semana.</p> :
        sessions.map(s=><article key={s.id} style={card}>
          <p style={{ color:"#f28c28", fontWeight:"bold" }}>{new Date(s.session_date+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})} · {s.category.toUpperCase()}</p>
          <h2>{s.title}</h2><p style={{ whiteSpace:"pre-wrap", color:"#ccc" }}>{s.details}</p>
          <label style={{ display:"inline-flex", alignItems:"center", gap:10 }}>
            <input type="checkbox" checked={s.completed} disabled={busy} onChange={()=>void toggle(s)} /> Sesión completada
          </label>
          {admin && <button disabled={busy} onClick={()=>void remove(s)} style={{ ...button, marginLeft:20, background:"#7a3333", color:"white" }}>Eliminar</button>}
        </article>)}
      {admin && <section style={{ ...card, marginTop:30 }}>
        <h2>Programar sesión</h2>
        <form onSubmit={add}>
          <label>Fecha<input style={input} type="date" value={date} min={week} max={dateString(weekEnd)} onChange={e=>setDate(e.target.value)} required /></label>
          <label>Tipo<select style={input} value={category} onChange={e=>setCategory(e.target.value)}>
            <option value="trail">Trail</option><option value="fuerza">Fuerza</option><option value="movilidad">Movilidad</option><option value="descanso">Descanso</option>
          </select></label>
          <label>Título<input style={input} value={title} onChange={e=>setTitle(e.target.value)} required maxLength={120} /></label>
          <label>Indicaciones<textarea style={input} value={details} onChange={e=>setDetails(e.target.value)} rows={4} /></label>
          <button style={button} disabled={busy || !title.trim()}>Guardar sesión</button>
        </form>
      </section>}
      <p style={{ marginTop:35 }}><Link href="/entrenamientos" style={{ color:"#f28c28" }}>Volver a entrenamientos</Link></p>
    </div>
  </main>;
}
