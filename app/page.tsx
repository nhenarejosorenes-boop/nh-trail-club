import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111111",
        color: "#ffffff",
        fontFamily: "Arial, sans-serif",
        padding: "40px 24px",
      }}
    >
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <p
          style={{
            color: "#f28c28",
            fontWeight: "bold",
            letterSpacing: "2px",
          }}
        >
          NH TRAINING CONCEPT
        </p>

        <h1 style={{ fontSize: "48px", marginBottom: "10px" }}>
          NH TRAIL CLUB
        </h1>

        <h2
          style={{
            fontWeight: "normal",
            color: "#cccccc",
          }}
        >
          Entrena. Progresa. Disfruta la montaña.
        </h2>

        <div
          style={{
            marginTop: "40px",
            background: "#1c1c1c",
            padding: "25px",
            borderRadius: "16px",
          }}
        >
          <h2>Tu entrenamiento</h2>

          <p
            style={{
              color: "#cccccc",
              fontSize: "18px",
              lineHeight: "1.5",
            }}
          >
            Consulta tus sesiones de fuerza, entrenamientos de trail y próximas
            salidas del club.
          </p>

          <Link
            href="/entrenamientos"
            style={{
              display: "inline-block",
              marginTop: "15px",
              background: "#f28c28",
              color: "#111111",
              padding: "15px 25px",
              borderRadius: "10px",
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            Ver entrenamientos
          </Link>
        </div>
      </div>
    </main>
  );
}
