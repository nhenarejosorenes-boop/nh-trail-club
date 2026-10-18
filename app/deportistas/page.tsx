
"use client";

import { useState } from "react";

type Deportista = {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  nivel: string;
};

export default function DeportistasPage() {
  const [deportistas, setDeportistas] = useState<Deportista[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [nivel, setNivel] = useState("Iniciación");

  function agregarDeportista(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!nombre.trim()) return;

    const nuevo: Deportista = {
      id: Date.now(),
      nombre: nombre.trim(),
      email: email.trim(),
      telefono: telefono.trim(),
      nivel,
    };

    setDeportistas((actuales) => [...actuales, nuevo]);
    setNombre("");
    setEmail("");
    setTelefono("");
    setNivel("Iniciación");
    setMostrarFormulario(false);
  }

  const filtrados = deportistas.filter((d) =>
    d.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const campo = {
    width: "100%",
    padding: "13px",
    background: "#111",
    border: "1px solid #444",
    borderRadius: "8px",
    color: "white",
    boxSizing: "border-box" as const,
    marginBottom: "14px",
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "#111",
      color: "white",
      fontFamily: "Arial, sans-serif",
      padding: "30px",
    }}>
      <div style={{ maxWidth: "1100px", margin: "auto" }}>
        <a href="/dashboard" style={{
          color: "#f28c28",
          textDecoration: "none",
        }}>
          ← Volver al panel principal
        </a>

        <p style={{
          color: "#f28c28",
          fontWeight: "bold",
          letterSpacing: "2px",
          marginTop: "35px",
        }}>
          NH TRAINING CONCEPT
        </p>

        <h1>GESTIÓN DE DEPORTISTAS</h1>
        <p style={{ color: "#aaa" }}>
          NH Trail Club · Administración de socios
        </p>

        <section style={{
          background: "#1e1e1e",
          padding: "25px",
          borderRadius: "14px",
          marginTop: "35px",
          marginBottom: "25px",
        }}>
          <h2>Deportistas registrados</h2>
          <p style={{
            color: "#f28c28",
            fontSize: "32px",
            fontWeight: "bold",
          }}>
            {deportistas.length}
          </p>

          <button
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
            style={{
              background: "#f28c28",
              color: "#111",
              border: "none",
              padding: "14px 22px",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {mostrarFormulario ? "Cancelar" : "+ Añadir deportista"}
          </button>
        </section>

        {mostrarFormulario && (
          <form onSubmit={agregarDeportista} style={{
            background: "#1e1e1e",
            padding: "25px",
            borderRadius: "14px",
            marginBottom: "25px",
          }}>
            <h2>Nuevo deportista</h2>

            <label>Nombre y apellidos</label>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              style={campo}
              placeholder="Nombre completo"
            />

            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={campo}
              placeholder="Correo electrónico"
            />

            <label>Teléfono</label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              style={campo}
              placeholder="Teléfono"
            />

            <label>Nivel deportivo</label>
            <select
              value={nivel}
              onChange={(e) => setNivel(e.target.value)}
              style={campo}
            >
              <option>Iniciación</option>
              <option>Intermedio</option>
              <option>Avanzado</option>
              <option>Competición</option>
            </select>

            <button type="submit" style={{
              background: "#f28c28",
              color: "#111",
              padding: "14px 24px",
              border: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: "pointer",
            }}>
              Guardar deportista
            </button>
          </form>
        )}

        <section style={{
          background: "#1e1e1e",
          padding: "25px",
          borderRadius: "14px",
        }}>
          <h2>Listado de deportistas</h2>

          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar deportista..."
            style={campo}
          />

          {filtrados.length === 0 ? (
            <p style={{ color: "#aaa" }}>
              No hay deportistas para mostrar.
            </p>
          ) : (
            <div style={{
              display: "grid",
              gap: "15px",
            }}>
              {filtrados.map((d) => (
                <div key={d.id} style={{
                  background: "#292929",
                  borderRadius: "10px",
                  padding: "20px",
                  borderLeft: "4px solid #f28c28",
                }}>
                  <h3 style={{
                    color: "#f28c28",
                    marginTop: 0,
                  }}>
                    {d.nombre}
                  </h3>
                  <p>Nivel: {d.nivel}</p>
                  <p>Correo: {d.email || "Sin registrar"}</p>
                  <p>Teléfono: {d.telefono || "Sin registrar"}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
