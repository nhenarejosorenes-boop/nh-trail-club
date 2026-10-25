
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
  activity_type: string;
  starts_at: string;
  location: string | null;
  max_participants: number;
};

type Inscripcion = {
  activity_id: string;
  user_id: string;
  created_at: string;
};

type Participante = {
  user_id: string;
  nombre: string;
  email: string;
};

type Formulario = {
  title: string;
  description: string;
  activity_type: string;
  starts_at: string;
  location: string;
  max_participants: number;
};

const formularioInicial: Formulario = {
  title: "",
  description: "",
  activity_type: "trail",
  starts_at: "",
  location: "",
  max_participants: 15,
};

const campo: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 8,
  border: "1px solid #444",
  background: "#292929",
  color: "white",
  fontSize: 15,
  boxSizing: "border-box",
};

const boton: React.CSSProperties = {
  padding: "12px 18px",
  border: "none",
  borderRadius: 8,
  background: "#ff8c1a",
  color: "#111",
  fontWeight: "bold",
  cursor: "pointer",
};

export default function AdminPage() {
  const [autorizado, setAutorizado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [formulario, setFormulario] =
    useState<Formulario>(formularioInicial);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [inscritosAbiertos, setInscritosAbiertos] =
    useState<string | null>(null);
  const [participantes, setParticipantes] =
    useState<Record<string, Participante[]>>({});
  const [cargandoInscritos, setCargandoInscritos] = useState(false);
  const [errorInscritos, setErrorInscritos] = useState("");

  async function cargarActividades() {
    const { data, error: consultaError } = await supabase
      .from("club_activities")
      .select("*")
      .order("starts_at", { ascending: true });

    if (consultaError) {
      setError(consultaError.message);
    } else {
      setActividades((data || []) as Actividad[]);
    }
  }

  async function cargarInscripciones() {
    const { data, error: consultaError } = await supabase
      .from("activity_registrations")
      .select("activity_id,user_id,created_at");

    if (consultaError) {
      setErrorInscritos(consultaError.message);
    } else {
      setInscripciones((data || []) as Inscripcion[]);
      setErrorInscritos("");
    }
  }

  useEffect(() => {
    let activo = true;

    async function iniciar() {
      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (!activo) return;

        if (authError || !authData.user) {
          setError("Debes iniciar sesión.");
          return;
        }

        const { data, error: perfilError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", authData.user.id)
          .single();

        if (!activo) return;

        if (perfilError || data?.role !== "admin") {
          setError("No tienes permisos de administrador.");
          return;
        }

        setAutorizado(true);
        await Promise.all([
          cargarActividades(),
          cargarInscripciones(),
        ]);
      } catch (err) {
        if (activo) {
          setError(
            err instanceof Error ? err.message : "Error de conexión."
          );
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    iniciar();

    return () => {
      activo = false;
    };
  }, []);

  function actualizarCampo(
    nombre: keyof Formulario,
    valor: string | number
  ) {
    setFormulario((anterior) => ({
      ...anterior,
      [nombre]: valor,
    }));
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setFormulario({ ...formularioInicial });
  }

  function prepararEdicion(actividad: Actividad) {
    setEditandoId(actividad.id);

    setFormulario({
      title: actividad.title,
      description: actividad.description || "",
      activity_type: actividad.activity_type,
      starts_at: new Date(actividad.starts_at)
        .toLocaleString("sv-SE", {
          timeZone: "Europe/Madrid",
          hour12: false,
        })
        .replace(" ", "T")
        .slice(0, 16),
      location: actividad.location || "",
      max_participants: actividad.max_participants,
    });

    setError("");
    setMensaje("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function guardarActividad(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (procesando) return;

    setError("");
    setMensaje("");

    if (
      !formulario.title.trim() ||
      !formulario.starts_at ||
      !Number.isInteger(formulario.max_participants) ||
      formulario.max_participants < 1
    ) {
      setError("Comprueba el título, la fecha y las plazas.");
      return;
    }

    const fecha = new Date(formulario.starts_at);

    if (Number.isNaN(fecha.getTime())) {
      setError("La fecha no es válida.");
      return;
    }

    setProcesando(true);

    try {
      const datos = {
        title: formulario.title.trim(),
        description: formulario.description.trim() || null,
        activity_type: formulario.activity_type,
        starts_at: fecha.toISOString(),
        location: formulario.location.trim() || null,
        max_participants: formulario.max_participants,
      };

      const resultado = editandoId
        ? await supabase
            .from("club_activities")
            .update(datos)
            .eq("id", editandoId)
            .select("id")
        : await supabase
            .from("club_activities")
            .insert(datos)
            .select("id");

      if (resultado.error) {
        setError(resultado.error.message);
      } else if (!resultado.data?.length) {
        setError("No se pudo confirmar la operación.");
      } else {
        setMensaje(
          editandoId
            ? "Actividad actualizada correctamente."
            : "Actividad creada correctamente."
        );

        cancelarEdicion();
        await Promise.all([
          cargarActividades(),
          cargarInscripciones(),
        ]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al guardar."
      );
    } finally {
      setProcesando(false);
    }
  }

  async function eliminarActividad(actividad: Actividad) {
    if (procesando) return;

    const confirmar = window.confirm(
      "¿Eliminar la actividad " +
        actividad.title +
        "? Esta acción puede afectar a las inscripciones."
    );

    if (!confirmar) return;

    setProcesando(true);
    setError("");
    setMensaje("");

    try {
      const { data, error: eliminarError } = await supabase
        .from("club_activities")
        .delete()
        .eq("id", actividad.id)
        .select("id");

      if (eliminarError) {
        setError(eliminarError.message);
      } else if (!data?.length) {
        setError("No se pudo confirmar la eliminación.");
      } else {
        setMensaje("Actividad eliminada correctamente.");
        setInscritosAbiertos(null);
        await Promise.all([
          cargarActividades(),
          cargarInscripciones(),
        ]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al eliminar."
      );
    } finally {
      setProcesando(false);
    }
  }

  async function verInscritos(id: string) {
    if (inscritosAbiertos === id) {
      setInscritosAbiertos(null);
      return;
    }

    setInscritosAbiertos(id);
    setCargandoInscritos(true);
    setErrorInscritos("");

    try {
      const { data, error: regError } = await supabase
        .from("activity_registrations")
        .select("activity_id,user_id,created_at")
        .eq("activity_id", id);

      if (regError) throw regError;

      const lista = (data || []) as Inscripcion[];

      setInscripciones((prev) => [
        ...prev.filter((r) => r.activity_id !== id),
        ...lista,
      ]);

      if (lista.length === 0) {
        setParticipantes((prev) => ({ ...prev, [id]: [] }));
        return;
      }

      const ids = [...new Set(lista.map((r) => r.user_id))];

      const [perfiles, deportistas] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", ids),
        supabase
          .from("deportistas")
          .select("user_id,nombre,email")
          .in("user_id", ids),
      ]);

      if (perfiles.error && deportistas.error) {
        throw new Error(
          "No se pudieron consultar los datos de participantes."
        );
      }

      const resultado: Participante[] = ids.map((user_id) => {
        const d = deportistas.data?.find(
          (x) => x.user_id === user_id
        );
        const p = perfiles.data?.find(
          (x) => x.id === user_id
        );

        return {
          user_id,
          nombre:
            d?.nombre || p?.full_name || "Nombre no disponible",
          email:
            d?.email || p?.email || "Correo no disponible",
        };
      });

      setParticipantes((prev) => ({
        ...prev,
        [id]: resultado,
      }));
    } catch (err) {
      setErrorInscritos(
        err instanceof Error
          ? err.message
          : "Error al consultar participantes."
      );
    } finally {
      setCargandoInscritos(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "white",
        padding: "40px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <p style={{ color: "#ff8c1a", fontWeight: "bold" }}>
          NH TRAINING CONCEPT
        </p>

        <h1>Administración NH Trail Club</h1>

        {cargando && <p>Comprobando permisos...</p>}

        {error && (
          <p role="alert" style={{ color: "#ff8888" }}>
            {error}
          </p>
        )}

        {mensaje && (
          <p role="status" style={{ color: "#8ee6a0" }}>
            {mensaje}
          </p>
        )}

        {autorizado && (
          <>
            <section
              style={{
                background: "#1e1e1e",
                padding: 25,
                borderRadius: 12,
                marginTop: 25,
              }}
            >
              <h2 style={{ color: "#ff8c1a" }}>
                {editandoId
                  ? "Editar actividad"
                  : "Crear nueva actividad"}
              </h2>

              <form onSubmit={guardarActividad}>
                <div style={{ display: "grid", gap: 18 }}>
                  <label>
                    Nombre de la actividad
                    <input
                      style={campo}
                      required
                      value={formulario.title}
                      onChange={(e) =>
                        actualizarCampo("title", e.target.value)
                      }
                    />
                  </label>

                  <label>
                    Descripción
                    <textarea
                      style={campo}
                      rows={4}
                      value={formulario.description}
                      onChange={(e) =>
                        actualizarCampo(
                          "description",
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Tipo de actividad
                    <select
                      style={campo}
                      value={formulario.activity_type}
                      onChange={(e) =>
                        actualizarCampo(
                          "activity_type",
                          e.target.value
                        )
                      }
                    >
                      <option value="trail">Trail</option>
                      <option value="senderismo">Senderismo</option>
                      <option value="montaña">Montaña</option>
                      <option value="entrenamiento">
                        Entrenamiento
                      </option>
                    </select>
                  </label>

                  <label>
                    Fecha y hora
                    <input
                      style={campo}
                      type="datetime-local"
                      required
                      value={formulario.starts_at}
                      onChange={(e) =>
                        actualizarCampo(
                          "starts_at",
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Ubicación
                    <input
                      style={campo}
                      value={formulario.location}
                      onChange={(e) =>
                        actualizarCampo(
                          "location",
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Plazas máximas
                    <input
                      style={campo}
                      type="number"
                      min={1}
                      required
                      value={formulario.max_participants}
                      onChange={(e) =>
                        actualizarCampo(
                          "max_participants",
                          Number(e.target.value)
                        )
                      }
                    />
                  </label>

                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="submit"
                      disabled={procesando}
                      style={boton}
                    >
                      {procesando
                        ? "Guardando..."
                        : editandoId
                        ? "Guardar cambios"
                        : "Crear actividad"}
                    </button>

                    {editandoId && (
                      <button
                        type="button"
                        disabled={procesando}
                        onClick={cancelarEdicion}
                        style={{
                          ...boton,
                          background: "#555",
                          color: "white",
                        }}
                      >
                        Cancelar edición
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </section>

            <h2
              style={{
                color: "#ff8c1a",
                marginTop: 40,
              }}
            >
              Actividades registradas
            </h2>

            {errorInscritos && !inscritosAbiertos && (
              <p role="alert" style={{ color: "#ff8888" }}>
                {errorInscritos}
              </p>
            )}

            {actividades.length === 0 && (
              <p>No hay actividades registradas.</p>
            )}

            {actividades.map((actividad) => {
              const total = inscripciones.filter(
                (r) => r.activity_id === actividad.id
              ).length;

              const disponibles = Math.max(
                0,
                actividad.max_participants - total
              );

              return (
                <article
                  key={actividad.id}
                  style={{
                    background: "#1e1e1e",
                    padding: 22,
                    borderRadius: 12,
                    marginBottom: 15,
                    border: "1px solid #333",
                  }}
                >
                  <h3 style={{ color: "#ff8c1a" }}>
                    {actividad.title}
                  </h3>

                  <p>
                    {new Date(
                      actividad.starts_at
                    ).toLocaleString("es-ES", {
                      dateStyle: "long",
                      timeStyle: "short",
                      timeZone: "Europe/Madrid",
                    })}
                  </p>

                  <p>
                    Ubicación:{" "}
                    {actividad.location || "Por determinar"}
                  </p>

                  <p>
                    Plazas máximas:{" "}
                    {actividad.max_participants}
                  </p>

                  <p style={{ color: "#8ee6a0" }}>
                    Inscritos: {total} /{" "}
                    {actividad.max_participants}
                    {" · "}
                    Plazas disponibles: {disponibles}
                  </p>

                  <button
                    type="button"
                    style={boton}
                    onClick={() =>
                      verInscritos(actividad.id)
                    }
                  >
                    {inscritosAbiertos === actividad.id
                      ? "Ocultar inscritos"
                      : "Ver inscritos"}
                  </button>

                  {inscritosAbiertos === actividad.id && (
                    <section
                      style={{
                        background: "#292929",
                        padding: 16,
                        marginTop: 12,
                        borderRadius: 8,
                      }}
                    >
                      <h4>Participantes inscritos</h4>

                      {cargandoInscritos ? (
                        <p>Cargando...</p>
                      ) : errorInscritos ? (
                        <p
                          role="alert"
                          style={{ color: "#ff8888" }}
                        >
                          {errorInscritos}
                        </p>
                      ) : (
                        <>
                          {(participantes[actividad.id] || [])
                            .length === 0 ? (
                            <p>No hay inscritos.</p>
                          ) : (
                            <ul>
                              {(
                                participantes[actividad.id] || []
                              ).map((p) => (
                                <li key={p.user_id}>
                                  {p.nombre} — {p.email}
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </section>
                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                      marginTop: 15,
                    }}
                  >
                    <button
                      type="button"
                      disabled={procesando}
                      style={boton}
                      onClick={() =>
                        prepararEdicion(actividad)
                      }
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      disabled={procesando}
                      style={{
                        ...boton,
                        background: "#b73b3b",
                        color: "white",
                      }}
                      onClick={() =>
                        eliminarActividad(actividad)
                      }
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              );
            })}
          </>
        )}

        <div style={{ marginTop: 35 }}>
          <Link
            href="/dashboard"
            style={{ color: "#ff8c1a" }}
          >
            Volver al panel principal
          </Link>
        </div>
      </div>
    </main>
  );
}
