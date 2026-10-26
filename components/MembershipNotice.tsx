"use client";
import Link from "next/link";
import type { MembershipAccess } from "@/lib/membership-model";

export default function MembershipNotice({ access, error = false }: { access: MembershipAccess | null; error?: boolean }) {
  const basic = access?.state === "active" && !access.premium;
  const title = error ? "No se pudo comprobar tu acceso" : basic ? "Planificación individual con PLUS" :
    access?.state === "unpaid" ? "Cuota mensual pendiente de verificación" :
    access?.state === "pending" ? "Solicitud pendiente de aprobación" : "Elige tu modalidad del club";
  const body = error ? "Comprueba tu conexión y vuelve a intentarlo." : basic ?
    "Tu modalidad Básica incluye las salidas del club. La planificación individual y su seguimiento están incluidos en PLUS y PLUS Performance." :
    access?.state === "unpaid" ? "El club debe registrar como pagada la cuota del mes actual. Si ya has pagado, contacta con administración para verificarla." :
    access?.state === "pending" ? "El club está revisando tu solicitud. Podrás acceder cuando esté aprobada y el pago del mes esté verificado." :
    "Solicita Básica (10 €/mes), PLUS (60 €/mes) o PLUS Performance (100 €/mes). El acceso se activa tras la aprobación y la verificación del pago.";
  return <main style={{ minHeight: "100vh", background: "#101113", color: "white", padding: "60px 20px", fontFamily: "Arial,sans-serif" }}>
    <section aria-labelledby="membership-title" style={{ maxWidth: 640, margin: "auto", padding: 28, background: "#222427", border: "1px solid #ff922f", borderRadius: 16 }}>
      <p style={{ color: "#ff922f", fontWeight: 800 }}>NH / CLUB TRAIL RUNNING ALICANTE</p>
      <h1 id="membership-title">{title}</h1><p role={error ? "alert" : undefined} style={{ color: "#ddd", lineHeight: 1.7 }}>{body}</p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginTop: 24 }}>
        <Link href="/suscripciones" style={{ background: "#ff922f", color: "#111", padding: 12, borderRadius: 8, textDecoration: "none", fontWeight: 800 }}>Ver modalidades</Link>
        <Link href={basic ? "/salidas" : "/mis-cuotas"} style={{ color: "#ffad63" }}>{basic ? "Salidas del club" : "Mis cuotas y avisos"}</Link>
        <Link href="/dashboard" style={{ color: "#ffad63" }}>Mi panel</Link>
        {!basic && <button onClick={() => window.location.reload()} style={{ padding: 12, background: "#333", color: "white", border: "1px solid #777", borderRadius: 8 }}>Comprobar de nuevo</button>}
      </div>
    </section>
  </main>;
}
