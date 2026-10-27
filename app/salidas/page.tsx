
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import MembershipNotice from "@/components/MembershipNotice";
import { loadMembershipAccess } from "@/lib/membership-client";
import type { MembershipAccess } from "@/lib/membership-model";

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

type Inscripcion = {
  activity_id: string;
  user_id: string;
};

type Plazas = {
  inscritos: number;
  plazas_disponibles: number | null;
};

export default function SalidasPage() {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [plazas, setPlazas] = useState<Record<string, Plazas>>({});
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [membership, setMembership] = useState<MembershipAccess | null>(null);
  const [accessError, setAccessError] = useState(false);

  async function cargarDatos() {
    setError("");
    setAccessError(false);
    try {

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError && authError.message !== "Auth session missing!") {
      setError(authError.message);
    }

    const userId = authData.user?.id ?? null;
    if (!userId || authError) { window.location.replace("/login"); return; }
    setUsuarioId(userId);
    const access = await loadMembershipAccess(supabase, userId);
    setMembership(access);
    if (!access.club) { setActividades([]); setInscripciones([]); setPlazas({}); return; }

    const { data: actividadesData, error: actividadesError } =
      await supabase
        .from("club_activities")
        .select(
          "id,title,description,activity_type,starts_at,location,max_participants"
        )
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true });

    if (actividadesError) {
      setError(actividadesError.message);
      setCargando(false);
      return;
    }

    const lista = actividadesData || [];
    setActividades(lista);

    // Consultar las plazas reales de cada actividad.
    const resultados = await Promise.all(
      lista.map(async (actividad) => {
        const { data, error: plazasError } = await supabase.rpc(
          "obtener_plazas_actividad",
          { p_activity_id: actividad.id }
        );

        if (plazasError) {
          return {
            id: actividad.id,
            plazas: null,
            error: plazasError.message,
          };
        }

        const resultado = Array.isArray(data) ? data[0] : data;

        if (!resultado) {
          return {
            id: actividad.id,
            plazas: null,
            error: "No se pudieron obtener las plazas.",
          };
        }

        return {
          id: actividad.id,
          plazas: {
            inscritos: Number(resultado.inscritos),
            plazas_disponibles:
              resultado.plazas_disponibles === null
                ? null
                : Number(resultado.plazas_disponibles),
          },
          error: null,
        };
      })
    );

    const nuevasPlazas: Record<string, Plazas> = {};

    for (const resultado of resultados) {
      if (resultado.plazas) {
        nuevasPlazas[resultado.id] = resultado.plazas;
      }
    }

    setPlazas(nuevasPlazas);

    const errorPlazas = resultados.find((r) => r.error);
    if (errorPlazas) {
      setError(
        "No se pudieron consultar todas las plazas: " +
          errorPlazas.error
      );
    }

    if (userId) {
      const { data: inscripcionesData, error: inscripcionesError } =
        await supabase
          .from("activity_registrations")
          .select("activity_id,user_id")
          .eq("user_id", userId);

      if (inscripcionesError) {
        setError(inscripcionesError.message);
      } else {
        setInscripciones(inscripcionesData || []);
      }
    } else {
      setInscripciones([]);
    }

    setCargando(false);
    } catch {
      setAccessError(true);
      setMembership(null);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarDatos();
  }, []);

  async function inscribirse(actividadId: string) {
    setMensaje("");
    setError("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError("Debes iniciar sesión para inscribirte.");
      return;
    }

    setProcesando(actividadId);

    try {
      const { error: insertError } = await supabase
        .from("activity_registrations")
        .insert({
          activity_id: actividadId,
          user_id: authData.user.id,
        });

      if (insertError) {
        if (insertError.code === "23505") {
          setMensaje("Ya estás inscrito en esta actividad.");
        } else if (
          insertError.message.includes("No quedan plazas")
        ) {
          setError("Esta actividad ya está completa.");
        } else {
          setError(insertError.message);
        }
      } else {
        setMensaje("¡Inscripción realizada correctamente!");
      }

      await cargarDatos();
    } finally {
      setProcesando(null);
    }
  }

  async function cancelarInscripcion(actividadId: string) {
    setMensaje("");
    setError("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError("Debes iniciar sesión.");
      return;
    }

    setProcesando(actividadId);

    try {
      const { error: deleteError } = await supabase
        .from("activity_registrations")
        .delete()
        .eq("activity_id", actividadId)
        .eq("user_id", authData.user.id);

      if (deleteError) {
        setError(deleteError.message);
      } else {
        setMensaje("Inscripción cancelada correctamente.");
      }

      await cargarDatos();
    } finally {
      setProcesando(null);
    }
  }

  const boton: React.CSSProperties = {
    background: "#ff8c1a",
    color: "#111",
    padding: "12px 20px",
    border: "none",
    borderRadius: 8,
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: 14,
  };

  if (!cargando && (accessError || !membership?.club)) return <MembershipNotice access={membership} error={accessError} />;
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
          Descubre las próximas actividades de NH Club Trail Running Alicante.
        </p>

        {mensaje && (
          <p
            role="status"
            style={{
              color: "#8ee6a0",
              background: "#193322",
              padding: 15,
              borderRadius: 8,
            }}
          >
            {mensaje}
          </p>
        )}

        {error && (
          <p
            role="alert"
            style={{
              color: "#ff8888",
              background: "#351b1b",
              padding: 15,
              borderRadius: 8,
            }}
          >
            {error}
          </p>
        )}

        <h2 style={{ color: "#ff8c1a", marginTop: 40 }}>
          Próximas salidas
        </h2>

        {cargando && <p>Cargando actividades...</p>}

        {!cargando && !error && actividades.length === 0 && (
          <p>No hay próximas salidas programadas.</p>
        )}

        {actividades.map((actividad) => {
          const inscrito = inscripciones.some(
            (i) =>
              i.activity_id === actividad.id &&
              i.user_id === usuarioId
          );

          const ocupado = procesando === actividad.id;
          const datosPlazas = plazas[actividad.id];

          const inscritos = datosPlazas?.inscritos ?? 0;
          const disponibles = datosPlazas?.plazas_disponibles;
          const maximo = actividad.max_participants;

          const completa =
            disponibles !== undefined &&
            disponibles !== null &&
            disponibles <= 0;

          const porcentaje =
            maximo !== null && maximo > 0 && datosPlazas
              ? Math.min(100, (inscritos / maximo) * 100)
              : 0;

          return (
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
                📅{" "}
                {new Date(actividad.starts_at).toLocaleString(
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
                🏃 Tipo: {actividad.activity_type || "Actividad"}
              </p>

              <div
                style={{
                  marginTop: 25,
                  padding: 18,
                  background: "#292929",
                  borderRadius: 10,
                }}
              >
                {datosPlazas ? (
                  <>
                    <p style={{ fontWeight: "bold" }}>
                      👥 {inscritos} inscritos
                    </p>

                    <p
                      style={{
                        color: completa ? "#ff7777" : "#8ee6a0",
                        fontWeight: "bold",
                      }}
                    >
                      {completa
                        ? "🔴 Actividad completa"
                        : disponibles === null
                        ? "Plazas sin límite"
                        : `🟢 ${disponibles} plazas disponibles`}
                    </p>

                    {maximo !== null && maximo > 0 && (
                      <>
                        <div
                          style={{
                            height: 12,
                            background: "#444",
                            borderRadius: 20,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${porcentaje}%`,
                              height: "100%",
                              background: completa
                                ? "#b73b3b"
                                : "#ff8c1a",
                              borderRadius: 20,
                            }}
                          />
                        </div>

                        <p style={{ color: "#bbb", fontSize: 13 }}>
                          {inscritos} de {maximo} plazas ocupadas
                        </p>
                      </>
                    )}
                  </>
                ) : (
                  <p style={{ color: "#bbb" }}>
                    Consultando disponibilidad...
                  </p>
                )}
              </div>

              <div style={{ marginTop: 25 }}>
                {inscrito ? (
                  <>
                    <p style={{ color: "#8ee6a0", fontWeight: "bold" }}>
                      ✓ Ya estás inscrito
                    </p>

                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() =>
                        cancelarInscripcion(actividad.id)
                      }
                      style={{
                        ...boton,
                        background: "#b73b3b",
                        color: "white",
                        opacity: ocupado ? 0.6 : 1,
                      }}
                    >
                      {ocupado
                        ? "Procesando..."
                        : "Cancelar inscripción"}
                    </button>
                  </>
                ) : completa ? (
                  <p
                    style={{
                      color: "#ff7777",
                      fontWeight: "bold",
                    }}
                  >
                    No quedan plazas disponibles
                  </p>
                ) : !datosPlazas ? (
                  <p style={{ color: "#bbb" }}>
                    Inscripción no disponible temporalmente.
                  </p>
                ) : usuarioId ? (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => inscribirse(actividad.id)}
                    style={{
                      ...boton,
                      opacity: ocupado ? 0.6 : 1,
                    }}
                  >
                    {ocupado ? "Procesando..." : "Inscribirme"}
                  </button>
                ) : (
                  <Link
                    href="/login"
                    style={{
                      ...boton,
                      display: "inline-block",
                      textDecoration: "none",
                    }}
                  >
                    Inicia sesión para inscribirte
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        <div style={{ marginTop: 35 }}>
          <Link
            href="/dashboard"
            style={{
              ...boton,
              display: "inline-block",
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
