"use client";

import Link from "next/link";
import SubscriptionAccessGate from "../../components/SubscriptionAccessGate";

export default function TrailPage() {
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

        <h1>🏔️ Entrenamiento Trail Running</h1>

        <p style={{ color: "#cccccc", lineHeight: 1.6 }}>
          Planifica tus sesiones de carrera y montaña.
        </p>

        <section
          style={{
            backgroundColor: "#202020",
            padding: 25,
            borderRadius: 14,
            marginTop: 30,
          }}
        >
          <h2>Mis sesiones de Trail Running</h2>

          <p style={{ color: "#cccccc" }}>
            Aquí podrás consultar tus entrenamientos de carrera,
            desnivel y preparación para montaña.
          </p>
        </section>

        <Link
          href="/entrenamientos"
          style={{
            display: "inline-block",
            marginTop: 30,
            backgroundColor: "#ff9226",
            color: "#111111",
            padding: "13px 22px",
            borderRadius: 9,
            fontWeight: "bold",
            textDecoration: "none",
          }}
        >
          Volver a mis entrenamientos
        </Link>
      </div>
    </main>
 </SubscriptionAccessGate>
 );
}
