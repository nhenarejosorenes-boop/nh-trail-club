
import Link from "next/link";

export default function FuerzaPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#111111",
        color: "#ffffff",
        padding: "50px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <p style={{ color: "#ff8c20", fontWeight: "bold" }}>
          NH TRAINING CONCEPT
        </p>

        <h1>💪 Entrenamiento de fuerza</h1>

        <p style={{ color: "#cccccc", lineHeight: 1.6 }}>
          Consulta tus sesiones de fuerza y preparación física.
        </p>

        <section
          style={{
            backgroundColor: "#202020",
            padding: 25,
            borderRadius: 14,
            marginTop: 30,
          }}
        >
          <h2>Mis sesiones de fuerza</h2>
          <p style={{ color: "#cccccc" }}>
            Aquí podrás consultar tus entrenamientos de fuerza.
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
  );
}
