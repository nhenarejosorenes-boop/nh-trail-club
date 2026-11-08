import test from 'node:test';import assert from 'node:assert/strict';
import {resolvePilotMembership} from '../../lib/pilot-membership.ts';
import {pilotReadiness} from '../../lib/pilot-readiness.ts';
const at=new Date('2026-11-08T18:00:00Z');
const row={user_id:'u',plan:'basic',starts_at:'2026-11-08T17:00:00Z',expires_at:'2026-11-15T17:00:00Z'};
test('temporary access carries the correct plan, expiry and explicit pilot source',()=>{
 for(const plan of ['basic','plus','plus_performance']){
  const result=resolvePilotMembership({...row,plan},at);assert.equal(result.premium,plan!=='basic');assert.equal(result.source,'pilot');assert.equal(result.pilotExpiresAt,row.expires_at);
 }
});
test('missing, expired, future and malformed grants fail closed',()=>{
 for(const value of [null,{...row,plan:'toString'},{...row,starts_at:'bad'},{...row,expires_at:'bad'},{...row,expires_at:at.toISOString()},{...row,starts_at:'2026-11-09T18:00:00Z'}])assert.equal(resolvePilotMembership(value,at),null);
});
test('pilot readiness separates test subscriptions from paid accounts and invoices',()=>{
 const result=pilotReadiness([],[],[{id:'card',user_id:'u'}],at,[row]);
 assert.equal(result.testGroups[0].linked,1);assert.equal(result.groups[0].active,0);assert.equal(result.unpaidAccounts,0);
});
