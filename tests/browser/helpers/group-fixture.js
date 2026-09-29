import {createIdentity} from '../../../js/live/crypto.js';
import {encryptGroupMessage} from '../../../js/live/group-crypto.js';
import {me,friend} from '../fixtures.js';
const other='33333333-3333-4333-8333-333333333333';
export async function groupFixture(backend){
 const identity=await createIdentity('a long group fixture passphrase');let chat=null,flow=backend.tables.hearth_preferences[0].channel_workflow||'moderate',rows=[],revision=1;
 const self=crypto.randomUUID(),member=crypto.randomUUID();let removed=false;
 const roster=()=>({revision,self,members:[{id:self,person:me,name:'Robin',key:backend.tables.hearth_keys[0]?.public_key},...(!removed?[{id:member,person:friend,name:'Alex',key:identity.public_key}]:[])]});
 backend.rpc=async(action,args)=>{
  if(action==='hearth_group_list')return chat?[{...chat,workflow:flow}]:[];
  if(action==='hearth_group_create'){chat={id:crypto.randomUUID(),title:args.chat_title,owner:me,kin_group:args.linked_group};return chat.id;}
  if(action==='hearth_group_roster')return roster();
  if(action==='hearth_group_seen')return null;
  if(action==='hearth_group_override'){flow=args.choice||backend.tables.hearth_preferences[0].channel_workflow||'moderate';return null;}
  if(action==='hearth_group_send'){rows.push({id:args.message_id,conversation:chat.id,sender:self,name:'Robin',created_at:new Date().toISOString(),key:backend.tables.hearth_keys[0].public_key,ciphertext:args.body,iv:args.nonce,envelope:args.envelopes.find(e=>e.member===self).envelope});return null;}
  if(action==='hearth_group_membership'){removed=args.removing;revision++;rows=rows.map(r=>({...r,left:r.sender===member&&removed}));return null;}
  if(action==='hearth_group_read')return {workflow:flow,hidden:flow==='safeguard',messages:rows.concat(flow==='moderate'?[{hidden:true,name:'New person',sender:other}]:[])};
 };
 return {async incoming(){const r=roster();r.self=member;const p=await encryptGroupMessage(identity.privateKey,r,chat.id,'Hello from Alex');rows.push({id:p.message_id,conversation:chat.id,sender:member,name:'Alex',created_at:new Date().toISOString(),key:identity.public_key,ciphertext:p.body,iv:p.nonce,envelope:p.envelopes.find(e=>e.member===self).envelope});}};
}
