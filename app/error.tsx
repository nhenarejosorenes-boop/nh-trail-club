"use client";

import Link from "next/link";
import styles from "./recovery.module.css";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className={styles.page}><section className={styles.panel} aria-labelledby="error-title">
    <span className={styles.brand}>NH Club Trail Running Alicante</span>
    <h1 id="error-title">No se ha podido abrir esta pantalla</h1>
    <p role="alert">Comprueba tu conexión y vuelve a intentarlo. Si el problema continúa, regresa al panel.</p>
    <div className={styles.actions}><button type="button" onClick={reset}>Volver a intentar</button><Link className={styles.secondary} href="/dashboard">Ir a mi panel</Link></div>
  </section></main>;
}
