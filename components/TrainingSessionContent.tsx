import { categories, readStructure, stages } from "@/lib/training-builder";
import { videoLink } from "@/lib/training-video";
import s from "./training-builder.module.css";
export default function TrainingSessionContent({ title, category, structure, details }: { title: string; category: string; structure: unknown; details?: string | null }) {
  const plan = readStructure(structure);
  const t = plan?.targets;const isTrail=category==="trail";
  return <div>
    <p className={s.eyebrow}>{Object.hasOwn(categories,category) ? categories[category as keyof typeof categories] : category}</p>
    <h2 className={s.title}>{title || "Tu próxima sesión"}</h2>
    {t && <div className={s.pills}>{[[t.distance,"km"],[t.elevation,"m+"],[t.minutes,"min"],[t.effort,"/10 de esfuerzo"]].filter(([v])=>v).map(([v,unit])=><span className={s.pill} key={unit}>{v} {unit}</span>)}</div>}
    {(plan?.notes || (!plan && details)) && <p className={s.notes}>{plan ? plan.notes : details}</p>}
    {plan?.blocks.filter(b=>b.items.length>0).map(b=><details className={s.block} key={b.stage} open>
      <summary>{stages[b.stage]} · {b.items.length} {isTrail?(b.items.length===1?"tramo":"tramos"):(b.items.length===1 ? "ejercicio" : "ejercicios")}</summary>
      {b.items.map((i,n)=><section className={s.exercise} key={i.id} aria-label={i.name || `Ejercicio ${n+1}`}>
        <h4><span style={{color:"#ffad63"}}>{String(n+1).padStart(2,"0")}</span> · {i.name || "Nombre del ejercicio"}</h4>
        <div className={s.pills}>
          {i.sets && <span className={s.pill}>{i.sets} {isTrail?"repeticiones":"series"}</span>}{i.reps && <span className={s.pill}>{i.reps} {category==="fuerza" ? "rep." : "por serie"}</span>}
          {!isTrail && i.weight && <span className={s.pill}>{i.weight} kg</span>}{i.rest && <span className={s.pill}>Descanso {i.rest} s</span>}{i.duration && <span className={s.pill}>{i.duration}</span>}
        </div>
        {isTrail&&<div className={s.pills}>{i.trailDistance&&<span className={s.pill}>{i.trailDistance} km</span>}{i.trailElevation&&<span className={s.pill}>{i.trailElevation} m+</span>}{i.trailDescent&&<span className={s.pill}>{i.trailDescent} m−</span>}{i.trailTerrain&&<span className={s.pill}>{i.trailTerrain}</span>}{i.trailRecovery&&<span className={s.pill}>Recuperación: {i.trailRecovery}</span>}</div>}
        {i.videoUrl && videoLink(i.videoUrl) && <p><a className={`${s.button} ${s.secondary}`} href={videoLink(i.videoUrl)!} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">▶ Ver demostración</a></p>}
        {i.intensity && <p><strong>Intensidad:</strong> {i.intensity}</p>}{i.notes && <p className={s.notes}>{i.notes}</p>}
      </section>)}
    </details>)}
  </div>;
}
