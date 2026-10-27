import Link from "next/link";
import styles from "./recovery.module.css";

export default function NotFound() {
  return <main className={styles.page}><section className={styles.panel} aria-labelledby="missing-title">
    <span className={styles.brand}>NH Club Trail Running Alicante</span>
    <h1 id="missing-title">Esta página no está disponible</h1>
    <p>Puede que el enlace haya cambiado. Puedes continuar desde tu panel o acceder a tu cuenta.</p>
    <div className={styles.actions}><Link href="/dashboard">Ir a mi panel</Link><Link className={styles.secondary} href="/login">Iniciar sesión</Link></div>
  </section></main>;
}
