
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
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

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
    void cargarDeportistas();
  }, []);

  async function agregarDeportista(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nombre.trim() || guardando) return;

    setGuardando(true);
    setMensaje("");

    const { error } = await supabase.from("deportistas").insert({
      nombre: nombre.trim(),
      email: email.trim(),
      telefono: telefono.trim(),
      nivel,
    });

    if (error) {
      setMensaje("Error al guardar: " + error.message);
    } else {
      setNombre("");
      setEmail("");
      setTelefono("");
      setNivel("Iniciación");
      setMostrarFormulario(false);
      setMensaje("Deportista guardado correctamente.");
      await cargarDeportistas();
    }

    setGuardando(false);
  }

  async function eliminarDeportista(id: string) {
    if (!window.confirm("¿Eliminar este deportista?")) return;

    const { error } = await supabase
      .from("deportistas")
      .delete()
      .eq("id", id);

    if (error) {
      setMensaje("Error al eliminar: " + error.message);
    } else {
      setMensaje("Deportista eliminado.");
      await cargarDeportistas();
    }
  }

  const filtrados = deportistas.filter((d) =>
    `${d.nombre} ${d.email ?? ""} ${d.telefono ?? ""}`
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
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
          >
            {mostrarFormulario ? "Cancelar" : "+ Añadir deportista"}
          </button>
        </section>

        {mostrarFormulario && (
          <section style={tarjeta}>
            <h2>Nuevo deportista</h2>

            <form onSubmit={agregarDeportista}>
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

              <button type="submit" style={boton} disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar deportista"}
              </button>
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
              <p>Nivel: {d.nivel}</p>
              <p>Correo: {d.email}</p>
              <p>Teléfono: {d.telefono}</p>

              <button
                type="button"
                onClick={() => eliminarDeportista(d.id)}
                style={{
                  ...boton,
                  background: "#662222",
                  color: "white",
                }}
              >
                Eliminar
              </button>
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
