"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin() {
    setMessage("Iniciando sesión...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("Error: " + error.message);
      return;
    }

    setMessage("Sesión iniciada correctamente");
    window.location.href = "/";
  }

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
      <div
        style={{
          maxWidth: "420px",
          margin: "60px auto",
        }}
      >
        <p
          style={{
            color: "#f28c28",
            fontWeight: "bold",
            letterSpacing: "2px",
          }}
        >
          NH TRAINING CONCEPT
        </p>

        <h1>NH TRAIL CLUB</h1>

        <p style={{ color: "#bbbbbb" }}>
          Accede a tu cuenta
        </p>

        <div
          style={{
            marginTop: "30px",
            background: "#1c1c1c",
            padding: "25px",
            borderRadius: "16px",
          }}
        >
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "15px",
              marginBottom: "15px",
              borderRadius: "10px",
              border: "1px solid #444444",
              background: "#111111",
              color: "#ffffff",
              boxSizing: "border-box",
              fontSize: "16px",
            }}
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "15px",
              marginBottom: "15px",
              borderRadius: "10px",
              border: "1px solid #444444",
              background: "#111111",
              color: "#ffffff",
              boxSizing: "border-box",
              fontSize: "16px",
            }}
          />

          <button
            onClick={handleLogin}
            style={{
              width: "100%",
              background: "#f28c28",
              color: "#111111",
              border: "none",
              padding: "15px",
              borderRadius: "10px",
              fontWeight: "bold",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            Iniciar sesión
          </button>

          {message && (
            <p
              style={{
                marginTop: "20px",
                color: "#cccccc",
              }}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
