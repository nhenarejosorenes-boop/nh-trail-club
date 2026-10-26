"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import MembershipNotice from "./MembershipNotice";
import { loadMembershipAccess } from "@/lib/membership-client";
import { membershipLabels, type MembershipAccess } from "@/lib/membership-model";
import styles from "./athlete-panels.module.css";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
const panels = [
  { title: "Mi entrenador", text: "Conversación privada con el equipo entrenador, dudas sobre sesiones y mensajes del club.", icon: "✉", href: "/mensajes", premium: false },
  { title: "Mi planificación semanal", text: "Sesiones por semana, indicaciones del entrenador y registro de sesiones completadas.", icon: "📅", href: "/entrenamientos/plan", premium: true },
  { title: "Entrenamiento de fuerza", text: "Sesiones de fuerza prescritas, ejercicios e indicaciones de series, repeticiones y cargas.", icon: "💪", href: "/entrenamientos/fuerza", premium: true },
  { title: "Entrenamiento Trail Running", text: "Plan de carrera y montaña, objetivos de cada sesión y acceso al registro de salidas.", icon: "⛰", href: "/entrenamientos/trail", premium: true },
  { title: "Salidas del club", text: "Próximas actividades, plazas disponibles e inscripciones del club.", icon: "🏃", href: "/salidas", premium: false },
  { title: "Mi progreso", text: "Plan completado, kilómetros, desnivel, tiempo y evolución semanal de tus registros.", icon: "📈", href: "/progreso", premium: true },
];
export default function TrainingHub() {
  const [access, setAccess] = useState<MembershipAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => { try {
      const auth = await supabase.auth.getUser();
      if (!active) return;
      if (auth.error || !auth.data.user) { window.location.replace("/login"); return; }
      const membership = await loadMembershipAccess(supabase, auth.data.user.id);
      if (active) setAccess(membership);
    } catch { if (active) setError(true); } finally { if (active) setLoading(false); } })();
    return () => { active = false; };
  }, []);
  if (loading) return <main className={styles.page}><p role="status">Cargando mis entrenamientos...</p></main>;
  if (error || !access?.club) return <MembershipNotice access={access} error={error} />;
  return <main className={styles.page}><div className={styles.inner}>
    <p className={styles.brand}>NH TRAINING CONCEPT</p><Link className={styles.back} href="/dashboard">← Volver al panel principal</Link>
    <h1>Mis entrenamientos</h1><p className={styles.intro}>Elige una sección para consultar tu planificación, registrar tus sesiones y seguir tu evolución.</p>
    <span className={styles.badge}>{access.plan ? membershipLabels[access.plan] : "Administración"}</span>
    <div className={styles.cards}>{panels.map(panel => <Link className={styles.card} href={panel.href} key={panel.href}>
      <span className={styles.icon} aria-hidden="true">{panel.icon}</span><h2>{panel.title}</h2><p>{panel.text}</p>
      <span className={styles.badge}>{panel.premium && !access.premium ? "Disponible con PLUS / Performance" : "Acceder →"}</span>
    </Link>)}</div>
  </div></main>;
}
