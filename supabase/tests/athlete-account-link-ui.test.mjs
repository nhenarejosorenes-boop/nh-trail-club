import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('next/dist/build/swc');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const card={id:'44444444-4444-4444-8444-444444444444',nombre:'Ficha',email:'runner@example.test',user_id:null};
const candidate={card_id:card.id,user_id:'22222222-2222-4222-8222-222222222222',email:card.email,full_name:'Corredor',linked:false};
function harness(contact=card,fail=false){
  const slots=[],cache=new Map(),calls=[];let cursor=0,refreshes=0;
  const hooks={...React,useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],value=>{slots[index]=value;}];},useRef(initial){const index=cursor++;return slots[index]??(slots[index]={current:initial});}};
  function load(file){
    if(file.endsWith('.css'))return {};
    if(cache.has(file))return cache.get(file).exports;
    const module={exports:{}};cache.set(file,module);
    function local(name){
      if(name==='react')return hooks;
      if(!name.startsWith('.')&&!name.startsWith('@/'))return require(name);
      const base=name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(file),name);
      return load([base,base+'.ts',base+'.tsx'].find(file=>existsSync(file)));
    }
    const code=transformSync(readFileSync(file,'utf8'),{filename:file,jsc:{parser:{syntax:'typescript',tsx:file.endsWith('.tsx')},transform:{react:{runtime:'automatic'}},target:'es2022'},module:{type:'commonjs'}}).code;
    new Function('require','module','exports',code)(local,module,module.exports);return module.exports;
  }
  const Component=load(path.join(root,'components/AthleteAccountLink.tsx')).default;
  const client={rpc:async(name,args)=>{calls.push([name,args]);if(fail&&name.startsWith('confirm'))throw Error('offline');return {data:{...candidate,linked:name.startsWith('confirm')},error:null};}};
  function render(){cursor=0;return Component({client,card:contact,onRefresh(){refreshes++;}});}
  function descendants(node){if(!node||typeof node!=='object')return [];return [node,...React.Children.toArray(node.props?.children).flatMap(descendants)];}
  function nodes(){return descendants(render());}
  function button(label){return nodes().find(n=>n.type==='button'&&n.props.children===label);}
  // Event callbacks intentionally schedule the async handler with `void`.
  async function click(label){button(label).props.onClick();await new Promise(resolve=>setImmediate(resolve));}
  return {calls,render,nodes,button,click,html:()=>renderToStaticMarkup(render()),refreshes:()=>refreshes};
}
test('account search is explicit and unavailable without a contact email',()=>{
  const h=harness();assert.equal(h.calls.length,0);assert.ok(h.html().includes('Buscar cuenta por este correo'));assert.equal(h.calls.length,0);
  const empty=harness({...card,email:null});assert.equal(empty.button('Buscar cuenta por este correo').props.disabled,true);
  assert.match(empty.html(),/Añade primero el correo correcto/);
  assert.equal(harness({...card,user_id:candidate.user_id}).render(),null);
});
test('the actual review screen requires an identity checkbox before confirmation',async()=>{
  const h=harness();await h.click('Buscar cuenta por este correo');
  assert.match(h.html(),/Correo confirmado/);assert.equal(h.calls.length,1);
  assert.equal(h.button('Confirmar vinculación').props.disabled,true);
  await h.click('Confirmar vinculación');assert.equal(h.calls.length,1);
  h.nodes().find(n=>n.type==='input').props.onChange({target:{checked:true}});
  assert.equal(h.button('Confirmar vinculación').props.disabled,false);
  await h.click('Confirmar vinculación');assert.equal(h.calls.length,2);
  assert.match(h.html(),/Cuenta vinculada correctamente/);
  await h.click('Abrir seguimiento de la cuenta');assert.equal(h.refreshes(),1);
});
test('cancel drops the candidate and resets identity confirmation',async()=>{
  const h=harness();await h.click('Buscar cuenta por este correo');
  h.nodes().find(n=>n.type==='input').props.onChange({target:{checked:true}});
  await h.click('Cancelar');assert.equal(h.calls.length,1);
  await h.click('Buscar cuenta por este correo');assert.equal(h.button('Confirmar vinculación').props.disabled,true);
});
test('an uncertain write requires a refreshed card rather than repeating the write',async()=>{
  const h=harness(card,true);await h.click('Buscar cuenta por este correo');
  h.nodes().find(n=>n.type==='input').props.onChange({target:{checked:true}});
  await h.click('Confirmar vinculación');assert.match(h.html(),/role="alert"/);
  assert.equal(h.button('Confirmar vinculación'),undefined);assert.equal(h.button('Buscar cuenta por este correo'),undefined);
  await h.click('Recargar ficha y comprobar estado');assert.equal(h.refreshes(),1);assert.equal(h.calls.length,2);
});
