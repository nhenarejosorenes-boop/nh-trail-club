import test from 'node:test';import assert from 'node:assert/strict';
import { createRequire } from 'node:module';import { readFileSync,existsSync } from 'node:fs';import path from 'node:path';import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url),swc=require('next/dist/build/swc'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),cache=new Map();
function load(file){
 if(file.endsWith('.css'))return {};
 if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);
 const js=swc.transformSync(readFileSync(file,'utf8'),{filename:file,jsc:{parser:{syntax:'typescript',tsx:file.endsWith('.tsx')},transform:{react:{runtime:'automatic'}},target:'es2022'},module:{type:'commonjs'}}).code;
 function local(name){if(!name.startsWith('.')&&!name.startsWith('@/'))return require(name);const base=name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(file),name);const resolved=[base,base+'.ts',base+'.tsx'].find(f=>existsSync(f));if(!resolved)throw Error(name);return load(resolved);}
 new Function('require','module','exports',js)(local,module,module.exports);return module.exports;
}
const {emptyDraft,newExercise}=load(path.join(root,'lib/training-builder.ts'));const Composer=load(path.join(root,'components/TrainingComposer.tsx')).default;
function render(category){const draft=emptyDraft(category);draft.title=category==='trail'?'Rodaje de montaña':'Fuerza';draft.structure.blocks[1].items.push({...newExercise(),name:category==='trail'?'Subida':'Sentadilla'});const noop=()=>{};return renderToStaticMarkup(React.createElement(Composer,{draft,goals:[],goalId:"",onGoal:noop,purpose:"",onPurpose:noop,goalLoading:false,onTrailWorkout:noop,categoryChosen:true,onCategory:noop,onChange:noop,date:'2026-10-26',onDate:noop,min:'2026-10-26',max:'2026-11-01',editing:true,busy:false,error:'',message:'',templates:[],templateError:'',templateBusy:false,onTemplate:noop,onSaveTemplate:async()=>true,onSave:noop,onCancel:noop,library:[],libraryBusy:false,libraryNotice:'',onLibrarySave:noop}));}
test('the actual trail editor renders mountain-running inputs without strength load controls',()=>{const html=render('trail');for(const label of ['Series cortas en subida','Técnica de bajada','1. Elige el tipo de sesión','Editar sesión de carrera trail y montaña','Distancia del tramo (km)','Desnivel positivo (m+)','Desnivel negativo (m−)','Terreno','Recuperación (segundos)','Cómo recuperar'])assert.ok(html.includes(label),label);assert.equal(html.includes('Carga (kg)'),false);assert.equal(html.includes('Fuerza para corredores'),false);assert.equal(html.includes('Sentadilla goblet'),false);});
test('the strength editor retains its load inputs and excludes the dedicated trail panel',()=>{const html=render('fuerza');assert.ok(html.includes('Carga (kg)'));assert.equal(html.includes('Desnivel negativo (m−)'),false);assert.equal(html.includes('Rodaje suave</option>'),false);});
test('the composer includes an explicit goal link and a separate session purpose',()=>{const html=render('trail');assert.ok(html.includes('Objetivo del corredor vinculado'));assert.ok(html.includes('¿Para qué sirve esta sesión?'));});
test('the actual goal form renders baseline, deadline and availability fields',()=>{const Form=load(path.join(root,'components/RunnerGoalForm.tsx')).default;const noop=()=>{};const html=renderToStaticMarkup(React.createElement(Form,{client:{},athlete:'a',goal:null,today:'2026-10-26',onSaved:noop,onCancel:noop,onDirty:noop}));for(const label of ['Objetivo principal','Fecha del objetivo o revisión','Días disponibles por semana','Punto de partida y entrenamiento actual'])assert.ok(html.includes(label),label);});

const DailyContent=load(path.join(root,'components/DailyTrainingPanel.tsx')).DailyTrainingContent;
const daily=load(path.join(root,'lib/daily-training.ts')).dailyTraining;
const today='2026-10-27';
const dailyEntry=(id)=>({id,activity_date:today,distance_km:10,elevation_m:100,duration_minutes:60,effort:null,linked_session_id:null});
test('daily view renders the real day and next session with their exact navigation dates',()=>{
 const data=daily([{id:'today-session',session_date:today,category:'fuerza',title:'Fuerza de hoy',completed:true},{id:'future-session',session_date:'2026-11-02',category:'trail',title:'Rodaje del lunes',completed:false}],[],today);
 const html=renderToStaticMarkup(React.createElement(DailyContent,{data,premium:true}));
 assert.ok(html.includes('Fuerza de hoy'));assert.ok(html.includes('Completada'));assert.ok(html.includes('Rodaje del lunes'));assert.ok(html.includes('date=2026-11-02'));assert.ok(html.includes('session=future-session'));
});
test('daily review renders five unique recent tasks and names optional links without treating them as mandatory',()=>{
 const data=daily([],Array.from({length:6},(_,i)=>dailyEntry('row-'+i)),today);
 const html=renderToStaticMarkup(React.createElement(DailyContent,{data,premium:true}));
 assert.equal((html.match(/Revisar salida →/g)||[]).length,5);assert.ok(html.includes('de 6 por revisar'));assert.ok(html.includes('Sin vínculo con el plan (opcional)'));assert.ok(html.includes('entry=row-0'));assert.ok(html.includes('date=2026-10-27'));
});
test('basic daily view excludes individual sessions even if supplied in a UI fixture',()=>{
 const data=daily([{id:'s',session_date:today,category:'trail',title:'Private plan fixture',completed:false}],[],today);
 const html=renderToStaticMarkup(React.createElement(DailyContent,{data,premium:false}));
 assert.equal(html.includes('Private plan fixture'),false);assert.ok(html.includes('PLUS y PLUS Performance'));assert.ok(html.includes('Registrar salida'));
});

const AthleteContent=load(path.join(root,'components/AthleteOverview.tsx')).AthleteOverviewContent;
const athleteFixture={athlete:'11111111-1111-4111-8111-111111111111',cardId:'22222222-2222-4222-8222-222222222222',month:'2026-10',today:'2026-10-27'};
test('athlete overview replaces placeholders with real sections and does not announce RPE completeness for an empty month',()=>{
 const html=renderToStaticMarkup(React.createElement(AthleteContent,{...athleteFixture,data:{sessions:[],entries:[],goals:[],feedback:[]}}));
 for(const heading of ['Entrenamientos del mes','Evolución semanal de trail','Informes de las sesiones del mes','Salidas de montaña del mes'])assert.ok(html.includes(heading),heading);
 assert.equal(html.includes('Próximamente'),false);assert.ok(html.includes('No hay salidas registradas para calcular la carga.'));assert.equal(html.includes('Todas las salidas del mes tienen RPE indicado.'),false);
 assert.ok(html.includes('athlete='+athleteFixture.athlete));assert.ok(html.includes('athlete='+athleteFixture.cardId));assert.ok(html.includes('month=2026-10'));
});
test('athlete overview caps visible session lists while keeping complete monthly totals and reports partial RPE',()=>{
 const sessions=Array.from({length:11},(_,i)=>({id:'session-'+i,title:'Fixture '+i,session_date:'2026-10-27',category:'trail',completed:true}));
 const data={sessions,entries:[{id:'run',activity_date:'2026-10-27',distance_km:10,elevation_m:500,duration_minutes:60,effort:null,source:'file',file_format:'fit'}],goals:[{id:'goal',status:'active',title:'Objetivo fixture',target_date:'2027-03-01'}],feedback:[{session_id:'session-0',effort:4,sensations:'<script>fixture</script>',updated_at:'2026-10-27T10:00:00Z'}]};
 const html=renderToStaticMarkup(React.createElement(AthleteContent,{...athleteFixture,data}));
 assert.ok(html.includes('10 de 11 sesiones'));assert.ok(html.includes('11 / 11'));assert.ok(html.includes('Cálculo parcial: 1 salida(s) sin esfuerzo indicado.'));assert.ok(html.includes('Archivo FIT'));assert.ok(html.includes('Objetivo fixture'));assert.equal(html.includes('<script>fixture</script>'),false);assert.ok(html.includes('&lt;script&gt;fixture&lt;/script&gt;'));
});
