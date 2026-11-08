"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./web-app-chrome.module.css";

const links = [
  { href: "/dashboard", label: "Inicio", icon: "home" },
  { href: "/entrenamientos", label: "Entrenar", icon: "training" },
  { href: "/salidas", label: "Salidas", icon: "mountain" },
  { href: "/mensajes", label: "Mensajes", icon: "message" },
  { href: "/progreso", label: "Progreso", icon: "progress" },
] as const;

function section(pathname: string) {
  if (["/objetivos", "/dispositivos", "/importar-actividad"].includes(pathname) || pathname.startsWith("/entrenamientos")) return "/entrenamientos";
  if (pathname === "/seguimiento-trail") return "/progreso";
  return links.find(link => pathname === link.href)?.href;
}

function Icon({ kind }: { kind: typeof links[number]["icon"] }) {
  const paths = {
    home: "M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9",
    training: "M3 7v10M6 5v14M18 5v14M21 7v10M6 12h12",
    mountain: "m2 20 8-15 5 9 3-5 4 11H2ZM7 11l3 2 3-2",
    message: "M4 3h16v14H9l-5 4V3ZM8 8h8M8 12h5",
    progress: "M4 3v18h17M7 16l5-6 4 2 5-7",
  };
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind]} /></svg>;
}

export default function WebAppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [offline, setOffline] = useState(false);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    let wasOffline = !navigator.onLine;
    setOffline(wasOffline);
    const lost = () => { wasOffline = true; setOffline(true); setRestored(false); };
    const recovered = () => { setOffline(false); if (wasOffline) setRestored(true); wasOffline = false; };
    window.addEventListener("offline", lost);
    window.addEventListener("online", recovered);
    return () => { window.removeEventListener("offline", lost); window.removeEventListener("online", recovered); };
  }, []);
  const showNavigation = ["/dashboard", "/entrenamientos", "/salidas", "/mensajes", "/progreso", "/objetivos", "/dispositivos", "/importar-actividad", "/seguimiento-trail", "/mis-cuotas", "/suscripciones", "/admin", "/deportistas", "/entrenador"].some(path => pathname === path || pathname.startsWith(path + "/"));
  const current = section(pathname);
  return <div className={showNavigation ? styles.withNavigation : undefined}>
    {(offline || restored) && <div className={styles.connection} role="status" aria-live="polite">
      <span>{offline ? "Sin conexión. Necesitas internet para cargar datos o guardar cambios." : "Conexión recuperada. Si una operación falló, vuelve a intentarla."}</span>
      {!offline && <button type="button" onClick={() => setRestored(false)} aria-label="Cerrar aviso de conexión">Cerrar</button>}
    </div>}
    {children}
    {showNavigation && <nav className={styles.navigation} aria-label="Navegación móvil">
      {links.map(link => <Link key={link.href} href={link.href} onNavigate={event => {
        if (pathname !== link.href && !window.dispatchEvent(new Event("nh:before-navigation", { cancelable: true }))) event.preventDefault();
      }} aria-current={current === link.href ? "page" : undefined} className={current === link.href ? styles.active : undefined}><Icon kind={link.icon} /><span>{link.label}</span></Link>)}
    </nav>}
  </div>;
}
