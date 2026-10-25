"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import styles from "./dashboard.module.css";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
type Training = { id:string; session_date:string; category:string; title:string; details:string; completed:boolean };
type PaymentAlert = {count:number;overdue:number;upcoming:number;amount:number};
type Outing = { id:string; title:string; starts_at:string; location:string|null; activity_type:string|null };
const fmt = (date:string, options?:Intl.DateTimeFormatOptions) => new Date(date).toLocaleDateString("es-ES",options ?? {day:"numeric",month:"short"});
const localDate = (d:Date) => [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
function weekBounds() { const start=new Date();start.setHours(12,0,0,0);start.setDate(start.getDate()-((start.getDay()+6)%7));const end=new Date(start);end.setDate(end.getDate()+7);return [localDate(start),localDate(end)]; }
export default function DashboardPage() {
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [name,setName]=useState("");
 const [email,setEmail]=useState("");
 const [role,setRole]=useState("");
 const [trainings,setTrainings]=useState<Training[]>([]);
 const [outings,setOutings]=useState<Outing[]>([]);
 const [registered,setRegistered]=useState<string[]>([]);
 const [menu,setMenu]=useState(false);
 const [paymentAlert,setPaymentAlert]=useState<PaymentAlert|null>(null);
 useEffect(()=>{let active=true;async function load(){
  try {
   const {data:auth,error:authError}=await supabase.auth.getUser();
   if(!active)return;
   if(authError||!auth.user){window.location.replace("/login");return;}
   const uid=auth.user.id;setEmail(auth.user.email??"");
   const [profile,plan,activities,registrations]=await Promise.all([
    supabase.from("profiles").select("full_name,role").eq("id",uid).single(),
    supabase.from("weekly_training_plan").select("id,session_date,category,title,details,completed").eq("athlete_id",uid).gte("session_date",weekBounds()[0]).lt("session_date",weekBounds()[1]).order("session_date"),
    supabase.from("club_activities").select("id,title,starts_at,location,activity_type").gte("starts_at",new Date().toISOString()).order("starts_at").limit(3),
    supabase.from("activity_registrations").select("activity_id").eq("user_id",uid)
   ]);
   if(!active)return;
   if(profile.error)throw profile.error;
   setName(profile.data?.full_name||auth.user.email?.split("@")[0]||"deportista");
   setRole(profile.data?.role||"athlete");
   setTrainings((plan.data??[]) as Training[]);
   setOutings((activities.data??[]) as Outing[]);
   setRegistered((registrations.data??[]).map(r=>r.activity_id));
   // Only the logged-in athlete's subscriptions and monthly dues are visible under RLS.
   const {data:subscriptions,error:subError}=await supabase.from("club_subscription_requests").select("id").eq("user_id",uid).eq("status","approved");
   if(active&&!subError){
    const ids=(subscriptions??[]).map(s=>s.id);
    if(ids.length){
     const {data:dues,error:dueError}=await supabase.from("club_subscription_monthly_dues").select("subscription_id,due_date,amount_eur,status").in("subscription_id",ids).in("status",["pending","overdue"]);
     if(active&&!dueError){
      const now=localDate(new Date());
      const upcoming=(dues??[]).filter(d=>{const days=Math.round((Date.parse(d.due_date+"T12:00:00Z")-Date.parse(now+"T12:00:00Z"))/86400000);return days>=0&&days<=7});
      const overdue=(dues??[]).filter(d=>d.status==="overdue"||d.due_date<now);
      const seen=new Map([...overdue,...upcoming].map(d=>[d.subscription_id+"-"+d.due_date,d]));
      setPaymentAlert({count:seen.size,overdue:overdue.length,upcoming:upcoming.filter(d=>!overdue.includes(d)).length,amount:[...seen.values()].reduce((sum,d)=>sum+Number(d.amount_eur),0)});
     }
    }else setPaymentAlert(null);
   }
   const failures=[plan.error,activities.error,registrations.error].filter(Boolean);
   if(failures.length)setError("Algunos datos no se pudieron cargar. Prueba a actualizar la página.");
  }catch{if(active)setError("No se pudo cargar el panel. Comprueba tu conexión e inténtalo de nuevo.");}
  finally{if(active)setLoading(false);}
 }void load();return()=>{active=false};},[]);
 async function logout(){const {error:e}=await supabase.auth.signOut();if(e)setError("No se pudo cerrar la sesión.");else window.location.replace("/login");}
 const completed=trainings.filter(s=>s.completed).length;
 const navigation=[{icon:"⌂",label:"Inicio",href:"/dashboard"},{icon:"◫",label:"Plan semanal",href:"/entrenamientos/plan"},{icon:"↗",label:"Entrenamientos",href:"/entrenamientos"},{icon:"△",label:"Salidas del club",href:"/salidas"},{icon:"▥",label:"Mi progreso",href:"/progreso"},{icon:"★",label:"PLUS / Performance",href:"/suscripciones"},{icon:"◷",label:"Mis cuotas y avisos",href:"/mis-cuotas"},...(role==="admin"?[{icon:"♙",label:"Deportistas",href:"/deportistas"},{icon:"▤",label:"Panel entrenador",href:"/entrenador/seguimiento"},{icon:"★",label:"Gestión PLUS",href:"/admin/suscripciones"},{icon:"⚙",label:"Administración",href:"/admin"}]:[])];
 return <main className={styles.shell}>
  <aside className={styles.sidebar}>
   <Link href="/dashboard" className={styles.brand}><span className={styles.brandMark}>NH<span>⌁</span></span><small>CLUB TRAIL RUNNING ALICANTE</small></Link>
   <nav className={styles.nav} aria-label="Navegación principal">{navigation.map((n,i)=><Link key={n.href} href={n.href} className={i===0?styles.active:""}><span aria-hidden="true">{n.icon}</span>{n.label}</Link>)}</nav>
   <div className={styles.sideBottom}><span className={styles.identity}>{email}</span><button onClick={logout} className={styles.logout}>⇥ &nbsp; Cerrar sesión</button></div>
  </aside>
  <section className={styles.content}>
   <header className={styles.hero}>
    <div className={styles.heroTop}><span className={styles.eyebrow}>NH / CLUB TRAIL RUNNING ALICANTE</span><button className={styles.mobileMenu} onClick={()=>setMenu(!menu)} aria-expanded={menu}>☰ Menú</button></div>
    {menu&&<div className={styles.mobileLinks}>{navigation.map(n=><Link key={n.href} href={n.href}>{n.label}</Link>)}<button onClick={logout}>Cerrar sesión</button></div>}
    <div className={styles.heroBody}><p>Bienvenido/a,</p><h1>{loading?"Cargando...":name}</h1><span>Disciplina hoy, montañas mañana.</span></div>
    <time className={styles.today}>{new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</time>
   </header>
   <div className={styles.inner}>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {paymentAlert&&paymentAlert.count>0&&<section role="status" style={{background:"#2a211b",border:"1px solid #f18b35",borderLeft:"5px solid #f18b35",borderRadius:12,padding:"17px 20px",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,flexWrap:"wrap"}}>
     <div><strong style={{color:"#ffae63",fontSize:18}}>◷ Avisos de cuotas PLUS ({paymentAlert.count})</strong><p style={{margin:"7px 0 0",color:"#e7d8ca"}}>{paymentAlert.overdue>0?paymentAlert.overdue+" vencida(s) · ":""}{paymentAlert.upcoming>0?paymentAlert.upcoming+" próxima(s) a vencer · ":""}{paymentAlert.amount.toLocaleString("es-ES",{style:"currency",currency:"EUR"})} en cuotas registradas con aviso</p></div>
     <Link href="/mis-cuotas" style={{background:"#ff922f",color:"#111",fontWeight:800,textDecoration:"none",padding:"11px 15px",borderRadius:9}}>Consultar mis cuotas →</Link>
    </section>}
    <div className={styles.stats}>
     <div className={styles.stat}><span className={styles.statIcon}>♢</span><div><small>Sesiones esta semana</small><strong>{loading?"—":trainings.length}</strong><span>Planificadas</span></div></div>
     <div className={styles.stat}><span className={styles.statIcon}>✓</span><div><small>Sesiones completadas</small><strong>{loading?"—":completed+" / "+trainings.length}</strong><span>{trainings.length?Math.round(completed/trainings.length*100)+"% del plan":"Sin sesiones aún"}</span></div></div>
     <div className={styles.stat}><span className={styles.statIcon}>△</span><div><small>Próximas salidas</small><strong>{loading?"—":outings.length}</strong><span>Disponibles en el club</span></div></div>
     <div className={styles.stat}><span className={styles.statIcon}>↗</span><div><small>Mis inscripciones</small><strong>{loading?"—":outings.filter(o=>registered.includes(o.id)).length}</strong><span>Entre las próximas salidas</span></div></div>
    </div>
    <div className={styles.columns}>
     <section className={styles.panel}><div className={styles.panelHeading}><h2><span>▣</span> Plan semanal</h2><Link href="/entrenamientos/plan">Ver semana completa →</Link></div>
      {loading?<p className={styles.muted}>Cargando entrenamientos...</p>:trainings.length?trainings.map(s=><div key={s.id} className={styles.training}><div className={styles.dateTile}><small>{fmt(s.session_date+"T12:00:00",{weekday:"short"}).toUpperCase()}</small><strong>{s.session_date.slice(-2)}</strong></div><div className={styles.trainingText}><strong>{s.title}</strong><span>{s.category.toUpperCase()}{s.details?" · "+s.details:""}</span></div><span className={s.completed?styles.done:styles.pending} aria-label={s.completed?"Completada":"Pendiente"}>{s.completed?"✓":"○"}</span></div>):<div className={styles.empty}>Todavía no tienes sesiones programadas esta semana.<p><Link href="/entrenamientos/plan">Consultar planificación →</Link></p></div>}
     </section>
     <section className={styles.panel}><div className={styles.panelHeading}><h2><span>△</span> Próximas salidas</h2><Link href="/salidas">Ver todas →</Link></div>
      {loading?<p className={styles.muted}>Cargando salidas...</p>:outings.length?outings.map(o=><div key={o.id} className={styles.outing}><div className={styles.outingIcon}>⛰</div><div className={styles.outingText}><strong>{o.title}</strong><span>{fmt(o.starts_at,{day:"numeric",month:"long",year:"numeric"})}</span><small>{o.location||"Lugar por confirmar"}</small></div><Link href="/salidas" className={styles.outingAction}>{registered.includes(o.id)?"Inscrito ✓":"Ver detalles"}</Link></div>):<div className={styles.empty}>No hay salidas próximas publicadas.<p><Link href="/salidas">Consultar salidas →</Link></p></div>}
     </section>
    </div>
    <div className={styles.bottomColumns}>
     <section className={styles.panel}><div className={styles.panelHeading}><h2><span>▥</span> Mi progreso</h2><Link href="/progreso">Ver progreso →</Link></div><div className={styles.progress}><div><small>Sesiones completadas esta semana</small><strong>{completed} <span>de {trainings.length}</span></strong><div className={styles.track}><div style={{width:(trainings.length?completed/trainings.length*100:0)+"%"}}/></div></div><div><small>Sesiones pendientes</small><strong>{trainings.length-completed}</strong><p>Datos de tu planificación real</p></div></div></section>
     <section className={styles.panel}><div className={styles.panelHeading}><h2>Accesos rápidos</h2></div><div className={styles.quick}>{navigation.filter(n=>n.href!=="/dashboard").slice(0,6).map(n=><Link href={n.href} key={n.href}><span>{n.icon}</span>{n.label}</Link>)}</div></section>
    </div>
    <footer className={styles.footer}>NH TRAINING CONCEPT · Tu meta, mi desafío</footer>
   </div>
  </section>
 </main>;
}
