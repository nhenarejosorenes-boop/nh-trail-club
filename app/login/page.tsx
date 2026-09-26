"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
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

        <h1
          style={{
            fontSize: "40px",
            marginBottom: "10px",
          }}
        >
          NH TRAIL CLUB
        </h1>

        <p
          style={{
            color: "#bbbbbb",
            marginBottom: "30px",
          }}
        >
          Accede a tu cuenta
        </p>

        <div
          style={{
            background: "#1c1c1c",
            padding: "25px",
            borderRadius: "16px",
          }}
        >
          <form onSubmit={handleSubmit}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
              }}
            >
              Correo electrónico
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "14px",
                marginBottom: "20px",
                background: "#111111",
                color: "#ffffff",
                border: "1px solid #444444",
                borderRadius: "10px",
                boxSizing: "border-box",
                fontSize: "16px",
              }}
            />

            <label
              style={{
                display: "block",
                marginBottom: "8px",
              }}
            >
              Contraseña
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "14px",
                marginBottom: "22px",
                background: "#111111",
                color: "#ffffff",
                border: "1px solid #444444",
                borderRadius: "10px",
                boxSizing: "border-box",
                fontSize: "16px",
              }}
            />

            <button
              type="submit"
              disabled={loading}
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
              {loading ? "Entrando..." : "Entrar"}
            </button>

            {message && (
              <p
                style={{
                  marginTop: "18px",
                  textAlign: "center",
                }}
              >
                {message}
              </p>
            )}
          </form>
        </div>
      </div>
    </main>
  );
          }
