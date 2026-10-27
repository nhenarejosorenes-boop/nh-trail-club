"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPage() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const update = () => setInstalled(display.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const available = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const done = () => { setInstalled(true); setPrompt(null); setMessage("Instalación completada. Abre NH Trail desde su icono."); };
    update();
    display.addEventListener("change", update);
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", done);
    return () => {
      display.removeEventListener("change", update);
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  async function install() {
    if (!prompt || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setMessage(choice.outcome === "accepted" ? "Solicitud aceptada. Espera la confirmación de tu dispositivo." : "Puedes instalarla más tarde desde el menú del navegador.");
    } catch {
      setMessage("No se pudo abrir la instalación. Utiliza el menú del navegador y sigue los pasos de abajo.");
    } finally { setPrompt(null); setBusy(false); }
  }

  return <main style={{ minHeight: "100vh", background: "#101113", color: "#fff", padding: "32px 20px", fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}>
    <div style={{ maxWidth: 720, margin: "auto" }}>
      <Link href="/dashboard" style={{ color: "#ff8d27" }}>← Volver al panel</Link>
      <p style={{ color: "#ff8d27", fontWeight: 800 }}>NH TRAINING CONCEPT</p>
      <h1>Instala NH Trail Club en tu móvil</h1>
      <p>Abre tus entrenamientos, salidas y mensajes desde un icono en la pantalla de inicio. La misma aplicación sirve para Básica, PLUS y PLUS Performance; tus servicios dependen de tu cuenta y modalidad activa.</p>
      {installed ? <p role="status">Estás usando NH Trail Club como aplicación instalada en este dispositivo.</p> : prompt ? <button type="button" disabled={busy} onClick={() => void install()} style={{ background: "#ff8d27", color: "#101113", border: 0, padding: "14px 20px", borderRadius: 10, fontSize: 17, fontWeight: 800 }}>{busy ? "Abriendo instalación…" : "Instalar NH Trail Club"}</button> : <p>Si no aparece el botón de instalación, utiliza el menú de tu navegador:</p>}
      {message && <p role="status">{message}</p>}
      <section><h2>Android · Chrome</h2><ol><li>Abre esta web en Chrome, fuera del navegador de WhatsApp o Instagram.</li><li>Pulsa el menú de los tres puntos.</li><li>Selecciona «Instalar aplicación» o «Añadir a pantalla de inicio» y confirma.</li><li>Abre el icono NH Trail e inicia sesión con tu cuenta.</li></ol></section>
      <section><h2>iPhone · Safari</h2><ol><li>Abre esta web en Safari.</li><li>Pulsa Compartir y selecciona «Añadir a pantalla de inicio».</li><li>Si aparece «Abrir como app web», déjalo activado y pulsa Añadir.</li><li>Abre el icono NH Trail e inicia sesión con tu cuenta.</li></ol></section>
      <p>Necesitas conexión a internet. La instalación no activa una suscripción ni confirma pagos. Si no recuerdas tu contraseña, utiliza la recuperación en la pantalla de acceso.</p>
      <Link href="/login" style={{ color: "#ff8d27", fontWeight: 800 }}>Acceder a mi cuenta →</Link>
    </div>
  </main>;
}
