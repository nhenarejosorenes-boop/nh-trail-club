
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Actividad = {
  id: string;
  title: string;
  description: string | null;
  activity_type: string | null;
  starts_at: string;
  location: string | null;
  max_participants: number | null;
};

export default function SalidasPage() {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function cargarActividades() {
      const { data, error } = await supabase
        .from("club_activities")
        .select(
          "id,title,description,activity_type,starts_at,location,max_participants"
        )
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true });

      if (error) {
        setError(error.message);
      } else {
        setActividades(data || []);
      }

      setCargando(false);
    }

    cargarActividades();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "white",
        padding: "50px 24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 950, margin: "0 auto" }}>
        <p style={{ color: "#ff8c1a", fontWeight: "bold" }}>
          NH TRAINING CONCEPT
        </p>

        <h1>Salidas de montaña</h1>

        <p style={{ color: "#bbb" }}>
          Descubre las próximas actividades de NH Trail Club.
        </p>

        <h2 style={{ color: "#ff8c1a", marginTop: 40 }}>
          Próximas salidas
        </h2>

        {cargando && <p>Cargando actividades...</p>}

        {error && (
          <p style={{ color: "#ff7777" }}>
            Error al cargar las actividades: {error}
          </p>
        )}

        {!cargando && !error && actividades.length === 0 && (
          <p>No hay próximas salidas programadas.</p>
        )}

        {actividades.map((actividad) => (
          <div
            key={actividad.id}
            style={{
              background: "#1e1e1e",
              border: "1px solid #333",
              borderRadius: 12,
              padding: 25,
              marginTop: 20,
            }}
          >
            <h2 style={{ color: "#ff8c1a" }}>
              {actividad.title}
            </h2>

            <p>{actividad.description}</p>

            <p>
              📅 {new Date(actividad.starts_at).toLocaleString(
                "es-ES",
                {
                  dateStyle: "long",
                  timeStyle: "short",
                  timeZone: "Europe/Madrid",
                }
              )}
            </p>

            <p>📍 {actividad.location || "Por determinar"}</p>

            <p>
              👥 Plazas máximas:{" "}
              {actividad.max_participants ?? "Sin límite"}
            </p>

            <p>
              🏃 Tipo: {actividad.activity_type || "Actividad"}
            </p>
          </div>
        ))}

        <div style={{ marginTop: 35 }}>
          <Link
            href="/dashboard"
            style={{
              display: "inline-block",
              background: "#ff8c1a",
              color: "#111",
              padding: "12px 22px",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            Volver al panel principal
          </Link>
        </div>
      </div>
    </main>
  );
}
