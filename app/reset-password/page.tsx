"use client";
import {useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import {supabase} from "@/lib/supabase-browser";
const field={display:"block",width:"100%",boxSizing:"border-box" as const,padding:14,margin:"8px 0 20px",borderRadius:8,border:"1px solid #555",background:"#222",color:"white",fontSize:16};
export default function ResetPasswordPage(){
 const lock=useRef(false);
 const [password,setPassword]=useState(""),[confirmation,setConfirmation]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[done,setDone]=useState(false);
 async function save(e:FormEvent){e.preventDefault();if(lock.current)return;if(password.length<8||password!==confirmation){setMessage("Utiliza al menos 8 caracteres y repite la misma contraseña.");return}
 lock.current=true;setBusy(true);setMessage("");
 try{const {data,error:authError}=await supabase.auth.getUser();if(authError||!data.user){setMessage("El enlace ha caducado o no es válido. Solicita otro enlace de recuperación.");return}
 const {error}=await supabase.auth.updateUser({password});if(error){setMessage("No se pudo actualizar. Comprueba que la contraseña sea distinta de la anterior y cumpla los requisitos, o solicita un nuevo enlace.");return}setDone(true);setPassword("");setConfirmation("");setMessage("Contraseña actualizada correctamente.");
 }catch{setMessage("No se pudo confirmar el cambio. Comprueba tu conexión; si no puedes entrar, solicita otro enlace.")}finally{lock.current=false;setBusy(false)}}
 return <main style={{minHeight:"100vh",background:"#111",color:"white",padding:"40px 20px",fontFamily:"Arial,sans-serif"}}><div style={{maxWidth:500,margin:"auto"}}><p style={{color:"#ff8d27"}}>NH CLUB TRAIL RUNNING ALICANTE</p><h1>Nueva contraseña</h1>{!done&&<form onSubmit={save}><fieldset disabled={busy} style={{border:0,padding:0}}><label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} style={field}/></label><label>Repite la contraseña<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={e=>setConfirmation(e.target.value)} style={field}/></label><button type="submit" style={{...field,background:"#ff8d27",color:"#111",fontWeight:800}}>{busy?"Guardando…":"Cambiar contraseña"}</button></fieldset></form>}{message&&<p role={done?"status":"alert"}>{message}</p>}<p><Link href="/login" style={{color:"#ff8d27"}}>Ir al inicio de sesión</Link></p><p><Link href="/forgot-password" style={{color:"#ff8d27"}}>Solicitar otro enlace</Link></p></div></main>
}
