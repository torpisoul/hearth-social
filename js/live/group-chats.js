import {encryptGroupMessage,decryptGroupMessage} from './group-crypto.js';
export const workflows=['open','moderate','safeguard'];
export function allowedWorkflows(main='moderate'){return workflows.filter(w=>Math.abs(workflows.indexOf(w)-workflows.indexOf(main))<=1);}
export function groupChats({client,user,privateKey,preferences,friends,name,kin,esc,run,render,openParlor}) {
 let chats=[],selected='',detail=null,roster=null,creating=false,linked='',text='',older=false,offset=0,history=[],pendingChoice=null;
 const check=({data,error})=>{if(error)throw error;return data;};
 const rpc=async(action,args)=>check(await client().rpc('hearth_group_'+action,args));
 const title=w=>w[0].toUpperCase()+w.slice(1);
 function reset(){chats=[];selected='';detail=null;roster=null;creating=false;linked='';text='';history=[];older=false;offset=0;}
 async function load(active=true){chats=await rpc('list')||[];if(selected&&!chats.some(c=>c.id===selected)){selected='';detail=null;roster=null;}if(active&&selected&&privateKey())await read();}
 async function read(paging=false){
  const started=new Date().toISOString();
  detail=await rpc('read',{chat:selected,page_offset:paging?offset+50:0});
  roster=await rpc('roster',{chat:selected});
  if(!detail)return;
  const rows=await Promise.all(detail.messages.map(async m=>m.hidden?m:{...m,text:await decryptGroupMessage(privateKey(),m).catch(()=> 'This message could not be authenticated or decrypted.')}));
  history=paging?[...rows,...history]:rows;
  offset=paging?offset+50:0;older=rows.length===50;
  // Marker is bounded by the start of this read, so arrivals during it remain unread.
  if(!paging){await rpc('seen',{chat:selected,through_time:started});const chat=chats.find(c=>c.id===selected);if(chat)chat.unread=false;}
 }
 function list(unread,search='') {
  return chats.filter(c=>Boolean(c.unread&&preferences().notification_mode!=='manual')===unread && c.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).map(c=>`<button class="parlor-person" data-group-chat="${c.id}" aria-pressed="${selected===c.id}"><strong>${esc(c.title)}</strong>${unread?'<span class="new-indicator" aria-label="Unread group notes">●</span>':''}</button>`).join('');
 }
 async function exportData() {
  const result=[];
  for(const chat of await rpc('list')||[]) {
   const messages=[];
   for(let page_offset=0;;page_offset+=50){const page=await rpc('read',{chat:chat.id,page_offset});messages.push(...page.messages);if(page.messages.length<50)break;}
   result.push({...chat,messages});
  }
  return result;
 }
 function creator(){
  const group=kin().groups.find(g=>g.id===linked),members=kin().members.filter(m=>m.group_id===linked).map(m=>m.person);
  return `<section class="panel"><h2>Create group chat</h2><form id="group-chat-create" class="live-form"><label class="field">Chat name<input name="title" required maxlength="60" value="${esc(group?.name||'')}"></label><label class="field">Link to your kin group<select name="linked_group" id="chat-linked-group"><option value="">Chat only</option>${kin().groups.map(g=>`<option value="${g.id}" ${linked===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label><fieldset><legend>Invite your kin</legend>${friends().map(id=>`<label><input type="checkbox" name="person" value="${id}" ${members.includes(id)?'checked':''}>${esc(name(id))}</label>`).join('')||'<p>Connect with your kin first.</p>'}</fieldset><p>Invite people connected to you. They don’t need to be connected to one another. Each person needs to have set up encrypted messages.</p><button class="primary">Create chat</button><button type="button" data-group-cancel="">Cancel</button></form><form id="group-chat-connect" class="live-form"><label class="field">Connect with someone new<input name="person" required placeholder="Their friend code"></label><button>Send connection request</button><small>Invite them after they accept in Your kin.</small></form></section>`;
 }
 function view(){
  if(creating)return creator();
  const chat=chats.find(c=>c.id===selected);if(!chat)return '';
  if(!privateKey())return `<section class="panel"><h2>${esc(chat.title)}</h2><p>Open your encrypted messages to read this conversation.</p></section>`;
  const flow=detail?.workflow||chat.workflow||preferences().channel_workflow||'moderate',main=preferences().channel_workflow||'moderate';
  const widen=flow==='safeguard'?'moderate':flow==='moderate'&&main!=='safeguard'?'open':null;
  const prompt=widen?`<p>${flow==='safeguard'?'Message hidden. Show sender names and offer connections in this group?':'Message hidden. Show messages from non-connections in this group?'}</p><button data-group-workflow="${widen}">Use ${title(widen)} for this chat</button>`:'';
  return `<section class="panel"><h2>${esc(chat.title)}</h2><p>${title(flow)} channel${flow!==main?' · Chat override':' · Your default'}</p><details><summary>Chat settings</summary><p>Your default: ${title(main)}. Changes apply only to you.</p><div class="live-actions">${allowedWorkflows(main).map(w=>`<button data-group-workflow="${w}" ${flow===w?'disabled':''}>Use ${title(w)}</button>`).join('')}<button data-group-workflow="default">Use my default</button></div>${chat.owner===user().id?`<h3>Members</h3>${(roster?.members||[]).filter(m=>m.person!==user().id).map(m=>`<p>${esc(m.name)} <button data-group-remove="${m.person}">Remove</button></p>`).join('')}<form id="group-chat-invite" class="live-form"><label class="field">Invite kin<select name="person">${friends().filter(id=>!roster?.members.some(m=>m.person===id)).map(id=>`<option value="${id}">${esc(name(id))}</option>`).join('')}</select></label><button>Invite to chat</button></form><form id="group-chat-connect" class="live-form"><label class="field">Connect with someone new<input name="person" required placeholder="Their friend code"></label><button>Send connection request</button></form>`:''}</details>${detail?.hidden?`<aside class="notice">${prompt}</aside>`:''}<div class="messages">${history.map(m=>m.hidden?`<aside class="notice"><strong>${esc(m.name)}${m.left?' (left group)':''}</strong>${prompt}${m.sender?`<button data-group-connect="${m.sender}">Connect</button>`:''}</aside>`:`<article class="bubble"><strong>${esc(m.name)}${m.left?' (left group)':''}</strong><p class="live-text">${esc(m.text)}</p><time datetime="${esc(m.created_at)}">${esc(new Date(m.created_at).toLocaleString())}</time></article>`).join('')||'<p>A fresh conversation.</p>'}</div>${older?'<button data-group-older="">Earlier messages</button>':''}<form id="group-chat-message" class="live-form"><label class="field">A note for the group<textarea name="text" required maxlength="2000">${esc(text)}</textarea></label><button class="primary">Send encrypted group note</button></form><dialog id="group-workflow-confirm" class="soft-dialog"><h2>Change what you see?</h2><p>This changes the channel only for you in this chat. Messages you already opened cannot be made private again.</p><button data-group-confirm="">Confirm change</button><button data-group-dismiss="">Cancel</button></dialog></section>`;
 }
 function click(d){
  if(d.groupCreate!==undefined){const existing=chats.find(c=>c.kin_group===d.groupCreate&&d.groupCreate);if(existing)return click({groupChat:existing.id});creating=true;selected='';linked=d.groupCreate;openParlor();render();return true;}
  if(d.groupCancel!==undefined){creating=false;render();return true;}
  if(d.groupChat){run(async()=>{selected=d.groupChat;creating=false;history=[];text='';openParlor();if(privateKey())await read();render();});return true;}
  if(d.groupWorkflow){pendingChoice=d.groupWorkflow==='default'?null:d.groupWorkflow;document.querySelector('#group-workflow-confirm').showModal();return true;}
  if(d.groupDismiss!==undefined){document.querySelector('#group-workflow-confirm').close();return true;}
  if(d.groupConfirm!==undefined){run(async()=>{await rpc('override',{chat:selected,choice:pendingChoice});await read();render();});return true;}
  if(d.groupOlder!==undefined){run(async()=>{await read(true);render();});return true;}
  if(d.groupRemove){run(async()=>{if(!confirm('Remove this member from the group? They will lose access to this chat.'))return;await rpc('membership',{chat:selected,person:d.groupRemove,removing:true});await read();render();});return true;}
  if(d.groupConnect){run(async()=>{check(await client().rpc('hearth_request_friend',{person:d.groupConnect}));return 'Connection request sent. They can accept in Your kin.';});return true;}
  return false;
 }
 function submit(form,data){
  if(!form.id.startsWith('group-chat-'))return false;
  run(async()=>{
   if(form.id==='group-chat-connect'){check(await client().rpc('hearth_request_friend',{person:data.person.trim()}));return 'Connection request sent. Invite them after they accept.';}
   if(!privateKey())throw Error('Open your encrypted messages first.');
   if(form.id==='group-chat-create'){selected=await rpc('create',{chat_title:data.title.trim(),people:new FormData(form).getAll('person'),linked_group:data.linked_group||null});creating=false;await load();}
   if(form.id==='group-chat-message'){const current=await rpc('roster',{chat:selected});await rpc('send',await encryptGroupMessage(privateKey(),current,selected,data.text.trim()));text='';await read();}
   if(form.id==='group-chat-invite'){await rpc('membership',{chat:selected,person:data.person,removing:false});await read();}
   render();
  });return true;
 }
 function input(target){if(target.closest('#group-chat-message'))text=target.value;}
 function change(target){if(target.id!=='chat-linked-group')return;linked=target.value;render();}
 return {load,list,exportData,view,click,submit,input,change,reset,active:()=>creating||!!selected,clear:()=>{selected='';creating=false;detail=null;roster=null;history=[];text='';},hasNew:()=>chats.some(c=>c.unread)};
}
