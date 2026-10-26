"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { loadInbox } from "@/lib/messaging-client";
import { totalUnread } from "@/lib/messaging-model";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
export default function MessagingShortcut({ admin = false }: { admin?: boolean }) {
  const [unread, setUnread] = useState<number | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true, running = false;
    async function update() {
      if (document.visibilityState !== "visible" || running) return;
      running = true;
      try { const inbox = await loadInbox(supabase); if (active) { setUnread(totalUnread(inbox)); setError(false); } }
      catch { if (active) setError(true); } finally { running = false; }
    }
    void update(); const timer = window.setInterval(() => void update(), 20000);
    document.addEventListener("visibilitychange", update); window.addEventListener("focus", update);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", update); window.removeEventListener("focus", update); };
  }, []);
  return <section style={{ background: "#202225", border: "1px solid #80502c", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }} aria-label="Mensajes del club">
    <Link href="/mensajes" style={{ color: "#ffad63", fontWeight: 800, fontSize: 18 }}>{admin ? "Mensajes de deportistas" : "Mi entrenador"}{unread !== null && unread > 0 ? " · " + unread + " sin leer" : " →"}</Link>
    <p style={{ color: "#c8cbd0", marginBottom: 0 }}>{error ? "No se pudo actualizar el contador. Abre la bandeja para comprobar tus mensajes." : unread === null ? "Comprobando mensajes..." : unread > 0 ? "Tienes mensajes pendientes de leer." : "Consulta tu historial o inicia una conversación privada."}</p>
  </section>;
}
