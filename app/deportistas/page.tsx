
"use client";

import { useEffect, useState, type FormEvent } from "react";
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

export default function DeportistasPage() {
  const [deportistas, setDeportistas] = useState<Deportista[]>([]);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [nivel, setNivel] = useState("Iniciación");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [autorizado, setAutorizado] = useState(false);
  const [verificando, setVerificando] = useState(true);

  async function cargarDeportistas() {
    setCargando(true);

    const { data, error } = await supabase
      .from("deportistas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMensaje("Error al cargar: " + error.message);
    } else {
      setDeportistas(data ?? []);
    }

    setCargando(false);
  }

  useEffect(() => {
    let activo = true;
    async function comprobarAcceso() {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (!activo) return;
        if (authError || !auth.user) {
          setMensaje("Debes iniciar sesión para acceder.");
          return;
        }
        const { data: perfil, error: perfilError } = await supabase
          .from("profiles").select("role").eq("id", auth.user.id).single();
        if (!activo) return;
        if (perfilError || perfil?.role !== "admin") {
          setMensaje("No tienes permisos de administrador.");
          return;
        }
        setAutorizado(true);
        await cargarDeportistas();
      } catch {
        if (activo) setMensaje("No se pudo comprobar el acceso.");
      } finally {
        if (activo) setVerificando(false);
      }
    }
    void comprobarAcceso();
    return () => { activo = false; };
  }, []);

  function limpiarFormulario() {
    setNombre("");
    setEmail("");
    setTelefono("");
    setNivel("Iniciación");
    setEditandoId(null);
    setMostrarFormulario(false);
  }

  function nuevoDeportista() {
    limpiarFormulario();
    setMensaje("");
    setMostrarFormulario(true);
  }

  function editarDeportista(d: Deportista) {
    setNombre(d.nombre);
    setEmail(d.email ?? "");
    setTelefono(d.telefono ?? "");
    setNivel(d.nivel ?? "Iniciación");
    setEditandoId(d.id);
    setMostrarFormulario(true);
    setMensaje("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function guardarDeportista(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nombre.trim() || guardando) return;

    setGuardando(true);
    setMensaje("");

    const datos = {
      nombre: nombre.trim(),
      email: email.trim() || null,
      telefono: telefono.trim() || null,
      nivel,
    };

    if (editandoId) {
      const { data, error } = await supabase
        .from("deportistas")
        .update(datos)
        .eq("id", editandoId)
        .select("id");

      if (error) {
        setMensaje("Error al actualizar: " + error.message);
      } else if (!data?.length) {
        setMensaje("No se pudo actualizar el deportista. Comprueba los permisos.");
      } else {
        limpiarFormulario();
        await cargarDeportistas();
        setMensaje("Deportista actualizado correctamente.");
      }
    } else {
      const { data, error } = await supabase
        .from("deportistas")
        .insert(datos)
        .select("id");

      if (error) {
        setMensaje("Error al guardar: " + error.message);
      } else if (!data?.length) {
        setMensaje("No se pudo confirmar el registro. Comprueba los permisos.");
      } else {
        limpiarFormulario();
        await cargarDeportistas();
        setMensaje("Deportista guardado correctamente.");
      }
    }

    setGuardando(false);
  }

  async function eliminarDeportista(id: string) {
    if (guardando || eliminandoId) return;
    if (!window.confirm("¿Eliminar definitivamente este deportista?")) return;

    setEliminandoId(id);
    setMensaje("");

    const { data, error } = await supabase
      .from("deportistas")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      setMensaje("Error al eliminar: " + error.message);
    } else if (!data?.length) {
      setMensaje("No se pudo eliminar. Comprueba los permisos.");
    } else {
      if (editandoId === id) limpiarFormulario();
      await cargarDeportistas();
      setMensaje("Deportista eliminado correctamente.");
    }

    setEliminandoId(null);
  }

  const filtrados = deportistas.filter((d) =>
    `${d.nombre} ${d.email ?? ""} ${d.telefono ?? ""} ${d.nivel ?? ""}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  );

  const campo = {
    width: "100%",
    padding: "12px",
    background: "#111111",
    border: "1px solid #444444",
    borderRadius: "8px",
    color: "white",
    boxSizing: "border-box" as const,
    marginTop: "6px",
    marginBottom: "14px",
  };

  const boton = {
    background: "#ff8c28",
    color: "#111111",
    border: "none",
    padding: "12px 20px",
    borderRadius: "8px",
    fontWeight: "bold" as const,
    cursor: "pointer",
  };

  const tarjeta = {
    background: "#1f1f1f",
    padding: "22px",
    borderRadius: "12px",
    marginBottom: "22px",
  };

  if (verificando) return <main style={{ minHeight: "100vh", background: "#111", color: "white", padding: 40 }}>Comprobando permisos...</main>;
  if (!autorizado) return <main style={{ minHeight: "100vh", background: "#111", color: "white", padding: 40 }}><h1>Acceso restringido</h1><p>{mensaje}</p><a href="/dashboard" style={{ color: "#ff8c28" }}>Volver al panel</a></main>;

  return (
    <main
      style={{
        background: "#111111",
        color: "white",
        minHeight: "100vh",
        padding: "40px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: "950px", margin: "auto" }}>
        <p style={{ color: "#ff8c28", fontWeight: "bold" }}>
          NH TRAINING CONCEPT
        </p>

        <h1>GESTIÓN DE DEPORTISTAS</h1>
        <p style={{ color: "#aaaaaa" }}>
          NH Trail Club · Administración de socios
        </p>

        <section style={{ ...tarjeta, marginTop: "30px" }}>
          <h2>Deportistas registrados</h2>
          <h1 style={{ color: "#ff8c28" }}>
            {cargando ? "..." : deportistas.length}
          </h1>

          <button
            type="button"
            style={boton}
            onClick={() =>
              mostrarFormulario ? limpiarFormulario() : nuevoDeportista()
            }
            disabled={guardando}
          >
            {mostrarFormulario ? "Cancelar" : "+ Añadir deportista"}
          </button>
        </section>

        {mostrarFormulario && (
          <section style={tarjeta}>
            <h2>
              {editandoId ? "Editar deportista" : "Nuevo deportista"}
            </h2>

            <form onSubmit={guardarDeportista}>
              <label htmlFor="nombre">Nombre y apellidos</label>
              <input
                id="nombre"
                style={campo}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />

              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                style={campo}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <label htmlFor="telefono">Teléfono</label>
              <input
                id="telefono"
                type="tel"
                style={campo}
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />

              <label htmlFor="nivel">Nivel deportivo</label>
              <select
                id="nivel"
                style={campo}
                value={nivel}
                onChange={(e) => setNivel(e.target.value)}
              >
                <option>Iniciación</option>
                <option>Intermedio</option>
                <option>Avanzado</option>
                <option>Competición</option>
              </select>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button type="submit" style={boton} disabled={guardando}>
                  {guardando
                    ? "Guardando..."
                    : editandoId
                      ? "Guardar cambios"
                      : "Guardar deportista"}
                </button>

                <button
                  type="button"
                  style={{
                    ...boton,
                    background: "#444444",
                    color: "white",
                  }}
                  onClick={limpiarFormulario}
                  disabled={guardando}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        )}

        {mensaje && (
          <p role="status" style={{ color: "#ff8c28" }}>
            {mensaje}
          </p>
        )}

        <section style={tarjeta}>
          <h2>Listado de deportistas</h2>

          <input
            aria-label="Buscar deportista"
            style={campo}
            placeholder="Buscar deportista..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          {cargando && <p>Cargando deportistas...</p>}

          {!cargando && filtrados.length === 0 && (
            <p>No hay deportistas para mostrar.</p>
          )}

          {filtrados.map((d) => (
            <div
              key={d.id}
              style={{
                background: "#292929",
                padding: "18px",
                borderRadius: "9px",
                borderLeft: "4px solid #ff8c28",
                marginBottom: "12px",
              }}
            >
              <h3 style={{ color: "#ff8c28" }}>{d.nombre}</h3>
              <p>Nivel: {d.nivel || "Sin especificar"}</p>
              <p>Correo: {d.email || "Sin especificar"}</p>
              <p>Teléfono: {d.telefono || "Sin especificar"}</p>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
               
<a
  href={`/deportistas/${d.id}`}
  style={{
    ...boton,
    display: "inline-block",
    textDecoration: "none",
  }}
>
  Ver ficha
</a>

                <button
                  type="button"
                  onClick={() => editarDeportista(d)}
                  style={boton}
                  disabled={guardando || eliminandoId !== null}
                >
                  Editar
                </button>

                <button
                  type="button"
                  onClick={() => void eliminarDeportista(d.id)}
                  disabled={guardando || eliminandoId !== null}
                  style={{
                    ...boton,
                    background: "#662222",
                    color: "white",
                  }}
                >
                  {eliminandoId === d.id ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </div>
          ))}
        </section>

        <a href="/dashboard" style={{ color: "#ff8c28" }}>
          ← Volver al panel principal
        </a>
      </div>
    </main>
  );
}
