
"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    if (error) {
      setMessage("Error: " + error.message);
    } else {
      setMessage(
        "Si el correo está registrado, recibirás un enlace para cambiar tu contraseña. Revisa también la carpeta de spam."
      );
    }

    setLoading(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111111",
        color: "#ffffff",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <h3 style={{ color: "#f28c28" }}>
          NH TRAINING CONCEPT
        </h3>

        <h1>NH Club Trail Running Alicante</h1>
        <h2>Recuperar contraseña</h2>

        <p>Introduce tu correo electrónico.</p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "15px",
              background: "#222",
              color: "#fff",
              border: "1px solid #555",
              borderRadius: "8px",
              boxSizing: "border-box",
              marginBottom: "15px",
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "15px",
              background: "#f28c28",
              color: "#111",
              border: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {loading ? "Enviando..." : "Enviar enlace"}
          </button>
        </form>

        {message && (
          <p role="status" style={{ marginTop: "20px" }}>
            {message}
          </p>
        )}

        <p style={{ marginTop: "25px" }}>
          <a href="/login" style={{ color: "#f28c28" }}>
            Volver al inicio de sesión
          </a>
        </p>
      </div>
    </main>
  );
}
