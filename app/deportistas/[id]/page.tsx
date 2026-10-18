
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Deportista = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  nivel: string | null;
  created_at: string;
};

export default function FichaDeportistaPage() {
  const params = useParams();
  const id = params.id as string;

  const [deportista, setDeportista] =
    useState<Deportista | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function cargarFicha() {
      setCargando(true);

      const { data: authData } =
        await supabase.auth.getUser();

      if (!authData.user) {
        setError("Debes iniciar sesión.");
        setCargando(false);
        return;
      }

      const { data, error } = await supabase
        .from("deportistas")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        setError("No se pudo cargar la ficha: " + error.message);
      } else {
        setDeportista(data);
      }

      setCargando(false);
    }

    if (id) void cargarFicha();
  }, [id]);

  const tarjeta = {
    background: "#202020",
    padding: "24px",
    borderRadius: "12px",
    marginBottom: "20px",
  };

  const titulo = {
    color: "#ff8c28",
    marginBottom: "18px",
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "#111111",
      color: "white",
      padding: "40px 20px",
      fontFamily: "Arial, sans-serif",
    }}>
      <div style={{ maxWidth: "950px", margin: "auto" }}>
        <p style={{ color: "#ff8c28", fontWeight: "bold" }}>
          NH TRAINING CONCEPT
        </p>

        <h1>FICHA DEL DEPORTISTA</h1>
        <p style={{ color: "#aaaaaa" }}>
          NH Trail Club · Seguimiento individual
        </p>

        {cargando && <p>Cargando ficha...</p>}
        {error && <p role="alert">{error}</p>}

        {deportista && (
          <>
            <section style={{ ...tarjeta, marginTop: "30px" }}>
              <h2 style={titulo}>{deportista.nombre}</h2>
              <p><strong>Nivel:</strong> {deportista.nivel || "Sin definir"}</p>
              <p><strong>Email:</strong> {deportista.email || "Sin registrar"}</p>
              <p><strong>Teléfono:</strong> {deportista.telefono || "Sin registrar"}</p>
              <p><strong>Fecha de alta:</strong> {
                new Date(deportista.created_at).toLocaleDateString("es-ES")
              }</p>
            </section>

            <section style={tarjeta}>
              <h2 style={titulo}>Objetivos deportivos</h2>
              <p>Próximamente: objetivos individuales del deportista.</p>
            </section>

            <section style={tarjeta}>
              <h2 style={titulo}>Entrenamientos</h2>
              <p>Próximamente: planificación semanal de fuerza y trail.</p>
            </section>

            <section style={tarjeta}>
              <h2 style={titulo}>Seguimiento y evolución</h2>
              <p>Próximamente: resultados, pruebas físicas y progreso.</p>
            </section>

            <section style={tarjeta}>
              <h2 style={titulo}>Salidas de montaña</h2>
              <p>Próximamente: actividades y rutas realizadas.</p>
            </section>
          </>
        )}

        <Link href="/deportistas" style={{
          color: "#ff8c28",
          display: "inline-block",
          marginTop: "20px",
        }}>
          ← Volver a deportistas
        </Link>
      </div>
    </main>
  );
}
