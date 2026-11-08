import test from 'node:test';
import assert from 'node:assert/strict';
import { accountEmail,accountLinkError,previewAccountLink,confirmAccountLink } from '../../lib/athlete-account-link.ts';
const card='44444444-4444-4444-8444-444444444444',user='22222222-2222-4222-8222-222222222222';
const preview={card_id:card,user_id:user,email:'Runner@example.test',full_name:'Corredor',linked:false};
function client(data=preview,error=null){const calls=[];return {calls,rpc:async(...args)=>{calls.push(args);return {data,error};}};}
test('preview uses only the narrow RPC and normalized exact contact email',async()=>{
  const db=client();assert.deepEqual(await previewAccountLink(db,card,' RUNNER@example.test '),preview);
  assert.deepEqual(db.calls,[['preview_athlete_account_link',{p_card_id:card,p_email:'runner@example.test'}]]);
  assert.equal(accountEmail(null),'');
});
test('invalid inputs do not make RPC calls',async()=>{
  const db=client();for(const [id,email] of [['bad','runner@example.test'],[card,''],[card,'bad'],[card,'a b@example.test']])await assert.rejects(previewAccountLink(db,id,email));
  await assert.rejects(confirmAccountLink(db,{...preview,user_id:'bad'}));assert.equal(db.calls.length,0);
});
test('confirmation preserves the reviewed account and requires server confirmation',async()=>{
  const db=client({...preview,linked:true});assert.equal((await confirmAccountLink(db,preview)).linked,true);
  assert.deepEqual(db.calls,[['confirm_athlete_account_link',{p_card_id:card,p_email:'runner@example.test',p_user_id:user}]]);
  for(const response of [null,preview,{...preview,linked:true,user_id:card},{...preview,linked:true,card_id:user},{...preview,linked:true,email:'other@example.test'}])await assert.rejects(confirmAccountLink(client(response),preview));
});
test('malformed and mismatched previews are not displayed as candidates',async()=>{
  for(const response of [null,{...preview,card_id:user},{...preview,email:'other@example.test'},{...preview,linked:true},{...preview,full_name:42}])await assert.rejects(previewAccountLink(client(response),card,'runner@example.test'));
});
test('RPC and transport failures never become successful links',async()=>{
  await assert.rejects(confirmAccountLink(client(null,{message:'ACCOUNT_LINK_ACCOUNT_IN_USE'}),preview));
  await assert.rejects(previewAccountLink({rpc:async()=>{throw new Error('offline');}},card,'runner@example.test'));
  assert.match(accountLinkError({message:'ACCOUNT_LINK_ACCOUNT_IN_USE'}),/otra ficha/);
  assert.match(accountLinkError({code:'PGRST202'}),/todavía no está disponible/);
  assert.equal(accountLinkError({message:'private details'}).includes('private details'),false);
});
