
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

const sections = [
  {
    title: "Mis entrenamientos",
    description: "Consulta tus sesiones de fuerza y trail.",
    href: "/entrenamientos",
    icon: "🏋️",
  },
  {
    title: "Deportistas",
    description: "Gestiona los miembros del club.",
    href: "/deportistas",
    icon: "👥",
  },
  {
    title: "Salidas de montaña",
    description: "Organiza las próximas rutas y actividades.",
    href: "/salidas",
    icon: "⛰️",
  },
  {
    title: "Mi progreso",
    description: "Consulta tu evolución deportiva.",
    href: "/progreso",
    icon: "📈",
  },
];

export default function DashboardPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        window.location.replace("/login");
        return;
      }

      setEmail(data.user.email ?? "");
      setLoading(false);
    }

    checkSession();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  if (loading) {
    return (
      <main style={{
        background: "#111",
        color: "white",
        minHeight: "100vh",
        padding: "40px",
      }}>
        Cargando NH Trail Club...
      </main>
    );
  }

  return (
    <main style={{
      background: "#111",
      color: "#fff",
      minHeight: "100vh",
      padding: "30px",
      fontFamily: "Arial, sans-serif",
    }}>
      <div style={{
        maxWidth: "1100px",
        margin: "0 auto",
      }}>
        <header style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px",
          marginBottom: "45px",
        }}>
          <div>
            <p style={{
              color: "#f28c28",
              fontWeight: "bold",
              letterSpacing: "2px",
            }}>
              NH TRAINING CONCEPT
            </p>
            <h1 style={{ fontSize: "34px" }}>
              NH TRAIL CLUB
            </h1>
            <p style={{ color: "#aaa" }}>
              Entrena. Progresa. Disfruta la montaña.
            </p>
          </div>

          <button
            onClick={logout}
            style={{
              background: "#f28c28",
              color: "#111",
              padding: "12px 20px",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Cerrar sesión
          </button>
        </header>

        <section style={{ marginBottom: "35px" }}>
          <h2>Bienvenido a tu club</h2>
          <p style={{ color: "#aaa" }}>{email}</p>
        </section>

        <section style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "20px",
        }}>
          {sections.map((section) => (
            <a
              key={section.title}
              href={section.href}
              style={{
                background: "#1e1e1e",
                border: "1px solid #333",
                borderRadius: "14px",
                padding: "28px",
                color: "white",
                textDecoration: "none",
              }}
            >
              <div style={{ fontSize: "34px" }}>
                {section.icon}
              </div>
              <h3 style={{
                color: "#f28c28",
                marginTop: "18px",
              }}>
                {section.title}
              </h3>
              <p style={{
                color: "#bbb",
                lineHeight: "1.5",
              }}>
                {section.description}
              </p>
            </a>
          ))}
        </section>

        <footer style={{
          marginTop: "60px",
          color: "#777",
          textAlign: "center",
          fontSize: "13px",
        }}>
          NH TRAINING CONCEPT · NH TRAIL CLUB
        </footer>
      </div>
    </main>
  );
}
