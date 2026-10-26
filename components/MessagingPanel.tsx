"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { loadInbox, loadMessagePage, loadMessageUpdates } from "@/lib/messaging-client";
import { initialConversation, mergeMessages, messageBody, totalUnread, type ClubMessage, type Conversation } from "@/lib/messaging-model";
import styles from "./messaging.module.css";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
type TrainingContext = { id: string; title: string; session_date: string };
const stamp = (value: string) => new Date(value).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function MessagingPanel() {
  const [uid, setUid] = useState("");
  const [admin, setAdmin] = useState(false);
  const [inbox, setInbox] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState("");
  const selectedRef = useRef(""); selectedRef.current = selected;
  const [messages, setMessages] = useState<ClubMessage[]>([]);
  const messagesRef = useRef<ClubMessage[]>([]);
  const [loaded, setLoaded] = useState("");
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [threadError, setThreadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [receiptError, setReceiptError] = useState(false);
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [context, setContext] = useState<TrainingContext | null>(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const attempts = useRef<Record<string, { id: string; body: string; training: string | null }>>({});
  const [olderAvailable, setOlderAvailable] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const [retry, setRetry] = useState(0);
  const scrollBox = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const preserveScroll = useRef<{ height: number; top: number } | null>(null);
  const lastMarked = useRef<Record<string, number>>({});
  const threadEpoch = useRef(0);
  const ready = Boolean(selected && loaded === selected && !loading);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        messagesRef.current = []; setMessages([]); setInbox([]); setDrafts({}); setContext(null);
        window.location.replace("/login");
      } else if (event === "SIGNED_IN" && uid && session?.user.id !== uid) {
        window.location.reload();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [uid]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const auth = await supabase.auth.getUser();
        if (!active) return;
        if (auth.error || !auth.data.user) { window.location.replace("/login"); return; }
        const userId = auth.data.user.id;
        const [profile, conversations] = await Promise.all([
          supabase.from("profiles").select("role").eq("id", userId).single(), loadInbox(supabase),
        ]);
        if (profile.error) throw profile.error;
        if (!active) return;
        const isAdmin = profile.data?.role === "admin";
        const params = new URLSearchParams(window.location.search);
        const athlete = initialConversation(conversations, params.get("athlete"), userId, isAdmin);
        setUid(userId); setAdmin(isAdmin); setInbox(conversations); setSelected(athlete);
        const trainingId = params.get("training");
        if (athlete && trainingId && /^[0-9a-f-]{36}$/i.test(trainingId)) {
          const training = await supabase.from("weekly_training_plan").select("id,title,session_date").eq("id", trainingId).eq("athlete_id", athlete).maybeSingle();
          if (active) {
            if (training.error || !training.data) setSendError("No se pudo asociar la sesión. Puedes escribir un mensaje sin esa referencia.");
            else setContext(training.data as TrainingContext);
          }
        }
      } catch { if (active) setError("No se pudo abrir la mensajería. Comprueba la conexión y vuelve a cargar la página."); }
      finally { if (active) setChecking(false); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!uid) return;
    let active = true, running = false;
    async function updateInbox() {
      if (document.visibilityState !== "visible" || running) return;
      running = true;
      try { const data = await loadInbox(supabase); if (active) { setInbox(data); setError(""); } }
      catch { if (active) setError("No se pudo actualizar la bandeja. Se reintentará automáticamente."); }
      finally { running = false; }
    }
    const timer = window.setInterval(() => void updateInbox(), 8000);
    window.addEventListener("focus", updateInbox); document.addEventListener("visibilitychange", updateInbox);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", updateInbox); document.removeEventListener("visibilitychange", updateInbox); };
  }, [uid]);

  useEffect(() => {
    if (!selected) return;
    threadEpoch.current += 1;
    let active = true, running = false, initialized = false;
    setLoading(true); setThreadError(""); setMessages([]); messagesRef.current = [];
    setLoaded(""); atBottom.current = true; preserveScroll.current = null; setHasNew(false); setReceiptError(false); setLoadingOlder(false);
    async function update() {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try {
        const rows = initialized ? await loadMessageUpdates(supabase, selected, messagesRef.current.at(-1)?.seq ?? 0) : await loadMessagePage(supabase, selected);
        if (!active) return;
        if (!initialized) { setOlderAvailable(rows.length === 50); initialized = true; }
        else if (rows.length && !atBottom.current) setHasNew(true);
        const next = mergeMessages(messagesRef.current, rows); messagesRef.current = next;
        setMessages(next); setLoaded(selected); setThreadError(""); setLoading(false);
      } catch { if (active) { setThreadError("No se pudo actualizar la conversación. Puedes reintentar; tus borradores se conservan."); setLoading(false); } }
      finally { running = false; }
    }
    void update(); const timer = window.setInterval(() => void update(), 8000);
    window.addEventListener("focus", update); document.addEventListener("visibilitychange", update);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, [selected, retry]);

  useEffect(() => {
    const box = scrollBox.current;
    if (!box) return;
    if (preserveScroll.current) {
      box.scrollTop = preserveScroll.current.top + box.scrollHeight - preserveScroll.current.height;
      preserveScroll.current = null;
    } else if (atBottom.current) box.scrollTop = box.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    async function markVisible() {
      const seq = messagesRef.current.at(-1)?.seq;
      if (!seq || document.visibilityState !== "visible" || !document.hasFocus() || !atBottom.current || seq <= (lastMarked.current[selected] ?? 0)) return;
      try {
        const result = await supabase.rpc("messaging_mark_read", { p_athlete: selected, p_seq: seq });
        if (!active) return;
        if (result.error) { setReceiptError(true); return; }
        lastMarked.current[selected] = seq; setReceiptError(false);
        try { const data = await loadInbox(supabase); if (active) setInbox(data); } catch { /* The next inbox poll retries independently. */ }
      } catch { if (active) setReceiptError(true); }
    }
    void markVisible(); const box = scrollBox.current;
    box?.addEventListener("scroll", markVisible); window.addEventListener("focus", markVisible); document.addEventListener("visibilitychange", markVisible);
    return () => { active = false; box?.removeEventListener("scroll", markVisible); window.removeEventListener("focus", markVisible); document.removeEventListener("visibilitychange", markVisible); };
  }, [messages, selected, ready]);

  function choose(athlete: string) {
    if (sendingRef.current || athlete === selected) return;
    setSelected(athlete); setContext(null); setSendError(""); setLoading(true);
  }
  async function older() {
    const athlete = selected, before = messagesRef.current[0]?.seq, box = scrollBox.current;
    const epoch = threadEpoch.current;
    if (!ready || loadingOlder || !before) return;
    setLoadingOlder(true);
    const position = box ? { height: box.scrollHeight, top: box.scrollTop } : null;
    try {
      const rows = await loadMessagePage(supabase, athlete, before);
      if (selectedRef.current !== athlete || threadEpoch.current !== epoch) return;
      atBottom.current = false; preserveScroll.current = position;
      const next = mergeMessages(messagesRef.current, rows); messagesRef.current = next; setMessages(next);
      setOlderAvailable(rows.length === 50); setThreadError("");
    } catch { if (selectedRef.current === athlete && threadEpoch.current === epoch) setThreadError("No se pudieron cargar los mensajes anteriores."); }
    finally { if (selectedRef.current === athlete && threadEpoch.current === epoch) setLoadingOlder(false); }
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || sendingRef.current) return;
    let body: string;
    try { body = messageBody(drafts[selected] ?? ""); }
    catch (e) { setSendError(e instanceof Error ? e.message : "Revisa el mensaje."); return; }
    const athlete = selected, training = context?.id ?? null;
    let attempt = attempts.current[athlete];
    if (!attempt || attempt.body !== body || attempt.training !== training) {
      attempt = { id: crypto.randomUUID(), body, training }; attempts.current[athlete] = attempt;
    }
    sendingRef.current = true; setSending(true); setSendError("");
    try {
      const { data, error: sendFailure } = await supabase.rpc("messaging_send", { p_athlete: athlete, p_id: attempt.id, p_body: body, p_training: training });
      if (sendFailure || !data) throw sendFailure ?? new Error("No confirmation");
      setDrafts(previous => ({ ...previous, [athlete]: "" })); delete attempts.current[athlete]; setContext(null);
      if (selectedRef.current === athlete) {
        // Do not advance the update cursor past incoming replies that raced with this send.
        const updates = await loadMessageUpdates(supabase, athlete, messagesRef.current.at(-1)?.seq ?? 0);
        if (selectedRef.current === athlete) {
          atBottom.current = true; setHasNew(false);
          const next = mergeMessages(messagesRef.current, updates); messagesRef.current = next; setMessages(next);
        }
      }
      try { setInbox(await loadInbox(supabase)); } catch { setError("Mensaje guardado. No se pudo actualizar la bandeja todavía."); }
    } catch {
      if (attempts.current[athlete]) setSendError("No se pudo confirmar el envío. Tu texto se conserva; reintentar el mismo mensaje no lo duplicará.");
      else setThreadError("El mensaje se guardó, pero no se pudo actualizar el historial. Pulsa Actualizar conversación.");
    } finally { sendingRef.current = false; setSending(false); }
  }
  const conversation = inbox.find(c => c.athlete_id === selected);
  const filtered = inbox.filter(c => c.name.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
  const title = admin ? conversation?.name ?? "Selecciona un deportista" : "Mi entrenador";
  return <main className={styles.page}><div className={styles.inner}>
    <p className={styles.brand}>NH TRAINING CONCEPT</p><nav className={styles.nav}><Link href="/dashboard">← Mi panel</Link><Link href="/entrenamientos">Entrenamientos</Link>{admin && <Link href="/entrenador/seguimiento">Panel del entrenador</Link>}</nav>
    <h1>{admin ? "Mensajes de deportistas" : "Mi entrenador"}</h1><p className={styles.note}>Conversación privada con el equipo entrenador del club. La bandeja se actualiza cada pocos segundos mientras la app está abierta.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {checking ? <p role="status">Abriendo mensajería...</p> : !uid ? <button onClick={() => window.location.reload()}>Volver a intentar</button> : <div className={admin ? styles.layout : styles.single}>
      {admin && <aside className={styles.inbox} aria-label="Conversaciones"><h2>Bandeja · {totalUnread(inbox)} sin leer</h2><label>Buscar deportista<input value={search} onChange={e => setSearch(e.target.value)} type="search" /></label>
        {!filtered.length && <p>No hay deportistas para mostrar.</p>}{filtered.map(c => <button key={c.athlete_id} className={selected === c.athlete_id ? styles.selected : styles.thread} disabled={sending} onClick={() => choose(c.athlete_id)} aria-pressed={selected === c.athlete_id}><strong>{c.name}</strong>{c.unread > 0 && <span className={styles.badge}>{c.unread} sin leer</span>}<span>{c.preview ?? "Iniciar conversación"}</span>{drafts[c.athlete_id] && <small>Borrador guardado en esta página</small>}</button>)}
      </aside>}
      <section className={styles.conversation} aria-label={"Conversación: " + title}><header className={styles.header}><h2>{title}</h2><button disabled={sending || loading} onClick={() => setRetry(n => n + 1)}>Actualizar conversación</button></header>
        {threadError && <p role="alert" className={styles.error}>{threadError}</p>}
        {receiptError && <p className={styles.note}>No se pudo actualizar el aviso de lectura. Se reintentará automáticamente.</p>}
        {!selected ? <p>Elige una conversación de la bandeja.</p> : !ready ? <p role="status">{threadError ? "No hay historial cargado." : "Cargando conversación..."}</p> : <>
          <div ref={scrollBox} className={styles.messages} onScroll={event => { const box = event.currentTarget; atBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80; if (atBottom.current) setHasNew(false); }}>
            {olderAvailable && <button className={styles.older} disabled={loadingOlder} onClick={() => void older()}>{loadingOlder ? "Cargando..." : "Ver mensajes anteriores"}</button>}
            {!messages.length && <p className={styles.note}>Todavía no hay mensajes. Escribe para iniciar la conversación.</p>}
            {messages.map(message => <article key={message.id} className={message.sender_id === uid ? styles.mine : styles.theirs}>
              <strong>{message.sender_id === uid ? "Tú" : message.sender_id === selected ? conversation?.name ?? "Deportista" : "Entrenador"}</strong>
              {message.training_title && <div className={styles.context}>Sobre: {message.training_title}{message.training_date ? " · " + message.training_date : ""}</div>}
              <p>{message.body}</p><time dateTime={message.created_at}>{stamp(message.created_at)}</time>
            </article>)}
          </div>
          {hasNew && <button className={styles.older} onClick={() => { atBottom.current = true; scrollBox.current?.scrollTo({ top: scrollBox.current.scrollHeight, behavior: "smooth" }); setHasNew(false); }}>Hay mensajes nuevos · Ir al final ↓</button>}
          <form className={styles.compose} onSubmit={send}><fieldset disabled={sending}>
            {context && <div className={styles.context}>Consulta sobre: {context.title} · {context.session_date}<button type="button" onClick={() => setContext(null)}>Quitar referencia</button></div>}
            <label htmlFor="club-message">Escribe tu mensaje</label><textarea id="club-message" rows={3} maxLength={2000} value={drafts[selected] ?? ""} onChange={e => setDrafts(previous => ({ ...previous, [selected]: e.target.value }))} placeholder="Dudas sobre el entrenamiento, sensaciones o consultas al club..." required />
            <div className={styles.actions}><small>{(drafts[selected] ?? "").length}/2000</small><button className={styles.send} disabled={!(drafts[selected] ?? "").trim()}>{sending ? "Enviando..." : "Enviar mensaje"}</button></div>
          </fieldset>{sendError && <p role="alert" className={styles.error}>{sendError}</p>}</form>
        </>}
      </section>
    </div>}
  </div></main>;
}
