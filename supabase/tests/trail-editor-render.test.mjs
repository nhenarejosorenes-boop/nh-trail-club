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
function render(category){const draft=emptyDraft(category);draft.title=category==='trail'?'Rodaje de montaña':'Fuerza';draft.structure.blocks[1].items.push({...newExercise(),name:category==='trail'?'Subida':'Sentadilla'});const noop=()=>{};return renderToStaticMarkup(React.createElement(Composer,{draft,categoryChosen:true,onCategory:noop,onChange:noop,date:'2026-10-26',onDate:noop,min:'2026-10-26',max:'2026-11-01',editing:true,busy:false,error:'',message:'',templates:[],templateError:'',templateBusy:false,onTemplate:noop,onSaveTemplate:async()=>true,onSave:noop,onCancel:noop,library:[],libraryBusy:false,libraryNotice:'',onLibrarySave:noop}));}
test('the actual trail editor renders mountain-running inputs without strength load controls',()=>{const html=render('trail');for(const label of ['Editar sesión de carrera trail y montaña','Distancia del tramo (km)','Desnivel positivo (m+)','Desnivel negativo (m−)','Terreno','Recuperación (segundos)','Cómo recuperar'])assert.ok(html.includes(label),label);assert.equal(html.includes('Carga (kg)'),false);assert.equal(html.includes('Fuerza para corredores'),false);assert.equal(html.includes('Sentadilla goblet'),false);});
test('the strength editor retains its load inputs and excludes the dedicated trail panel',()=>{const html=render('fuerza');assert.ok(html.includes('Carga (kg)'));assert.equal(html.includes('Desnivel negativo (m−)'),false);assert.equal(html.includes('Rodaje suave</option>'),false);});
