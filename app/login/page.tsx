
"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

const inputStyle = {
  width: "100%",
  padding: "14px",
  marginBottom: "20px",
  background: "#111111",
  color: "#ffffff",
  border: "1px solid #444444",
  borderRadius: "10px",
  boxSizing: "border-box" as const,
  fontSize: "16px",
};

const buttonStyle = {
  width: "100%",
  background: "#f28c28",
  color: "#111111",
  border: "none",
  padding: "15px",
  borderRadius: "10px",
  fontWeight: "bold" as const,
  fontSize: "16px",
  cursor: "pointer",
};

export default function LoginPage() {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function changeMode() {
    setRegister(!register);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    setMessage("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (register) {
      if (!cleanName) {
        setMessage("Introduce tu nombre y apellidos.");
        return;
      }

      if (password.length < 8) {
        setMessage("La contraseña debe tener al menos 8 caracteres.");
        return;
      }

      if (password !== confirmPassword) {
        setMessage("Las contraseñas no coinciden.");
        return;
      }
    }

    setLoading(true);

    try {
      if (register) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanName,
            },
            emailRedirectTo:
              window.location.origin + "/login",
          },
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        if (data.session) {
          window.location.href = "/dashboard";
          return;
        }

        setMessage(
          "Solicitud de registro recibida. Si se ha creado la cuenta, revisa tu correo para confirmarla. Después podrás iniciar sesión."
        );

        setRegister(false);
        setPassword("");
        setConfirmPassword("");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setMessage(
        "Ha ocurrido un error de conexión. Inténtalo de nuevo."
      );
    } finally {
      setLoading(false);
    }
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
          {register
            ? "Únete a nuestra comunidad de corredores"
            : "Accede a tu cuenta"}
        </p>

        <div
          style={{
            background: "#1c1c1c",
            padding: "25px",
            borderRadius: "16px",
          }}
        >
          <h2
            style={{
              color: "#f28c28",
              fontSize: "22px",
              marginTop: 0,
              marginBottom: "25px",
            }}
          >
            {register ? "Crear cuenta" : "Iniciar sesión"}
          </h2>

          <form onSubmit={handleSubmit}>
            {register && (
              <>
                <label
                  htmlFor="name"
                  style={{
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  Nombre y apellidos
                </label>

                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  style={inputStyle}
                />
              </>
            )}

            <label
              htmlFor="email"
              style={{
                display: "block",
                marginBottom: "8px",
              }}
            >
              Correo electrónico
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={inputStyle}
            />

            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: "8px",
              }}
            >
              Contraseña
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={register ? 8 : undefined}
              autoComplete={
                register ? "new-password" : "current-password"
              }
              style={inputStyle}
            />

            {register && (
              <>
                <label
                  htmlFor="confirmPassword"
                  style={{
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  Confirmar contraseña
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  required
                  minLength={8}
                  autoComplete="new-password"
                  style={inputStyle}
                />
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...buttonStyle,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading
                ? "Procesando..."
                : register
                ? "Crear mi cuenta"
                : "Entrar"}
            </button>

            {message && (
              <p
                role="status"
                style={{
                  marginTop: "18px",
                  textAlign: "center",
                  color: "#f28c28",
                  lineHeight: "1.5",
                }}
              >
                {message}
              </p>
            )}

            {!register && (
              <div
                style={{
                  textAlign: "center",
                  marginTop: "18px",
                }}
              >
                <a
                  href="/forgot-password"
                  style={{
                    color: "#f28c28",
                    fontSize: "14px",
                  }}
                >
                  ¿Has olvidado tu contraseña?
                </a>
              </div>
            )}
          </form>

          <div
            style={{
              textAlign: "center",
              marginTop: "28px",
              borderTop: "1px solid #333333",
              paddingTop: "22px",
            }}
          >
            <p style={{ color: "#bbbbbb" }}>
              {register
                ? "¿Ya tienes una cuenta?"
                : "¿Todavía no formas parte del club?"}
            </p>

            <button
              type="button"
              onClick={changeMode}
              disabled={loading}
              style={{
                background: "transparent",
                color: "#f28c28",
                border: "1px solid #f28c28",
                borderRadius: "10px",
                padding: "12px 20px",
                fontSize: "15px",
                fontWeight: "bold",
                cursor: "pointer",
                width: "100%",
              }}
            >
              {register
                ? "Volver a iniciar sesión"
                : "Registrarme en NH Trail Club"}
            </button>
          </div>
        </div>

        <p
          style={{
            textAlign: "center",
            color: "#777777",
            fontSize: "13px",
            marginTop: "30px",
          }}
        >
          NH TRAIL CLUB · SALUD · FUERZA · MONTAÑA
        </p>
      </div>
    </main>
  );
}
