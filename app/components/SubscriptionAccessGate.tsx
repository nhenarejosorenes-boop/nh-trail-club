"use client";
import {useEffect,useState,type ReactNode} from "react";
import Link from "next/link";
import {createClient} from "@supabase/supabase-js";
const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
type Status="checking"|"active"|"admin"|"pending"|"unpaid"|"none"|"error";
function currentMonth(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-01"}
export default function SubscriptionAccessGate({children}:{children:ReactNode}){
 const [status,setStatus]=useState<Status>("checking");
 useEffect(()=>{let mounted=true;(async()=>{try{
 const {data:a,error:ae}=await supabase.auth.getUser();if(ae||!a.user){if(mounted)setStatus("none");return}
 const {data:profile,error:pe}=await supabase.from("profiles").select("role").eq("id",a.user.id).single();if(pe)throw pe;
 if(profile?.role==="admin"){if(mounted)setStatus("admin");return}
 const {data:requests,error:re}=await supabase.from("club_subscription_requests").select("id,status").eq("user_id",a.user.id).in("status",["approved","pending"]).order("created_at",{ascending:false});if(re)throw re;
 const approved=(requests??[]).find(r=>r.status==="approved");
 if(!approved){if(mounted)setStatus((requests??[]).some(r=>r.status==="pending")?"pending":"none");return}
 const {data:dues,error:de}=await supabase.from("club_subscription_monthly_dues").select("id").eq("subscription_id",approved.id).eq("period_month",currentMonth()).eq("status","paid").limit(1);if(de)throw de;
 if(mounted)setStatus((dues??[]).length?"active":"unpaid");
 }catch{if(mounted)setStatus("error")}})();return()=>{mounted=false}},[]);
 if(status==="active"||status==="admin")return <>{children}</>;
 const text=status==="checking"?"Comprobando tu suscripción...":status==="pending"?"Tu solicitud está pendiente de aprobación.":status==="unpaid"?"La cuota del mes actual todavía no figura como pagada. Si ya has abonado la cuota, contacta con el club.":status==="none"?"Necesitas una suscripción aprobada y la cuota mensual confirmada para acceder a las funciones deportivas.":"No se pudo verificar tu suscripción. Inténtalo de nuevo.";
 return <main style={{minHeight:"100vh",background:"#101113",color:"#fff",padding:"65px 20px",fontFamily:"Arial,sans-serif"}}><section style={{maxWidth:600,margin:"auto",background:"#222427",border:"1px solid #ff922f",borderRadius:15,padding:30}}><p style={{color:"#ff922f",fontWeight:800}}>NH / CLUB TRAIL RUNNING ALICANTE</p><h1>{status==="checking"?"Verificando acceso":"Acceso a servicios deportivos"}</h1><p style={{lineHeight:1.7,color:"#ddd"}}>{text}</p>{status!=="checking"&&<div style={{display:"flex",gap:18,flexWrap:"wrap"}}><Link href="/suscripciones" style={{color:"#ff922f"}}>Elegir modalidad</Link><Link href="/mis-cuotas" style={{color:"#ff922f"}}>Mis cuotas</Link><button onClick={()=>window.location.reload()} style={{background:"#ff922f",border:0,borderRadius:8,padding:"8px 12px",fontWeight:700}}>Volver a comprobar</button></div>}</section></main>;
}
