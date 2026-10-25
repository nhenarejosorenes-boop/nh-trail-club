"use client";

import Link from "next/link";
import SubscriptionAccessGate from "../components/SubscriptionAccessGate";

export default function EntrenamientosPage() {
  const entrenamientos = [
    { titulo: "Mi planificación semanal", descripcion: "Consulta y registra las sesiones programadas.", icono: "📅", href: "/entrenamientos/plan" },
    {
      titulo: "Entrenamiento de fuerza",
      descripcion: "Consulta tus sesiones de fuerza y preparación física.",
      icono: "💪",
      href: "/entrenamientos/fuerza",
    },
    {
      titulo: "Entrenamiento Trail Running",
      descripcion: "Planifica tus sesiones de carrera y montaña.",
      icono: "🏔️",
      href: "/entrenamientos/trail",
    },
    {
      titulo: "Salidas del club",
      descripcion: "Descubre las próximas salidas y actividades del club.",
      icono: "🏃",
      href: "/salidas",
    },
    {
      titulo: "Mi progreso",
      descripcion: "Consulta tu evolución y seguimiento deportivo.",
      icono: "📈",
      href: "/progreso",
    },
  ];

  return (
    <SubscriptionAccessGate>
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#111111",
        color: "white",
        padding: "50px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <p style={{ color: "#ff8c20", fontWeight: "bold" }}>
          NH TRAINING CONCEPT
        </p>

        <h1 style={{ fontSize: 38, marginBottom: 10 }}>
          Mis entrenamientos
        </h1>

        <p style={{ color: "#cccccc", marginBottom: 35 }}>
          Entrena. Progresa. Disfruta la montaña.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 20,
          }}
        >
          {entrenamientos.map((item) => (
            <Link
              key={item.titulo}
              href={item.href}
              style={{
                display: "block",
                backgroundColor: "#202020",
                borderRadius: 14,
                padding: 25,
                color: "white",
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 32 }}>{item.icono}</div>

              <h2 style={{ fontSize: 21 }}>
                {item.titulo}
              </h2>

              <p style={{ color: "#cccccc", lineHeight: 1.6 }}>
                {item.descripcion}
              </p>
            </Link>
          ))}
        </div>

        <Link
          href="/"
          style={{
            display: "inline-block",
            marginTop: 35,
            backgroundColor: "#ff9226",
            color: "#111111",
            padding: "13px 22px",
            borderRadius: 9,
            fontWeight: "bold",
            textDecoration: "none",
          }}
        >
          Volver al inicio
        </Link>
      </div>
    </main>
    </SubscriptionAccessGate>
  );
}
