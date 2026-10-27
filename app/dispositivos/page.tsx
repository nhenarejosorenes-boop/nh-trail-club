"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { IMPORT_PAGE_SIZE, loadDeviceImports, type DeviceImport } from '@/lib/device-history';
import styles from '@/components/athlete-panels.module.css';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
const date = (value: string) => new Date(value).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'medium', timeStyle: 'short' });

export default function Devices() {
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);
  const [history, setHistory] = useState<{ entries: DeviceImport[]; hasMore: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setHistory(null);
    (async () => {
      try {
        const auth = await supabase.auth.getUser();
        if (!active) return;
        if (auth.error || !auth.data.user) { window.location.replace('/login'); return; }
        const result = await loadDeviceImports(supabase, auth.data.user.id, offset);
        if (active) setHistory(result);
      } catch {
        if (active) setError('No se pudo cargar tu historial de importaciones. Reintenta para comprobarlo.');
      } finally { if (active) setLoading(false); }
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { active = false; setHistory(null); window.location.replace('/login'); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [offset, reload]);
  function refresh() { setHistory(null); setLoading(true); setOffset(0); setReload(n => n + 1); }
  function page(next: number) { setHistory(null); setLoading(true); setOffset(next); }
  return <main className={styles.page}><div className={styles.inner}>
    <p className={styles.brand}>NH TRAINING CONCEPT</p>
    <Link className={styles.back} href="/entrenamientos">← Mis entrenamientos</Link>
    <h1>Mis dispositivos</h1>
    <p className={styles.intro}>Lleva las actividades de tu reloj al seguimiento de NH Trail Club.</p>
    <nav className={styles.nav}><Link className={styles.link} href="/importar-actividad">Importar actividad</Link><Link className={styles.link} href="/seguimiento-trail">Mis salidas</Link></nav>
    <div className={styles.cards}>
      <section className={styles.panel}><span className={styles.badge}>Disponible</span><h2>Importación desde archivo</h2>
        <p className={styles.intro}>Archivos FIT, TCX y GPX de carrera o senderismo, de hasta 20 MB. Revisa distancia, desnivel y duración antes de confirmar.</p>
        <Link className={styles.link} href="/importar-actividad">Añadir una actividad →</Link>
      </section>
      <section className={styles.panel}><span className={styles.badge}>Todavía no disponible</span><h2>Sincronización con Garmin</h2>
        <p className={styles.intro}>El club está preparando la integración. Cuando esté disponible, podrás autorizar la conexión de tu cuenta Garmin y recibir tus nuevas actividades automáticamente.</p>
        <p className={styles.note}>Mientras tanto, puedes importar los archivos de tus actividades.</p>
      </section>
      <section className={styles.panel}><span className={styles.badge}>Próxima fase</span><h2>Entrenamientos en tu reloj</h2>
        <p className={styles.intro}>El envío de las sesiones del plan al dispositivo estará disponible después de activar y validar la integración con Garmin.</p>
        <Link className={styles.link} href="/entrenamientos/trail">Consultar mi plan de trail →</Link>
      </section>
    </div>
    <section className={styles.panel}><h2>Cómo importar desde Garmin Connect</h2>
      <ol className={styles.intro}><li>Abre la actividad realizada en la versión web de Garmin Connect y busca la opción de exportación.</li><li>Descarga el archivo original. Si recibes un ZIP, descomprímelo para obtener el FIT.</li><li>Selecciona el archivo en «Importar actividad», revisa los datos y confirma el guardado.</li></ol>
      <p className={styles.note}>Guardamos el resumen que confirmas. El archivo y su recorrido GPS se procesan en tu navegador. El esfuerzo percibido lo indicas tú y vincular una salida no marca automáticamente una sesión como completada.</p>
    </section>
    <section className={styles.panel} aria-labelledby="imports-heading" aria-busy={loading}>
      <div className={styles.row}><h2 id="imports-heading">Historial de importaciones</h2><button className={styles.field} type="button" disabled={loading} onClick={refresh}>Actualizar historial</button></div>
      <p className={styles.note}>Ordenado por fecha de guardado, con tus datos actuales. Las salidas registradas a mano aparecen en «Mis salidas».</p>
      {loading && <p role="status">Cargando importaciones…</p>}
      {error && <p className={styles.error} role="alert">{error} <button className={styles.field} type="button" onClick={refresh}>Reintentar</button></p>}
      {!loading && history && <>
        {history.entries.length === 0 ? <p className={styles.intro}>{offset === 0 ? 'Todavía no has importado ninguna actividad.' : 'No hay más importaciones. Actualiza el historial para volver al inicio.'}</p> : <div className={styles.scroll}><table className={styles.table}>
          <caption>Actividades importadas · página {offset / IMPORT_PAGE_SIZE + 1}</caption>
          <thead><tr><th scope="col">Salida</th><th scope="col">Resumen</th><th scope="col">Origen</th><th scope="col">Guardada</th></tr></thead>
          <tbody>{history.entries.map(entry => <tr key={entry.id}>
            <td>{new Date(entry.activity_date + 'T12:00:00Z').toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })}</td>
            <td>{Number(entry.distance_km).toLocaleString('es-ES', { maximumFractionDigits: 2 })} km · {entry.elevation_m} m+ · {entry.duration_minutes} min{entry.linked_session_id && <p className={styles.note}>Vinculada al plan</p>}</td>
            <td>Archivo {entry.file_format.toUpperCase()}</td><td>{date(entry.created_at)}</td>
          </tr>)}</tbody>
        </table></div>}
        <nav className={styles.nav} aria-label="Páginas de importaciones"><button className={styles.field} type="button" disabled={offset === 0} onClick={() => page(Math.max(0, offset - IMPORT_PAGE_SIZE))}>Anterior</button><button className={styles.field} type="button" disabled={!history.hasMore} onClick={() => page(offset + IMPORT_PAGE_SIZE)}>Siguiente</button></nav>
      </>}
    </section>
  </div></main>;
}
