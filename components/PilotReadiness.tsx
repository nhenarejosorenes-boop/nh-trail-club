import Link from 'next/link';
import { pilotLabels, type PilotReadiness as Readiness } from '@/lib/pilot-readiness';
import styles from './athlete-panels.module.css';

const checks = [
  { title: 'Entrar desde el móvil', basic: 'Acceder con la cuenta del corredor y abrir su panel.', premium: 'Acceder con la cuenta del corredor y abrir su panel.' },
  { title: 'Salidas del club', basic: 'Ver una salida, apuntarse y cancelar la inscripción.', premium: 'Ver una salida, apuntarse y cancelar la inscripción.' },
  { title: 'Planificación individual', basic: 'Comprobar que se ofrece el cambio de modalidad y se bloquean los planes individuales.', premium: 'Abrir fuerza y trail propios, registrar sensaciones y completar una sesión.' },
  { title: 'Actividad realizada', basic: 'Importar un archivo real, revisar los datos y comprobar el historial propio.', premium: 'Importar un archivo real, vincularlo a una sesión propia y revisar la comparación con el plan.' },
  { title: 'Mensajes', basic: 'Enviar una consulta al entrenador y comprobar la respuesta.', premium: 'Enviar una consulta al entrenador y comprobar la respuesta.' },
  { title: 'Cuotas y privacidad', basic: 'Ver la cuota propia del mes y comprobar que no se muestran datos de otro corredor.', premium: 'Ver la cuota propia del mes y comprobar que no se muestran datos de otro corredor.' },
];
export default function PilotReadiness({ data }: { data: Readiness }) {
  const period = new Date(data.period+'T12:00:00Z').toLocaleDateString('es-ES',{month:'long',year:'numeric',timeZone:'Europe/Madrid'});
  return <>
    <p className={styles.note}>Cuota de {period}. Consulta iniciada el {new Date(data.checkedAt).toLocaleString('es-ES',{timeZone:'Europe/Madrid'})} (hora de Madrid).</p>
    <div className={styles.cards}>{data.groups.map(group => <section key={group.plan} className={styles.panel} aria-label={pilotLabels[group.plan]}>
      <span className={styles.badge}>Piloto pendiente</span><h2>{pilotLabels[group.plan]}</h2>
      <p><strong>{group.linked}</strong> cuenta(s) con ficha vinculada y cuota pagada.</p>
      <p className={styles.done}><strong>{data.testGroups?.find(test=>test.plan===group.plan)?.linked ?? 0}</strong> cuenta(s) de prueba con ficha y acceso temporal.</p>
      <p className={styles.note}>{group.active} cuenta(s) con esta modalidad activa; {group.missingCard} sin ficha vinculada.</p>
      <p className={styles.intro}>{data.testGroups?.some(test=>test.plan===group.plan&&test.linked>0) ? 'Cuenta de prueba preparada para recorrer esta modalidad.' : group.linked ? 'Revisar una cuenta y acordar su participación con el corredor.' : 'Revisar las fichas, la aprobación y la cuota del mes antes de elegir participante.'}</p>
    </section>)}</div>
    <section className={styles.panel}><h2>Pendientes de preparación</h2>
      <div className={styles.stats}><div className={styles.stat}><p>Fichas sin cuenta</p><strong>{data.unlinkedCards}</strong></div><div className={styles.stat}><p>Cuentas aprobadas sin cuota válida del mes</p><strong>{data.unpaidAccounts}</strong></div><div className={styles.stat}><p>Cuentas con solicitud pendiente</p><strong>{data.pendingAccounts}</strong></div></div>
      <nav className={styles.nav} aria-label="Resolver preparación del piloto"><Link className={styles.link} href="/deportistas">Revisar fichas y vinculación</Link><Link className={styles.link} href="/admin/suscripciones">Revisar aprobaciones</Link><Link className={styles.link} href="/admin/suscripciones/historial">Revisar cuotas del mes</Link></nav>
      <p className={styles.note}>Cada cuenta activa se cuenta una vez, en su modalidad pagada de mayor nivel. Los datos de ficha y cuota orientan la selección; la identidad y la disponibilidad del corredor deben comprobarse antes del piloto.</p>
    </section>
    <section className={styles.panel}><h2>Recorrido que falta comprobar</h2><p className={styles.intro}>{data.testGroups?.some(group=>group.active>0) ? 'Usa las cuentas de prueba preparadas para recorrer las tres modalidades. La validación posterior con corredores reales sigue pendiente.' : 'Los tres pilotos siguen pendientes de ejecución con un corredor real. Usa esta guía con la cuenta de cada participante y anota cualquier incidencia para corregirla.'}</p>
      <div className={styles.scroll}><table className={styles.table}><caption>Comprobaciones pendientes por modalidad</caption><thead><tr><th scope="col">Paso</th><th scope="col">Básica</th><th scope="col">PLUS y PLUS Performance</th></tr></thead><tbody>{checks.map(check => <tr key={check.title}><th scope="row">{check.title}</th><td>{check.basic}</td><td>{check.premium}</td></tr>)}</tbody></table></div>
      <p className={styles.note}>En cada modalidad, comprueba el recorrido completo en Android o iPhone. El resultado del piloto queda pendiente hasta verificarlo con el corredor.</p>
    </section>
  </>;
}
