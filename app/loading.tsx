import styles from "./recovery.module.css";

export default function Loading() {
  return <main className={styles.page}><section className={styles.panel} role="status" aria-live="polite"><span className={styles.brand}>NH Club Trail Running Alicante</span><h1>Cargando tu pantalla…</h1><p>Estamos preparando el contenido.</p></section></main>;
}
