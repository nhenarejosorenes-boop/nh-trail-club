
import Link from "next/link";

export default function SalidasPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#111111",
        color: "#ffffff",
        padding: "50px 24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 950, margin: "0 auto" }}>
        <p style={{ color: "#ff8c1a", fontWeight: "bold" }}>
          NH TRAINING CONCEPT
        </p>

        <h1 style={{ fontSize: 34 }}>Salidas de montaña</h1>

        <p style={{ color: "#bbbbbb" }}>
          Descubre, organiza y participa en las actividades
          de NH Trail Club.
        </p>

        <section
          style={{
            backgroundColor: "#1e1e1e",
            border: "1px solid #333333",
            borderRadius: 12,
            padding: 28,
            marginTop: 40,
          }}
        >
          <h2 style={{ color: "#ff8c1a" }}>
            Próximas salidas
          </h2>

          <p style={{ color: "#cccccc" }}>
            Aquí aparecerán las próximas actividades
            y rutas de montaña del club.
          </p>

          <p style={{ color: "#999999" }}>
            Próximamente podrás consultar los detalles
            e inscribirte en cada actividad.
          </p>
        </section>

        <div style={{ marginTop: 35 }}>
          <Link
            href="/dashboard"
            style={{
              display: "inline-block",
              backgroundColor: "#ff8c1a",
              color: "#111111",
              padding: "12px 22px",
              borderRadius: 8,
              fontWeight: "bold",
              textDecoration: "none",
            }}
          >
            Volver al panel principal
          </Link>
        </div>
      </div>
    </main>
  );
}
