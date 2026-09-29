import {encryptMessage,decryptMessage} from './crypto.js';
const utf8=new TextEncoder(),decode=new TextDecoder();
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
const aad=meta=>utf8.encode(JSON.stringify(['hearth-group-v1',meta.conversation,meta.id,meta.sender]));
export async function encryptGroupMessage(privateKey,roster,conversation,text) {
 if(!text.trim()||text.length>2000)throw Error('Messages must contain 1–2,000 characters.');
 const id=crypto.randomUUID(),meta={id,conversation,sender:roster.self},raw=crypto.getRandomValues(new Uint8Array(32));
 const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12)),payload=utf8.encode(JSON.stringify({text}));
 if(payload.length>8188)throw Error('That message is too long.');
 const padded=new Uint8Array(8192);new DataView(padded.buffer).setUint32(0,payload.length);padded.set(payload,4);
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(meta)},key,padded);
 const envelopes=await Promise.all(roster.members.map(async m=>({member:m.id,envelope:await encryptMessage(privateKey,m.key,{id,sender:roster.self,recipient:m.id},b64(raw))})));
 raw.fill(0);
 return {chat:conversation,expected_revision:roster.revision,message_id:id,body:b64(ciphertext),nonce:b64(iv),envelopes};
}
export async function decryptGroupMessage(privateKey,message) {
 const raw=unb64(await decryptMessage(privateKey,message.key,message.envelope));
 const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);raw.fill(0);
 const buffer=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(message.iv),additionalData:aad(message)},key,unb64(message.ciphertext));
 if(buffer.byteLength!==8192)throw Error('Invalid group message');
 const length=new DataView(buffer).getUint32(0);
 if(length>8188)throw Error('Invalid group message');
 return JSON.parse(decode.decode(new Uint8Array(buffer,4,length))).text;
}
