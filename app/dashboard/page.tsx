"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

const commonSections = [
  { title: "Mis entrenamientos", description: "Fuerza y trail running.", href: "/entrenamientos", icon: "🏋️" },
  { title: "Salidas de montaña", description: "Consulta las salidas e inscríbete.", href: "/salidas", icon: "⛰️" },
];
const adminSections = [
  { title: "Deportistas", description: "Gestiona los miembros del club.", href: "/deportistas", icon: "👥" },
  { title: "Administración", description: "Gestiona actividades e inscripciones.", href: "/admin", icon: "⚙️" },
];

export default function DashboardPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (!active) return;
        if (authError || !data.user) {
          window.location.replace("/login");
          return;
        }
        setEmail(data.user.email ?? "");
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name,role")
          .eq("id", data.user.id)
          .single();
        if (!active) return;
        if (profileError) {
          setError("No se pudo consultar el perfil. Inténtalo de nuevo.");
        } else {
          setName(profile?.full_name || "");
          setRole(profile?.role || "");
        }
      } catch {
        if (active) setError("No se pudo conectar con el servidor.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  const sections = role === "admin"
    ? [...commonSections, ...adminSections]
    : commonSections;

  return (
    <main style={{ minHeight: "100vh", background: "#111", color: "#fff", padding: "30px 20px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap", marginBottom: 45 }}>
          <div>
            <p style={{ color: "#f28c28", fontWeight: "bold", letterSpacing: 2 }}>NH TRAINING CONCEPT</p>
            <h1>NH TRAIL CLUB</h1>
            <p style={{ color: "#aaa" }}>Entrena. Progresa. Disfruta la montaña.</p>
          </div>
          <button onClick={logout} style={{ background: "#f28c28", border: 0, borderRadius: 8, padding: "12px 20px", fontWeight: "bold", cursor: "pointer" }}>Cerrar sesión</button>
        </header>
        {loading ? <p>Cargando tu club...</p> : (
          <>
            <h2>Bienvenido{ name ? ", " + name : " a tu club" }</h2>
            <p style={{ color: "#aaa", marginBottom: 30 }}>{email}</p>
            {error && <p role="alert" style={{ color: "#ff9999" }}>{error}</p>}
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 20 }}>
              {sections.map(section => (
                <Link key={section.href} href={section.href} style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 14, padding: 28, color: "white", textDecoration: "none" }}>
                  <div style={{ fontSize: 34 }}>{section.icon}</div>
                  <h3 style={{ color: "#f28c28" }}>{section.title}</h3>
                  <p style={{ color: "#bbb" }}>{section.description}</p>
                </Link>
              ))}
            </section>
            <p style={{ color: "#888", marginTop: 45, fontSize: 13 }}>NH TRAINING CONCEPT · NH TRAIL CLUB</p>
          </>
        )}
      </div>
    </main>
  );
}
