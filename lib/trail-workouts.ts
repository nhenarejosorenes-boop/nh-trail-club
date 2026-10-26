import { emptyDraft, newExercise, type Exercise, type TrainingDraft } from './training-builder.ts';
type TrailWorkoutType = { id:string; title:string; description:string; main:Partial<Exercise> };
export const trailWorkoutTypes:TrailWorkoutType[]=[
 {id:'easy',title:'Rodaje aeróbico de montaña',description:'Carrera continua suave en pista o sendero.',main:{name:'Carrera continua suave',duration:'30 min',intensity:'Z2 / RPE 3–4',trailTerrain:'Pista o sendero fácil'}},
 {id:'long',title:'Tirada larga por montaña',description:'Tiempo en movimiento, desnivel y gestión del esfuerzo.',main:{name:'Recorrido continuo por montaña',duration:'60 min',intensity:'RPE 3–4, esfuerzo estable',trailTerrain:'Terreno mixto',notes:'Ajusta el esfuerzo en las subidas y combina carrera y caminata según lo pautado.'}},
 {id:'short-hills',title:'Series cortas en subida',description:'Repeticiones breves con recuperación en la bajada.',main:{name:'Subida corta',sets:'8',duration:'30 s',rest:'90',intensity:'RPE 7',trailTerrain:'Subida regular',trailRecovery:'Bajar caminando o al trote suave'}},
 {id:'long-hills',title:'Series largas en subida',description:'Trabajo sostenido por tiempo y desnivel.',main:{name:'Subida sostenida',sets:'5',duration:'3 min',rest:'180',intensity:'RPE 7',trailTerrain:'Pista o sendero en subida',trailRecovery:'Bajada suave o caminata'}},
 {id:'fartlek',title:'Cambios de ritmo en montaña',description:'Alterna tramos de trabajo y recuperación sobre terreno variable.',main:{name:'Tramo de ritmo vivo',sets:'6',duration:'2 min',rest:'120',intensity:'RPE 6–7',trailTerrain:'Terreno ondulado',trailRecovery:'Carrera suave'}},
 {id:'downhill',title:'Técnica de bajada',description:'Control de apoyos, trazada y fluidez en descenso.',main:{name:'Descenso técnico controlado',sets:'4',duration:'1 min',rest:'120',intensity:'Priorizar control técnico',trailTerrain:'Bajada adaptada al nivel',trailRecovery:'Subir caminando',notes:'Elige una pendiente y una dificultad acordes al nivel. Prioriza el control sobre la velocidad.'}},
];
// Each selection creates a new editable prescription, without linking a client or saving it.
export function mountainRunningDraft(id:string):TrainingDraft|null {
 const type=trailWorkoutTypes.find(t=>t.id===id);if(!type)return null;
 const d=emptyDraft('trail');d.title=type.title;
 d.structure.notes=type.description;
 d.structure.blocks[0].items.push({...newExercise(),name:'Inicio progresivo y preparación para la carrera',duration:'10 min',intensity:'Suave',trailTerrain:'Terreno sencillo'});
 d.structure.blocks[1].items.push({...newExercise(),...type.main});
 d.structure.blocks[2].items.push({...newExercise(),name:'Carrera suave o caminar',duration:'5 min',intensity:'Muy suave',trailTerrain:'Terreno sencillo'});
 return d;
}
