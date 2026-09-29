import {createIdentity} from '../../../js/live/crypto.js';
import {encryptGroupMessage} from '../../../js/live/group-crypto.js';
import {me,friend} from '../fixtures.js';
export const stranger='33333333-3333-4333-8333-333333333333';
export async function channelFixture(backend,{main='moderate',count=2}={}) {
 const levels=['open','moderate','safeguard'];
 const strangerKey=await createIdentity('a fixture key for a non-connection');
 const friendKey=await createIdentity('a fixture key for the owner');
 backend.tables.hearth_preferences[0].channel_workflow=main;
 const chats=Array.from({length:count},(_,i)=>({id:crypto.randomUUID(),title:'Channel '+(i+1),owner:friend,workflow:null,unread:true,active:true,rows:[],self:crypto.randomUUID(),sender:crypto.randomUUID(),host:crypto.randomUUID()}));
 const defaultFlow=()=>backend.tables.hearth_preferences[0].channel_workflow;
 const effective=c=>c.workflow&&Math.abs(levels.indexOf(c.workflow)-levels.indexOf(defaultFlow()))<=1?c.workflow:defaultFlow();
 const ownKey=()=>backend.tables.hearth_keys[0]?.public_key;
 backend.rpc=async(action,args)=>{
  if(action==='hearth_group_list')return chats.filter(c=>c.active).map(c=>({id:c.id,title:c.title,owner:c.owner,workflow:effective(c),unread:c.unread}));
  const chat=chats.find(c=>c.id===args?.chat);
  if(!chat)return;
  if(action==='hearth_group_roster')return {revision:1,self:chat.self,members:[{id:chat.self,person:me,name:'Robin',key:ownKey()},{id:chat.host,person:friend,name:'Alex',key:friendKey.public_key},{id:chat.sender,person:null,name:null,key:strangerKey.public_key}]};
  if(action==='hearth_group_read'){
   const flow=effective(chat),connected=backend.tables.hearth_connections.some(c=>c.accepted&&[c.requester,c.recipient].includes(stranger));
   const rows=flow==='open'||connected?chat.rows:flow==='safeguard'?[]:chat.rows.map(()=>({hidden:true,sender:stranger,name:'Sam',left:false}));
   return {workflow:flow,hidden:flow==='safeguard'&&!connected&&!!chat.rows.length,messages:rows.slice().reverse().slice(args.page_offset||0,(args.page_offset||0)+50).reverse()};
  }
  if(action==='hearth_group_override'){chat.workflow=args.choice;return null;}
  if(action==='hearth_group_seen'){chat.unread=false;return null;}
 };
 return {chats,effective,async notes(chat=chats[0],count=1){
  for(let i=0;i<count;i++){
   const roster={revision:1,self:chat.sender,members:[{id:chat.self,key:ownKey()}]};
   const p=await encryptGroupMessage(strangerKey.privateKey,roster,chat.id,'A note from Sam '+(i+1));
   chat.rows.push({id:p.message_id,conversation:chat.id,sender:chat.sender,name:'Sam',left:false,created_at:new Date(Date.UTC(2026,8,29,10,i)).toISOString(),ciphertext:p.body,iv:p.nonce,key:strangerKey.public_key,envelope:p.envelopes[0].envelope});
  }
 }};
}
