// Introductions are structured connection requests, separate from encrypted chat.
export function kinGrowth({ client, user, friends, connections, name, esc, avatar, run, refresh, render, say }) {
 let groups=[], members=[], introductions=[], suggestion=null, available=false;
 let groupSearch='', pendingSearch='', memberSearch='', selectedGroup='', assigning='';
 const check=({data,error})=>{if(error) throw error;return data;};
 const match=(value,query)=>value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
 const personButton=(id,attr)=>`<button type="button" class="parlor-person" ${attr}>${avatar(id)}<span>${esc(name(id))}</span></button>`;
 const pending=()=>connections().filter(c=>!c.accepted);
 const other=c=>c.requester===user().id?c.recipient:c.requester;
 const btn=(label,action,id='')=>`<button type="button" data-growth="${action}" data-id="${id}">${label}</button>`;
 const focus=id=>{const target=document.getElementById(id);target?.focus({preventScroll:true});target?.scrollIntoView({block:'start'});};
 async function load() {
  const result=await client().from('hearth_kin_groups').select('*').order('name');
  if(result.error && ['42P01','PGRST205'].includes(result.error.code)) { available=false;groups=[];members=[];introductions=[];suggestion=null;return; }
  groups=check(result); available=true;
  members=check(await client().from('hearth_kin_group_members').select('*'));
  introductions=check(await client().rpc('hearth_my_introductions')) || [];
  // Quiet background refreshes must not turn suggestions into a carousel.
  if(!suggestion) suggestion=check(await client().rpc('hearth_next_introduction'));
  if(!groups.some(g=>g.id===selectedGroup)) selectedGroup='';
 }
 function familiar() {
  if(!available||!suggestion) return '';
  return `<div class="kin-suggestion"><p>Do these kin know each other?</p><div class="live-actions">${[suggestion.a,suggestion.b].map(id=>personButton(id,`data-chat="${id}"`)).join('')}</div><p class="live-muted">Yes sends both a connection card from you in the parlor. They each choose whether to connect.</p><div class="live-actions">${btn('Yes, introduce them','suggest-yes')}${btn('No','suggest-no')}${btn('Another pair','next')}</div></div>`;
 }
 function groupRows() {
  return groups.filter(g=>match(g.name,groupSearch)).map(g=>`<div class="group-row"><button type="button" class="parlor-person" data-growth="group" data-id="${g.id}" aria-pressed="${selectedGroup===g.id}"><span aria-hidden="true">♧</span><span>${esc(g.name)}</span></button><button type="button" data-growth="delete-group" data-id="${g.id}" aria-label="Remove group ${esc(g.name)}">×</button></div>`).join('')||'<p>No groups here yet. Make a little room for people who belong together.</p>';
 }
 function pendingRows() {
  return pending().filter(c=>match(name(other(c)),pendingSearch)).map(c=>personButton(other(c),`data-growth="pending" data-id="${other(c)}"`)).join('')||'<p>No pending connections here.</p>';
 }
 function memberRows() {
  const ids=[...new Set([...friends(),...pending().map(other)])];
  return ids.filter(id=>match(name(id),memberSearch)).sort((a,b)=>name(a).localeCompare(name(b))).map(id=>personButton(id,`data-growth="member" data-id="${id}" aria-pressed="${members.some(m=>m.group_id===selectedGroup&&m.person===id)}"`)).join('')||'<p>No people found. Try another name.</p>';
 }
 function panels() {
  if(!available) return '';
  const group=groups.find(g=>g.id===selectedGroup);
  return `<div class="kin-growth-grid"><section class="panel"><h2><span aria-hidden="true">♧</span> Pending connections</h2><p>A few seedlings, with room to grow. Connecting is always a choice.</p><label class="field">Find a pending connection<input type="search" data-growth-search="pending" value="${esc(pendingSearch)}" aria-controls="pending-people"></label><div class="parlor-kin-list" id="pending-people">${pendingRows()}</div></section><section class="panel" id="kin-groups" tabindex="-1"><h2>Your groups</h2><p>Private labels to help you find your people. Groups don’t change who can see your moments.</p><label class="field">Find a group<input type="search" data-growth-search="groups" value="${esc(groupSearch)}" aria-controls="kin-group-list"></label><div id="kin-group-list">${groupRows()}</div><form id="kin-new-group" class="live-form"><label class="field">New group name<input name="name" required maxlength="60" placeholder="School friends, family…"></label><button aria-label="Create group">＋ Create group</button></form>${assigning?`<section><h3>Groups for ${esc(name(assigning))}</h3><div class="live-actions">${groups.map(g=>`<button type="button" data-growth="assign" data-id="${g.id}" aria-pressed="${members.some(m=>m.group_id===g.id&&m.person===assigning)}">${esc(g.name)}</button>`).join('')||'<p>Create a group above to get started.</p>'}</div>${btn('Done','done-assign')}</section>`:''}</section></div>${group?`<section class="panel" id="kin-group-detail" tabindex="-1"><h2>${esc(group.name)}</h2><p>Choose kin or pending connections to add or remove. Pressed buttons are in this group.</p><label class="field">Find people<input type="search" data-growth-search="members" value="${esc(memberSearch)}" aria-controls="group-member-list"></label><div class="parlor-kin-list" id="group-member-list">${memberRows()}</div></section>`:''}`;
 }
 function actions(id,accepted) {
  if(!available) return '';
  const request=pending().find(c=>other(c)===id);
  const canRemind=request?.requester===user().id;
  return `${btn('Groups','person-groups',id)}${!accepted&&canRemind?btn('Send a gentle reminder','remind',id):''}`;
 }
 function cards() {
  if(!available) return '';
  const intros=introductions.map(i=>`<article class="panel"><h2>An introduction from ${esc(i.introducer_name)}</h2><p>Hi ${esc(name(user().id).split(/\s+/)[0])}! I noticed you and ${esc(i.person_name)} weren’t connected.</p><p class="live-muted">A connection card from ${esc(i.introducer_name)}. Your reply stays between you and ${esc(i.person_name)}; it isn’t an encrypted chat message.</p>${pending().some(c=>c.requester===i.person&&c.reminded_at)?'<p>A gentle reminder from '+esc(i.person_name)+': would you like to connect?</p>':''}${i.agreed?'<p>You’ve said yes. They can choose in their own time.</p>':`<div class="live-actions">${btn(`Yes, I know ${esc(i.person_name)}`,'agree',i.id)}${btn(`No, I don’t know ${esc(i.person_name)}`,'decline',i.id)}</div>`}</article>`).join('');
  const requests=pending().filter(c=>c.recipient===user().id&&!introductions.some(i=>i.person===c.requester)).map(c=>`<article class="panel"><h2>A connection request from ${esc(name(c.requester))}</h2><p>${c.reminded_at?'A gentle reminder: ':''}Would you like to connect with me on Hearth?</p><div class="live-actions"><button data-accept="${c.requester}">Yes, connect</button><button data-disconnect="${c.requester}">No, thank you</button></div></article>`).join('');
  return intros+requests;
 }
 async function toggleMember(group,person) {
  const present=members.some(m=>m.group_id===group&&m.person===person);
  check(await (present?client().from('hearth_kin_group_members').delete().eq('group_id',group).eq('person',person):client().from('hearth_kin_group_members').insert({owner:user().id,group_id:group,person})));
 }
 function click(button) {
  const {growth:action,id}=button.dataset;
  if(!action) return false;
  if(action==='pending') {focus('kin-card-'+id);return true;}
  if(action==='group') {selectedGroup=id;memberSearch='';render();focus('kin-group-detail');return true;}
  if(action==='person-groups') {assigning=id;render();focus('kin-groups');return true;}
  if(action==='done-assign') {assigning='';render();focus('kin-groups');return true;}
  if(action==='delete-group'&&!confirm('Are you sure you wish to remove this group? Your connections will stay.')) return true;
  run(async()=>{
   if(action==='delete-group') check(await client().from('hearth_kin_groups').delete().eq('id',id));
   if(action==='member') await toggleMember(selectedGroup,id);
   if(action==='assign') await toggleMember(id,assigning);
   if(action==='suggest-yes'||action==='suggest-no') {
    if(!suggestion) return;
    check(await client().rpc('hearth_suggest_kin',{x:suggestion.a,y:suggestion.b,introduce:action==='suggest-yes'}));
   }
   if(['suggest-yes','suggest-no','next','member','assign','delete-group'].includes(action)) suggestion=null;
   if(action==='agree'||action==='decline') check(await client().rpc('hearth_answer_introduction',{introduction:id,agree:action==='agree'}));
   if(action==='remind') check(await client().rpc('hearth_remind_connection',{person:id}));
   await refresh();render();
   if(action==='member') {focus('kin-group-detail');document.querySelector(`[data-growth="member"][data-id="${id}"]`)?.focus({preventScroll:true});}
   if(action==='assign'||action==='delete-group') focus('kin-groups');
   if(action==='suggest-yes') return 'The introductions are ready in their parlors. Each person can choose in their own time.';
   if(action==='remind') return 'A gentle reminder is waiting in their parlor.';
  });
  return true;
 }
 function submit(form,data) {
  if(form.id!=='kin-new-group') return false;
  run(async()=>{
   const label=data.name.trim();if(!label) throw Error('Give your group a name.');
   const created=check(await client().from('hearth_kin_groups').insert({owner:user().id,name:label}).select('id').single());
   selectedGroup=created.id;groupSearch='';memberSearch='';await refresh();render();focus('kin-group-detail');
  });return true;
 }
 function input(target) {
  const kind=target.dataset.growthSearch;
  if(!kind) return;
  if(kind==='pending') {pendingSearch=target.value;document.getElementById('pending-people').innerHTML=pendingRows();}
  if(kind==='groups') {groupSearch=target.value;document.getElementById('kin-group-list').innerHTML=groupRows();}
  if(kind==='members') {memberSearch=target.value;document.getElementById('group-member-list').innerHTML=memberRows();}
 }
 function reset(){groups=[];members=[];introductions=[];suggestion=null;available=false;selectedGroup='';assigning='';groupSearch='';pendingSearch='';memberSearch='';}
 return {load,familiar,panels,actions,cards,click,submit,input,reset,hasNew:()=>introductions.some(i=>!i.agreed),exportData:()=>({groups,members,introductions})};
}
