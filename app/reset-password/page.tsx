"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const updatePassword = async () => {
    if (password.length < 6) {
      setMessage("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage("No se pudo cambiar la contraseña: " + error.message);
    } else {
      setMessage("Contraseña actualizada correctamente.");
      setPassword("");
    }

    setLoading(false);
  };

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
      <div style={{ maxWidth: "500px", margin: "0 auto" }}>
        <p
          style={{
            color: "#f28c28",
            fontWeight: "bold",
            letterSpacing: "2px",
          }}
        >
          NH TRAINING CONCEPT
        </p>

        <h1 style={{ fontSize: "42px", marginBottom: "10px" }}>
          NUEVA CONTRASEÑA
        </h1>

        <p style={{ color: "#cccccc", marginBottom: "35px" }}>
          Introduce tu nueva contraseña.
        </p>

        <div
          style={{
            background: "#1c1c1c",
            padding: "25px",
            borderRadius: "16px",
          }}
        >
          <label>Nueva contraseña</label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nueva contraseña"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "15px",
              marginTop: "10px",
              marginBottom: "20px",
              borderRadius: "8px",
              border: "1px solid #444",
              background: "#222",
              color: "#fff",
              fontSize: "16px",
            }}
          />

          <button
            onClick={updatePassword}
            disabled={loading}
            style={{
              width: "100%",
              padding: "15px",
              border: "none",
              borderRadius: "8px",
              background: "#f28c28",
              color: "#111",
              fontWeight: "bold",
              fontSize: "16px",
            }}
          >
            {loading ? "Guardando..." : "Cambiar contraseña"}
          </button>

          {message && (
            <p style={{ marginTop: "20px", color: "#ffffff" }}>
              {message}
            </p>
          )}
        </div>
      </div>
    </main>
  );
            }
