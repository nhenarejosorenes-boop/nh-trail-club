"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Registro = { activity_id: string; created_at: string };
type Sesion = { id: string; session_date: string; category: string; title: string; completed: boolean };\ntype Actividad = { id: string; title: string; starts_at: string; activity_type: string | null };

export default function ProgresoPage() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [actividades, setActividades] = useState<Actividad[]>([]);\n  const [sesiones, setSesiones] = useState<Sesion[]>([]);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (!activo) return;
        if (authError || !auth.user) {
          window.location.replace("/login");
          return;
        }
        const { data: plan, error: planError } = await supabase.from("weekly_training_plan").select("id,session_date,category,title,completed").eq("athlete_id",auth.user.id).order("session_date",{ascending:false});\n        if (planError) throw planError;\n        if (activo) setSesiones((plan ?? []) as Sesion[]);\n        const { data: regs, error: regError } = await supabase
          .from("activity_registrations")
          .select("activity_id,created_at")
          .eq("user_id", auth.user.id);
        if (regError) throw regError;
        const lista = (regs ?? []) as Registro[];
        if (!activo) return;
        setRegistros(lista);
        if (lista.length) {
          const { data: acts, error: actError } = await supabase
            .from("club_activities")
            .select("id,title,starts_at,activity_type")
            .in("id", [...new Set(lista.map(r => r.activity_id))]);
          if (actError) throw actError;
          if (activo) setActividades((acts ?? []) as Actividad[]);
        }
      } catch (e) {
        if (activo) setError(e instanceof Error ? e.message : "Error al consultar el progreso.");
      } finally {
        if (activo) setCargando(false);
      }
    }
    void cargar();
    return () => { activo = false; };
  }, []);

  const ahora = Date.now();\n  const completadas = sesiones.filter(s=>s.completed);\n  const mes = new Date().toLocaleDateString("sv-SE").slice(0,7);\n  const mesSesiones = sesiones.filter(s=>s.session_date.startsWith(mes));\n  const mesCompletadas = mesSesiones.filter(s=>s.completed).length;\n  const cumplimiento = mesSesiones.length ? Math.round(100*mesCompletadas/mesSesiones.length) : 0;\n  const porTipo = ["trail","fuerza","movilidad","descanso"].map(tipo=>({tipo, total:completadas.filter(s=>s.category===tipo).length}));
  const futuras = actividades.filter(a => new Date(a.starts_at).getTime() >= ahora).length;
  const pasadas = actividades.filter(a => new Date(a.starts_at).getTime() < ahora).length;

  return (
    <main style={{ background: "#111", color: "white", minHeight: "100vh", padding: "40px 20px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <p style={{ color: "#f28c28", fontWeight: "bold" }}>NH TRAINING CONCEPT</p>
        <h1>Mi progreso</h1>
        <p style={{ color: "#bbb" }}>Evolución de tus entrenamientos y actividades del club.</p>
        {cargando ? <p>Cargando...</p> : error ? <p role="alert" style={{ color: "#ff9999" }}>{error}</p> : (
          <>
            <section style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "30px 0" }}>
              {[
                ["Sesiones completadas", completadas.length],\n                ["Sesiones este mes", mesSesiones.length],\n                ["Cumplimiento mensual", cumplimiento+"%"],\n                ["Inscripciones actuales", registros.length],
                ["Próximas actividades", futuras],
                ["Actividades con fecha pasada", pasadas],
              ].map(([titulo, numero]) => (
                <div key={titulo} style={{ flex: "1 1 180px", background: "#222", padding: 22, borderRadius: 12 }}>
                  <p style={{ color: "#bbb" }}>{titulo}</p>
                  <strong style={{ color: "#f28c28", fontSize: 30 }}>{numero}</strong>
                </div>
              ))}
            </section>
            <h2>Entrenamientos por disciplina</h2>\n            <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:28}}>{porTipo.map(x=><div key={x.tipo} style={{background:"#222",borderRadius:12,padding:18}}><p style={{textTransform:"capitalize",color:"#bbb"}}>{x.tipo}</p><strong style={{fontSize:27,color:"#f28c28"}}>{x.total}</strong><p style={{fontSize:12,color:"#aaa"}}>Sesiones completadas</p></div>)}</section>\n            <h2>Historial de entrenamientos</h2>\n            {sesiones.length===0&&<p>No hay sesiones registradas todavía.</p>}\n            {sesiones.slice(0,25).map(s=><div key={s.id} style={{background:"#222",borderRadius:10,padding:16,marginBottom:9,display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><strong>{s.title}</strong><p style={{color:"#aaa",fontSize:13}}>{s.session_date} · {s.category}</p></div><span style={{color:s.completed?"#7ee2a3":"#ffbd75"}}>{s.completed?"✓ Completada":"Pendiente"}</span></div>)}\n            <h2>Mis actividades</h2>
            {actividades.length === 0 && <p>No tienes actividades inscritas actualmente.</p>}
            {actividades.sort((a,b) => a.starts_at.localeCompare(b.starts_at)).map(a => (
              <div key={a.id} style={{ background: "#222", borderRadius: 12, padding: 20, marginBottom: 12 }}>
                <strong style={{ color: "#f28c28" }}>{a.title}</strong>
                <p>{new Date(a.starts_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "medium", timeStyle: "short" })}</p>
                <p style={{ color: "#aaa" }}>{a.activity_type || "Actividad"} · {new Date(a.starts_at).getTime() < ahora ? "Fecha pasada" : "Próxima"}</p>
              </div>
            ))}
            <p style={{ color: "#aaa", fontSize: 13 }}>Las actividades con fecha pasada no acreditan asistencia. Las sesiones completadas reflejan los registros de tu planificación semanal.</p>
          </>
        )}
        <Link href="/dashboard" style={{ color: "#f28c28" }}>Volver al panel</Link>
      </div>
    </main>
  );
}
