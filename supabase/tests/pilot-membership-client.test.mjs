import test from 'node:test';import assert from 'node:assert/strict';
import {loadMembershipAccess} from '../../lib/membership-client.ts';
import {membershipMonth} from '../../lib/membership-model.ts';
const grant={user_id:'own',plan:'plus',starts_at:new Date(Date.now()-60000).toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()};
function fake(tables={}){
 const calls=[];return {calls,from(table){const call={table,filters:[]};calls.push(call);const response=()=>tables[table] instanceof Error?{data:null,error:tables[table]}:{data:(tables[table]??[]).filter(row=>call.filters.every(([op,key,val])=>op==='eq'?row[key]===val:op==='in'?val.includes(row[key]):Number(row[key])>val)),error:null};
 const q={select(){return q;},eq(...args){call.filters.push(['eq',...args]);return q;},in(...args){call.filters.push(['in',...args]);return q;},gt(...args){call.filters.push(['gt',...args]);return q;},single(){const r=response();return Promise.resolve({...r,data:r.data?.[0]??null});},maybeSingle(){return q.single();},then(...args){return Promise.resolve(response()).then(...args);}};return q;}};
}
const profile={id:'own',role:'athlete'};
test('a current pilot grants access without reading or requiring any paid invoice',async()=>{
 const db=fake({profiles:[profile],club_pilot_memberships:[grant]});const access=await loadMembershipAccess(db,'own');
 assert.equal(access.source,'pilot');assert.equal(access.premium,true);assert.equal(db.calls.some(c=>c.table==='club_subscription_monthly_dues'),false);
 assert.deepEqual(db.calls.find(c=>c.table==='club_pilot_memberships').filters,[['eq','user_id','own']]);
});
test('a grant owned by another account never enables access',async()=>{
 const db=fake({profiles:[profile],club_pilot_memberships:[{...grant,user_id:'other'}]});assert.equal((await loadMembershipAccess(db,'own')).club,false);
});
test('expired pilots fall back to existing ordinary membership rules',async()=>{
 const db=fake({profiles:[profile],club_pilot_memberships:[{...grant,expires_at:new Date(Date.now()-1000).toISOString()}],club_subscription_requests:[{id:'s',user_id:'own',plan:'basic',status:'approved'}],club_subscription_monthly_dues:[{subscription_id:'s',period_month:membershipMonth(),status:'paid',amount_eur:10}]});
 assert.deepEqual(await loadMembershipAccess(db,'own'),{state:'active',plan:'basic',club:true,premium:false});
});
test('a pilot read failure is an access-check failure, not fabricated approval',async()=>{
 await assert.rejects(loadMembershipAccess(fake({profiles:[profile],club_pilot_memberships:new Error('offline')}),'own'),/offline/);
});
test('administrators retain their existing access independently of test plans',async()=>{
 const db=fake({profiles:[{id:'own',role:'admin'}],club_pilot_memberships:[grant]});
 assert.deepEqual(await loadMembershipAccess(db,'own'),{state:'admin',plan:null,club:true,premium:true});
});
