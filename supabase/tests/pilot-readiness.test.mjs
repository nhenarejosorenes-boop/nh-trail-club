import test from 'node:test';
import assert from 'node:assert/strict';
import { pilotReadiness, loadPilotReadiness } from '../../lib/pilot-readiness.ts';
const at=new Date('2026-11-08T18:00:00Z');
const request=(id,user_id,plan,status='approved')=>({id,user_id,plan,status});
const due=(subscription_id,extra={})=>({subscription_id,period_month:'2026-11-01',status:'paid',amount_eur:'60',...extra});
const card=(id,user_id)=>({id,user_id});

test('readiness counts people once at their highest paid plan and separates missing cards',()=>{
  const requests=[request('b','basic','basic'),request('p','plus','plus'),request('f','performance','plus_performance'),request('old','performance','basic')];
  const data=pilotReadiness(requests,requests.map(r=>due(r.id)),[card('c1','basic'),card('c2','performance'),card('c3',null)],at);
  assert.deepEqual(data.groups,[{plan:'basic',active:1,linked:1,missingCard:0},{plan:'plus',active:1,linked:0,missingCard:1},{plan:'plus_performance',active:1,linked:1,missingCard:0}]);
  assert.equal(data.unlinkedCards,1);assert.equal(data.period,'2026-11-01');
});
test('unpaid approvals, pending requests and invalid or cancelled subscriptions cannot be active',()=>{
  const requests=[request('u','unpaid','plus'),request('p','pending','basic','pending'),request('c','cancelled','plus','cancelled'),request('x','unknown','unknown')];
  const data=pilotReadiness(requests,[due('u',{period_month:'2026-10-01'}),due('p'),due('c'),due('x')],[],at);
  assert.equal(data.unpaidAccounts,1);assert.equal(data.pendingAccounts,1);assert.equal(data.groups.reduce((sum,g)=>sum+g.active,0),0);
});
test('a paid lower plan remains current when a higher plan is unpaid or pending',()=>{
  const requests=[request('b','a','basic'),request('p','a','plus'),request('f','a','plus_performance','pending')];
  const data=pilotReadiness(requests,[due('b')],[card('c','a')],at);
  assert.equal(data.groups[0].linked,1);assert.equal(data.unpaidAccounts,0);assert.equal(data.pendingAccounts,0);
});
test('zero, negative and non-paid dues and payments owned by another subscription are excluded',()=>{
  const requests=Array.from({length:4},(_,i)=>request('s'+i,'u'+i,'basic'));
  const data=pilotReadiness(requests,[due('s0',{amount_eur:0}),due('s1',{amount_eur:-1}),due('s2',{status:'pending'}),due('different')],[],at);
  assert.equal(data.unpaidAccounts,4);assert.equal(data.groups[0].active,0);
});
test('month boundaries use Madrid rather than UTC',()=>{
  const requests=[request('s','u','plus')],cards=[card('c','u')];
  const data=pilotReadiness(requests,[due('s')],cards,new Date('2026-10-31T23:30:00Z'));
  assert.equal(data.period,'2026-11-01');assert.equal(data.groups[1].linked,1);
});
function fake(tables={},user={id:'coach'}){
  const calls=[];
  return {calls,auth:{getUser:async()=>({data:{user},error:null})},from(table){
    const call={table,filters:[],orders:[]};calls.push(call);
    const response=()=>{
      const source=tables[table];if(source instanceof Error)return {data:null,error:source};
      const rows=(source??[]).filter(row=>call.filters.every(([op,key,value])=>op==='eq'?row[key]===value:op==='in'?value.includes(row[key]):Number(row[key])>value));
      return {data:rows,error:null};
    };
    const q={select(value){call.select=value;return q;},eq(...args){call.filters.push(['eq',...args]);return q;},in(...args){call.filters.push(['in',...args]);return q;},gt(...args){call.filters.push(['gt',...args]);return q;},order(...args){call.orders.push(args);return q;},single(){const r=response();return Promise.resolve({...r,data:r.data?.[0]??null});},range(from,to){call.range=[from,to];const r=response();return Promise.resolve({...r,data:r.data?.slice(from,to+1)??null});}};return q;
  }};
}
test('the loader authorizes admin before querying any club or billing rows',async()=>{
  const anonymous=fake({},null);await assert.rejects(loadPilotReadiness(anonymous,at),error=>error.reason==='login');assert.equal(anonymous.calls.length,0);
  const ordinary=fake({profiles:[{id:'coach',role:'athlete'}]});await assert.rejects(loadPilotReadiness(ordinary,at),error=>error.reason==='forbidden');assert.deepEqual(ordinary.calls.map(c=>c.table),['profiles']);
  const broken=fake({profiles:new Error('profile offline')});await assert.rejects(loadPilotReadiness(broken,at),/profile offline/);assert.equal(broken.calls.length,1);
});
test('the loader reads minimal fields and filters paid current-month dues by approved subscriptions',async()=>{
  const db=fake({profiles:[{id:'coach',role:'admin'}],club_subscription_requests:[request('s','u','plus'),request('p','v','basic','pending')],deportistas:[card('c','u')],club_subscription_monthly_dues:[due('s'),due('p'),due('s',{period_month:'2026-10-01'})]});
  const data=await loadPilotReadiness(db,at);assert.equal(data.groups[1].linked,1);assert.equal(data.pendingAccounts,1);
  assert.equal(db.calls.find(c=>c.table==='deportistas').select,'id,user_id');
  assert.equal(db.calls.find(c=>c.table==='club_subscription_requests').select,'id,user_id,plan,status');
  const dues=db.calls.find(c=>c.table==='club_subscription_monthly_dues');
  assert.deepEqual(dues.filters,[['in','subscription_id',['s']],['eq','period_month','2026-11-01'],['eq','status','paid'],['gt','amount_eur',0]]);
  assert.deepEqual(dues.orders,[['subscription_id'],['id']]);
});
test('pagination and bounded billing batches retain every account',async()=>{
  const requests=Array.from({length:1001},(_,i)=>request('s'+i,'u'+i,'plus'));
  const db=fake({profiles:[{id:'coach',role:'admin'}],club_subscription_requests:requests,deportistas:requests.map((r,i)=>card('c'+i,r.user_id)),club_subscription_monthly_dues:requests.map(r=>due(r.id))});
  const data=await loadPilotReadiness(db,at);assert.equal(data.groups[1].linked,1001);
  assert.equal(db.calls.filter(c=>c.table==='club_subscription_requests').length,3);
  assert.equal(db.calls.filter(c=>c.table==='deportistas').length,3);
  const dues=db.calls.filter(c=>c.table==='club_subscription_monthly_dues');assert.equal(dues.length,11);assert.ok(dues.every(c=>c.filters[0][2].length<=100));
});
test('empty data is valid but consultation failures never produce a healthy empty summary',async()=>{
  const tables={profiles:[{id:'coach',role:'admin'}]};
  assert.equal((await loadPilotReadiness(fake(tables),at)).groups[0].active,0);
  for(const table of ['club_subscription_requests','deportistas','club_subscription_monthly_dues']){
    const db=fake({...tables,club_subscription_requests:[request('s','u','plus')],[table]:new Error('offline '+table)});
    await assert.rejects(loadPilotReadiness(db,at),new RegExp('offline '+table));
  }
});
