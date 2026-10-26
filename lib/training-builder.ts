export const categories = { fuerza: "Fuerza", trail: "Trail", movilidad: "Movilidad", descanso: "Descanso" } as const;
export type Category = keyof typeof categories;
export const stages = { warmup: "Calentamiento", main: "Parte principal", cooldown: "Vuelta a la calma" } as const;
export type Stage = keyof typeof stages;
export type Exercise = { id: string; name: string; sets: string; reps: string; weight: string; rest: string; duration: string; intensity: string; notes: string };
export type Structure = { version: 1; notes: string; targets: { distance: string; elevation: string; minutes: string; effort: string }; blocks: { stage: Stage; items: Exercise[] }[] };
export type TrainingDraft = { category: Category; title: string; structure: Structure };
export type TrainingSession = { id: string; athlete_id: string; session_date: string; category: string; title: string; details: string | null; completed: boolean; structure: unknown };
export type TrainingTemplate = { id: string; name: string; category: Category; title: string; structure: unknown };
const limits = { id: 80, name: 120, sets: 4, reps: 40, weight: 20, rest: 10, duration: 60, intensity: 80, notes: 1000 } as const;
export const exerciseFields = Object.keys(limits) as (keyof Exercise)[];
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export function emptyStructure(): Structure {
  return { version: 1, notes: "", targets: { distance: "", elevation: "", minutes: "", effort: "" }, blocks: (Object.keys(stages) as Stage[]).map(stage => ({ stage, items: [] })) };
}
export function emptyDraft(category: Category = "trail"): TrainingDraft { return { title: "", category, structure: emptyStructure() }; }
export function newExercise(): Exercise { return { id: crypto.randomUUID(), name: "", sets: "", reps: "", weight: "", rest: "", duration: "", intensity: "", notes: "" }; }
// Validate persisted JSON before rendering. Unknown versions fall back to the plain-text prescription.
export function readStructure(value: unknown): Structure | null {
  if (!object(value) || value.version !== 1 || typeof value.notes !== "string" || value.notes.length > 6000 || !object(value.targets) || !Array.isArray(value.blocks) || value.blocks.length !== 3) return null;
  if (!["distance", "elevation", "minutes", "effort"].every(key => typeof value.targets === "object" && value.targets !== null && typeof (value.targets as Record<string, unknown>)[key] === "string" && ((value.targets as Record<string, string>)[key]).length <= 12)) return null;
  const seen = new Set<string>();
  for (const b of value.blocks) {
    if (!object(b) || typeof b.stage !== "string" || !Object.hasOwn(stages, b.stage) || seen.has(b.stage) || !Array.isArray(b.items) || b.items.length > 30) return null;
    seen.add(b.stage);
    const ids = new Set<string>();
    for (const i of b.items) {
      if (!object(i) || !exerciseFields.every(key => typeof i[key] === "string" && (i[key] as string).length <= limits[key]) || !i.id || ids.has(i.id as string)) return null;
      ids.add(i.id as string);
    }
  }
  return value as Structure;
}
export function draftFromSession(session: Pick<TrainingSession, "title" | "category" | "details" | "structure">): TrainingDraft {
  const structure = readStructure(session.structure);
  const result = structure ? structuredClone(structure) : emptyStructure();
  if (!structure) result.notes = session.details ?? "";
  return { title: session.title, category: Object.hasOwn(categories, session.category) ? session.category as Category : "trail", structure: result };
}
export function copyDraft(draft: TrainingDraft): TrainingDraft {
  const copy = structuredClone(draft);
  for (const block of copy.structure.blocks) for (const item of block.items) item.id = crypto.randomUUID();
  return copy;
}
function numberIn(value: string, min: number, max: number, integer = false) {
  return value === "" || (/^\d+(\.\d+)?$/.test(value) && Number(value) >= min && Number(value) <= max && (!integer || Number.isInteger(Number(value))));
}
export function validateDraft(draft: TrainingDraft): string | null {
  if (!draft.title.trim() || [...draft.title.trim()].length > 120) return "Escribe un título de entre 1 y 120 caracteres.";
  if (!Object.hasOwn(categories, draft.category) || !readStructure(draft.structure)) return "La estructura de la sesión no es válida.";
  if (new TextEncoder().encode(JSON.stringify(draft.structure)).length > 100000) return "La sesión es demasiado extensa. Reduce las indicaciones o divide el entrenamiento.";
  const t = draft.structure.targets;
  if (!numberIn(t.distance,0,500) || !numberIn(t.elevation,0,30000,true) || !numberIn(t.minutes,1,10080,true) || !numberIn(t.effort,1,10,true)) return "Revisa la distancia, el desnivel, la duración o el esfuerzo objetivo.";
  for (const b of draft.structure.blocks) for (const [n, i] of b.items.entries()) {
    if (!i.name.trim()) return `${stages[b.stage]}: escribe el nombre del ejercicio ${n + 1}.`;
    if (!numberIn(i.sets,1,30,true) || !numberIn(i.weight,0,1000) || !numberIn(i.rest,0,3600,true)) return `${i.name}: revisa las series, la carga o el descanso.`;
  }
  return null;
}
export function plainPrescription(structure: Structure): string {
  const t = structure.targets;
  return [structure.notes.trim(), [t.distance && `${t.distance} km`, t.elevation && `${t.elevation} m+`, t.minutes && `${t.minutes} min`, t.effort && `Esfuerzo ${t.effort}/10`].filter(Boolean).join(" · "), ...structure.blocks.filter(b => b.items.length).map(b => `${stages[b.stage]}\n` + b.items.map((i,n) => `${n+1}. ${i.name}${i.sets ? ` · ${i.sets} series` : ""}${i.reps ? ` × ${i.reps}` : ""}${i.weight ? ` · ${i.weight} kg` : ""}${i.rest ? ` · Descanso ${i.rest} s` : ""}${i.duration ? ` · ${i.duration}` : ""}${i.intensity ? ` · ${i.intensity}` : ""}${i.notes ? `\n${i.notes}` : ""}`).join("\n"))].filter(Boolean).join("\n\n");
}
function preset(title: string, category: Category, items: [Stage, string, string, string, string][]): TrainingDraft {
  const d = emptyDraft(category); d.title = title;
  for (const [stage,name,sets,reps,duration] of items) d.structure.blocks.find(b => b.stage===stage)!.items.push({ id: `preset-${stage}-${d.structure.blocks.find(b=>b.stage===stage)!.items.length}`, name, sets, reps, duration, weight:"",rest:"",intensity:"",notes:"" });
  return d;
}
export const starterTemplates = [
  { id:"strength", name:"Fuerza para corredores", draft:preset("Fuerza de tren inferior", "fuerza", [["warmup","Movilidad y activación","","","8–10 min"],["main","Sentadilla","3","8",""],["main","Peso muerto rumano","3","8",""],["main","Elevaciones de gemelo","3","12",""],["cooldown","Vuelta a la calma","","","5 min"]]) },
  { id:"easy", name:"Rodaje suave", draft:preset("Rodaje suave", "trail", [["warmup","Inicio progresivo","","","10 min"],["main","Carrera continua suave","","","30 min"],["cooldown","Caminar y movilidad","","","5 min"]]) },
  { id:"intervals", name:"Series de trail", draft:preset("Series de trail", "trail", [["warmup","Carrera suave y progresivos","","","15 min"],["main","Series con recuperación suave","6","3 min + 2 min recuperación",""],["cooldown","Carrera suave","","","10 min"]]) },
  { id:"mobility", name:"Movilidad", draft:preset("Movilidad y recuperación", "movilidad", [["warmup","Movimiento suave","","","3 min"],["main","Movilidad de tobillo y cadera","2","8 por lado",""],["cooldown","Respiración y relajación","","","3 min"]]) },
];
