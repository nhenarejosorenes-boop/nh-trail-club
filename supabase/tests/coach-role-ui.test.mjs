import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {canCoach,hasCoachingAccess,coachLinks} from '../../lib/staff-access.ts';
import {loadMembershipAccess} from '../../lib/membership-client.ts';
const require=createRequire(import.meta.url);
const {transformSync}=require('next/dist/build/swc');
const root=path.resolve(import.meta.dirname,'../..');
const account={id:'coach-account',email:'coach@example.test',full_name:'Entrenador de prueba',role:'athlete'};
function harness(role='admin',failWrite=false) {
  const slots=[],cache=new Map(),effects=[],calls=[];let cursor=0;
  const client={auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role},error:null})})})}),
    rpc:async(name,args)=>{calls.push([name,args]);if(name==='coach_accounts_list')return {data:[],error:null};if(name==='coach_account_lookup')return {data:account,error:null};if(failWrite)throw Error('offline');return {data:{...account,role:'coach'},error:null};}};
  const hooks={...React,useEffect(fn){const i=cursor++;if(!slots[i]){slots[i]=true;effects.push(fn);}},useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});}};
  function load(file) {
    if(file.endsWith('.css'))return {};
    if(cache.has(file))return cache.get(file).exports;
    const module={exports:{}};cache.set(file,module);
    function local(name) {
      if(name==='react')return hooks;
      if(name==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
      if(name==='@/lib/supabase-browser')return {supabase:client};
      if(!name.startsWith('.')&&!name.startsWith('@/'))return require(name);
      const base=name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(file),name);
      return load([base,base+'.ts',base+'.tsx'].find(file=>existsSync(file)));
    }
    const code=transformSync(readFileSync(file,'utf8'),{filename:file,jsc:{parser:{syntax:'typescript',tsx:file.endsWith('.tsx')},transform:{react:{runtime:'automatic'}},target:'es2022'},module:{type:'commonjs'}}).code;
    new Function('require','module','exports',code)(local,module,module.exports);return module.exports;
  }
  const Component=load(path.join(root,'app/admin/entrenadores/page.tsx')).default;
  function render(){cursor=0;return Component();}
  function descendants(node){if(!node||typeof node!=='object')return [];return [node,...React.Children.toArray(node.props?.children).flatMap(descendants)];}
  const nodes=()=>descendants(render());
  const button=label=>nodes().find(n=>n.type==='button'&&n.props.children===label);
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  async function mount(){render();for(const effect of effects)effect();await flush();}
  async function search(){nodes().find(n=>n.type==='input'&&n.props.type==='email').props.onChange({target:{value:account.email}});nodes().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await flush();}
  async function activate(){button('Activar perfil Entrenador').props.onClick();await flush();}
  return {mount,search,activate,calls,nodes,button,html:()=>renderToStaticMarkup(render()),coachHome:()=>load(path.join(root,'components/CoachHome.tsx')).default({name:'Test',logout(){}})};
}
test('coaching helpers admit only admin and coach, not unknown roles or normal subscriptions',()=>{
  for(const role of ['admin','coach'])assert.equal(canCoach(role),true);
  for(const role of ['athlete','trainer','active','',null,undefined])assert.equal(canCoach(role),false);
  assert.equal(hasCoachingAccess({state:'coach'}),true);assert.equal(hasCoachingAccess({state:'active'}),false);
  assert.ok(coachLinks.every(link=>!link.href.startsWith('/admin')&&!link.href.includes('cuotas')));
});
test('staff access does not read or require subscriptions, dues or pilot memberships',async()=>{
  for(const role of ['admin','coach']) {
    const tables=[];const client={from(name){tables.push(name);return {select:()=>({eq:()=>({single:async()=>({data:{role},error:null})})})};}};
    const access=await loadMembershipAccess(client,'staff');
    assert.equal(access.state,role);assert.equal(access.premium,true);assert.deepEqual(tables,['profiles']);
  }
});
test('coach home exposes programming and sports followup, with no administrative links',()=>{
  const h=harness();const html=renderToStaticMarkup(h.coachHome());
  assert.match(html,/Programar fuerza/);assert.match(html,/Programar trail/);assert.match(html,/Deportistas y seguimiento/);
  assert.doesNotMatch(html,/href="\/admin|href="\/deportistas|href="\/mis-cuotas|href="\/suscripciones/);
});
test('coach cannot load management accounts or activate another coach from the page',async()=>{
  const h=harness('coach');await h.mount();assert.match(h.html(),/Solo administración/);
  assert.equal(h.calls.length,0);assert.equal(h.button('Buscar cuenta'),undefined);
});
test('grant requires explicit reviewed identity and submits the original account and role',async()=>{
  const h=harness();await h.mount();await h.search();
  assert.equal(h.button('Activar perfil Entrenador').props.disabled,true);
  await h.activate();assert.equal(h.calls.filter(c=>c[0]==='coach_access_set').length,0);
  h.nodes().find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});
  await h.activate();
  assert.deepEqual(h.calls.find(c=>c[0]==='coach_access_set')[1],{p_user:account.id,p_email:account.email,p_expected_role:'athlete',p_enabled:true});
  assert.match(h.html(),/Perfil Entrenador activado/);
});
test('failed writes require reloading state and cannot be submitted again',async()=>{
  const h=harness('admin',true);await h.mount();await h.search();
  h.nodes().find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});
  await h.activate();assert.match(h.html(),/Recargar estado/);
  assert.equal(h.button('Activar perfil Entrenador'),undefined);assert.equal(h.button('Buscar cuenta').props.disabled,true);
});
