"use client";
import Link from "next/link";
import { coachLinks } from "@/lib/staff-access";
import styles from "./athlete-panels.module.css";

export default function CoachHome({ name, logout }: { name: string; logout: () => void }) {
  return <main className={styles.page}><div className={styles.inner}>
    <p className={styles.brand}>NH CLUB TRAIL RUNNING ALICANTE · ENTRENADOR</p>
    <h1>Hola, {name}</h1>
    <p className={styles.intro}>Programa los entrenamientos de fuerza y trail y revisa la evolución de los deportistas del club.</p>
    <div className={styles.cards}>{coachLinks.map(link => <Link key={link.href} href={link.href} className={styles.card}>
      <h2>{link.title}</h2><p>{link.text}</p><span className={styles.badge}>Abrir →</span>
    </Link>)}</div>
    <p><button type="button" onClick={logout}>Cerrar sesión</button></p>
  </div></main>;
}
