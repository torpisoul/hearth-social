import {test,expect,Hearth,me,friend} from './fixtures.js';
import {channelFixture,stranger} from './helpers/channel-fixture.js';
import {groupFixture} from './helpers/group-fixture.js';
import {createIdentity,encryptMessage} from '../../js/live/crypto.js';
const levels=['open','moderate','safeguard'];
const label=s=>s[0].toUpperCase()+s.slice(1);
async function unlock(page){await page.getByLabel('I’ve saved my recovery code somewhere safe.').check();await page.getByRole('button',{name:'Open my conversations'}).click();await expect(page.locator('#unlock')).toHaveCount(0);}
async function refresh(page){if(await page.getByRole('button',{name:'Open menu',exact:true}).isVisible())await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('button',{name:'Refresh',exact:true}).filter({visible:true}).click();await expect(page.locator('#notice')).not.toContainText('Working');}
function seedPost(backend){backend.tables.hearth_statuses=[{id:'moment',author:friend,content:'Afternoon light',created_at:'2026-09-29T09:00:00Z',topic:'Everyday life',audience:'All kin'}];}
async function openChannel(page,backend,options={}){const fixture=await channelFixture(backend,options);const app=new Hearth(page);await app.signIn();await app.tab('parlor');await unlock(page);for(const chat of fixture.chats)await fixture.notes(chat);await page.locator(`[data-group-chat="${fixture.chats[0].id}"]`).click();return {app,...fixture};}
for(const main of levels){
 const permitted=levels.filter(w=>Math.abs(levels.indexOf(w)-levels.indexOf(main))<=1);
 test(`${main} default: payload visibility, permitted controls and device locking`,async({page,backend})=>{
  const {chats,app}=await openChannel(page,backend,{main});
  const conversation=page.locator('#conversation');
  await expect(conversation).toContainText(label(main)+' channel');
  if(main==='open')await expect(conversation).toContainText('A note from Sam 1');
  else {await expect(conversation).not.toContainText('A note from Sam 1');if(main==='moderate')await expect(conversation).toContainText('Sam');else await expect(conversation).not.toContainText('Sam');}
  await page.getByText('Chat settings',{exact:true}).click();await expect(page.locator('[data-group-remove]')).toHaveCount(0);await expect(page.locator('#group-chat-invite')).toHaveCount(0);
  for(const w of levels){const control=page.locator(`[data-group-workflow="${w}"]`).filter({hasText:new RegExp('^Use '+label(w)+'$')});if(permitted.includes(w))await expect(control).toBeVisible();else await expect(control).toHaveCount(0);}
  await app.tab('settings');await page.getByRole('button',{name:'Lock and forget this device'}).click();await app.tab('parlor');await page.locator(`[data-group-chat="${chats[0].id}"]`).click();await expect(conversation).not.toContainText('A note from Sam');await expect(page.locator('#unlock')).toBeVisible();
 });
 // Each transition gets a fresh browser and timeout budget. In particular,
 // Moderate has two alternatives; combining both exceeded WebKit's CI budget.
 for(const target of permitted.filter(w=>w!==main)){
  test(`${main} to ${target}: cancel, confirm, isolate the chat and restore default`,async({page,backend})=>{
   const {chats}=await openChannel(page,backend,{main});
   const conversation=page.locator('#conversation');
   await expect(conversation).toContainText(label(main)+' channel');
   await page.getByText('Chat settings',{exact:true}).click();
   await page.getByRole('button',{name:'Use '+label(target),exact:true}).click();await expect(page.locator('#group-workflow-confirm')).toBeVisible();
   await page.locator('[data-group-dismiss]').click();expect(chats[0].workflow).toBe(null);await expect(conversation).toContainText(label(main)+' channel');
   await page.getByRole('button',{name:'Use '+label(target),exact:true}).click();await page.locator('[data-group-confirm]').click();await expect(conversation).toContainText(label(target)+' channel');expect(chats[0].workflow).toBe(target);expect(chats[1].workflow).toBe(null);
   await page.locator(`[data-group-chat="${chats[1].id}"]`).click();await expect(conversation).toContainText(label(main)+' channel');
   await page.locator(`[data-group-chat="${chats[0].id}"]`).click();await expect(conversation).toContainText(label(target)+' channel');
   await page.getByText('Chat settings',{exact:true}).click();await page.getByRole('button',{name:'Use my default',exact:true}).click();await page.locator('[data-group-confirm]').click();await expect(conversation).toContainText(label(main)+' channel');expect(chats[0].workflow).toBe(null);
  });
 }
}
test('Moderate Connect uses mutual acceptance and only reveals content after refresh',async({page,backend})=>{
 await openChannel(page,backend,{main:'moderate',count:1});await page.locator('[data-group-connect]').click();await expect(page.locator('#notice')).toContainText('Connection request sent');await expect(page.locator('.messages')).not.toContainText('A note from Sam');
 backend.tables.hearth_connections.find(c=>c.recipient===stranger).accepted=true;await refresh(page);await expect(page.locator('.messages')).toContainText('A note from Sam 1');
});
test('an override that is two steps away stops applying after the default changes',async({page,backend})=>{
 const {app}=await openChannel(page,backend,{main:'moderate',count:1});await page.getByRole('button',{name:'Use Open for this chat'}).click();await page.locator('[data-group-confirm]').click();await expect(page.locator('.messages')).toContainText('A note from Sam');
 await app.tab('settings');await app.choice('#updates','channel_workflow','safeguard');await page.getByRole('button',{name:'Save my pace'}).click();await app.tab('parlor');await expect(page.locator('#conversation')).toContainText('Safeguard channel');await expect(page.locator('#conversation')).not.toContainText('Sam');await expect(page.locator('[data-group-workflow="open"]')).toHaveCount(0);
});
test('group pagination and removal refresh do not retain hidden content',async({page,backend})=>{
 const fixture=await channelFixture(backend,{main:'open',count:1}),app=new Hearth(page);await app.signIn();await app.tab('parlor');await unlock(page);await fixture.notes(fixture.chats[0],51);await page.locator('[data-group-chat]').click();await expect(page.locator('.messages article')).toHaveCount(50);
 await page.getByRole('button',{name:'Earlier messages'}).click();await expect(page.locator('.messages article')).toHaveCount(51);await expect(page.getByRole('button',{name:'Earlier messages'})).toHaveCount(0);
 fixture.chats[0].active=false;await refresh(page);await expect(page.locator('[data-group-chat]')).toHaveCount(0);await expect(page.locator('#conversation')).not.toContainText('A note from Sam');
});
test('group creation links a kin group, retries a failed create and reopens that same chat from Your kin',async({page,backend})=>{
 await groupFixture(backend);backend.tables.hearth_kin_groups=[{id:'family',owner:me,name:'Family'}];backend.tables.hearth_kin_group_members=[{group_id:'family',owner:me,person:friend}];
 const app=new Hearth(page);await app.signIn();await app.tab('parlor');await unlock(page);await page.getByRole('button',{name:'Create group chat',exact:true}).click();
 await app.choice('#group-chat-create','linked_group','family');await expect(page.getByLabel('Chat name')).toHaveValue('Family');await expect(page.locator('#group-chat-create input[type=checkbox]')).toBeChecked();
 backend.fail=c=>c.path.endsWith('/hearth_group_create');await page.getByRole('button',{name:'Create chat',exact:true}).click();await expect(page.locator('#notice')).toContainText('Test service unavailable');await expect(page.getByLabel('Chat name')).toHaveValue('Family');
 backend.fail=null;await page.getByRole('button',{name:'Create chat',exact:true}).click();await expect(page.locator('#group-chat-message')).toBeVisible();await app.tab('kin');await page.locator('[data-growth="group"]').click();await page.getByRole('button',{name:'Start group chat'}).click();await expect(page.locator('#group-chat-create')).toHaveCount(0);await expect(page.locator('#group-chat-message')).toBeVisible();
 expect(backend.calls.filter(c=>c.path.endsWith('/hearth_group_create'))).toHaveLength(2);
});
test('failed encrypted group send preserves draft and succeeds on retry',async({page,backend})=>{
 await groupFixture(backend);const app=new Hearth(page);await app.signIn();await app.tab('parlor');await unlock(page);await page.getByRole('button',{name:'Create group chat',exact:true}).click();await page.getByLabel('Chat name').fill('Tea');await page.getByRole('button',{name:'Create chat',exact:true}).click();
 await page.getByLabel('A note for the group').fill('Keep my unsent note');backend.fail=c=>c.path.endsWith('/hearth_group_send');await page.getByRole('button',{name:'Send encrypted group note'}).click();await expect(page.locator('#notice')).toContainText('Test service unavailable');await expect(page.getByLabel('A note for the group')).toHaveValue('Keep my unsent note');
 backend.fail=null;await page.getByRole('button',{name:'Send encrypted group note'}).click();await expect(page.locator('.messages')).toContainText('Keep my unsent note');await expect(page.getByLabel('A note for the group')).toHaveValue('');
 for(const call of backend.calls.filter(c=>c.path.endsWith('/hearth_group_send')))expect(JSON.stringify(call.body)).not.toContain('Keep my unsent note');
});
test('every reaction replaces the previous selection; failed replacement keeps saved state',async({page,backend})=>{
 seedPost(backend);const app=new Hearth(page);await app.signIn();
 const picker=page.locator('.post-reaction');
 for(const emoji of ['♥','🌱','☀️','🫂']){await picker.locator('[data-soft-toggle]').click();await picker.locator(`[data-soft-option="${emoji}"]`).click();await expect(picker.locator('select')).toHaveValue(emoji);await expect(page.locator('#notice')).toBeEmpty();expect(backend.tables.hearth_post_reactions).toHaveLength(1);expect(backend.tables.hearth_post_reactions[0].emoji).toBe(emoji);}
 backend.fail=c=>c.path.endsWith('/hearth_post_reactions');await picker.locator('[data-soft-toggle]').click();await picker.locator('[data-soft-option="♥"]').click();await expect(page.locator('#notice')).toContainText('Test service unavailable');await expect(picker.locator('select')).toHaveValue('🫂');
 backend.fail=null;await page.reload();await expect(picker.locator('select')).toHaveValue('🫂');
});
test('reply validation, failed save, retry, author deletion and escaped content',async({page,backend})=>{
 seedPost(backend);const app=new Hearth(page);await app.signIn();await page.getByRole('button',{name:'Public replies',exact:true}).click();const input=page.getByLabel('Reply to this moment');
 await page.getByRole('button',{name:'Share public reply'}).click();expect(backend.calls.filter(c=>c.path.endsWith('/hearth_post_replies')&&c.method==='POST')).toHaveLength(0);
 await input.fill('<img src=x onerror=alert(1)>');backend.fail=c=>c.path.endsWith('/hearth_post_replies')&&c.method==='POST';await page.getByRole('button',{name:'Share public reply'}).click();await expect(page.locator('#notice')).toContainText('Test service unavailable');await expect(input).toHaveValue('<img src=x onerror=alert(1)>');
 backend.fail=null;await page.getByRole('button',{name:'Share public reply'}).click();await expect(page.locator('.post-replies article')).toContainText('<img src=x');await expect(page.locator('.post-replies article img')).toHaveCount(0);await page.getByRole('button',{name:'Delete reply'}).click();await expect(page.locator('.post-replies article')).toHaveCount(0);
});
test('delayed waiting note keeps its original date and precedes a later delivered note',async({page,backend})=>{
 const app=new Hearth(page);await app.signIn();await app.tab('parlor');await unlock(page);await page.locator(`#parlor-kin-list [data-chat="${friend}"]`).click();await page.getByLabel('A little note',{exact:true}).fill('Written before setup');await page.getByRole('button',{name:'Send encrypted note'}).click();await expect(page.locator('.messages')).toContainText('Written before setup');
 backend.tables.hearth_waiting_notes[0].created_at='2026-01-01T10:00:00Z';const identity=await createIdentity('a newly ready recipient fixture');
 backend.rpc=async(action,args)=>action==='hearth_public_key'&&args.person===friend?identity.public_key:undefined;
 const own=backend.tables.hearth_keys[0].public_key;const later=await encryptMessage(identity.privateKey,own,{id:crypto.randomUUID(),sender:friend,recipient:me},'Written after setup');backend.tables.hearth_messages.push({...later,created_at:'2026-09-29T10:00:00Z'});
 await refresh(page);await expect(page.locator('.bubble').first()).toContainText('Written before setup');await expect(page.locator('.bubble').last()).toContainText('Written after setup');expect(backend.tables.hearth_messages.find(m=>m.sender===me).created_at).toBe('2026-01-01T10:00:00Z');expect(backend.tables.hearth_waiting_notes).toHaveLength(0);
});
for(const mode of ['manual','foreground']){
 test(`${mode} refresh keeps unread sources independent and places them first`,async({page,backend})=>{
  backend.tables.hearth_preferences[0].update_mode=mode;backend.tables.hearth_profiles.push({id:stranger,name:'Sam'});backend.tables.hearth_connections.push({requester:me,recipient:stranger,accepted:true});
  if(mode==='foreground')await page.clock.install();const app=new Hearth(page);await app.signIn();await app.tab('parlor');await expect(page.locator('#notice')).toHaveText('');await expect(page.locator('#parlor-kin-list [data-chat]')).toHaveCount(2);
  backend.tables.hearth_waiting_notes=[{id:'new-note',sender:stranger,recipient:me,created_at:new Date().toISOString()}];
  if(mode==='manual')await refresh(page);else await page.clock.runFor(61000);
  await expect(page.locator('#parlor-kin-list [data-chat]').first()).toHaveAttribute('data-chat',stranger);await expect(page.locator('[aria-label="Unread notes"]')).toHaveCount(1);
  await page.locator(`[data-chat="${friend}"]`).first().click();await expect(page.locator('[aria-label="Unread notes"]')).toHaveCount(1);
  await page.locator(`[data-chat="${stranger}"]`).first().click();await expect(page.locator('[aria-label="Unread notes"]')).toHaveCount(0);
 });
}
test('manual-only notifications hide group and direct indicators',async({page,backend})=>{
 backend.tables.hearth_preferences[0].notification_mode='manual';backend.tables.hearth_waiting_notes=[{id:'waiting',sender:friend,recipient:me,created_at:new Date().toISOString()}];await channelFixture(backend,{count:1});const app=new Hearth(page);await app.signIn();await app.tab('parlor');
 await expect(page.locator('#parlor-kin-list .new-indicator')).toHaveCount(0);await expect(page.locator('.new-indicator:visible')).toHaveCount(0);
});
test('dismissal failure can retry and a reset connection can show its invitation again',async({page,backend})=>{
 const app=new Hearth(page);await app.signIn();await page.goto('live.html?ref='+friend);backend.fail=c=>c.path.endsWith('/hearth_invite_dismissals')&&c.method==='POST';await page.getByRole('button',{name:'Done',exact:true}).click();await expect(page.locator('#notice')).toContainText('Test service unavailable');await expect(page.getByRole('heading',{name:'You’re connected.'})).toBeVisible();
 backend.fail=null;await page.getByRole('button',{name:'Done',exact:true}).click();await expect(page.getByRole('heading',{name:'You’re connected.'})).toHaveCount(0);
 // Connection deletion cascades the server dismissal; the SQL suite verifies that constraint.
 backend.tables.hearth_invite_dismissals=[];backend.tables.hearth_connections=[{requester:friend,recipient:me,accepted:true,created_at:new Date().toISOString()}];await page.goto('live.html?ref='+friend);await expect(page.getByRole('heading',{name:'You’re connected.'})).toBeVisible();
});
test('owner member removal can cancel or retry, and a removed kin can be reinvited',async({page,backend})=>{
 const fixture=await groupFixture(backend),app=new Hearth(page);await app.signIn();await app.tab('parlor');await unlock(page);await page.getByRole('button',{name:'Create group chat',exact:true}).click();await page.getByLabel('Chat name').fill('Friends');await page.locator('#group-chat-create input[type=checkbox]').check();await page.getByRole('button',{name:'Create chat',exact:true}).click();await fixture.incoming();await page.locator('[data-group-chat]').click();await expect(page.locator('#notice')).toBeEmpty();await page.getByText('Chat settings',{exact:true}).click();
 page.once('dialog',d=>d.dismiss());await page.locator('[data-group-remove]').click();await expect(page.locator('[data-group-remove]')).toHaveCount(1);expect(backend.calls.filter(c=>c.path.endsWith('/hearth_group_membership'))).toHaveLength(0);
 backend.fail=c=>c.path.endsWith('/hearth_group_membership');page.once('dialog',d=>d.accept());await page.locator('[data-group-remove]').click();await expect(page.locator('#notice')).toContainText('Test service unavailable');await expect(page.locator('.messages')).not.toContainText('(left group)');
 backend.fail=null;page.once('dialog',d=>d.accept());await page.locator('[data-group-remove]').click();await expect(page.locator('.messages')).toContainText('(left group)');await page.getByText('Chat settings',{exact:true}).click();await page.getByRole('button',{name:'Invite to chat',exact:true}).click();await expect(page.locator('#notice')).toHaveText('');await page.getByText('Chat settings',{exact:true}).click();await expect(page.locator('[data-group-remove]')).toHaveCount(1);
});
