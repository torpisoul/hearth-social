import {test,expect,Hearth,me,friend} from './fixtures.js';
import {groupFixture} from './helpers/group-fixture.js';
const other='33333333-3333-4333-8333-333333333333';
function moment(backend){backend.tables.hearth_statuses=[{id:'moment',author:friend,content:'A quiet afternoon in the garden',created_at:new Date().toISOString(),topic:'Everyday life',audience:'All kin'}];}
async function unlock(page){await page.getByLabel('I’ve saved my recovery code somewhere safe.').check();await page.getByRole('button',{name:'Open my conversations'}).click();await expect(page.locator('#unlock')).toHaveCount(0);}
test('dismissal survives reload and reopening the same invitation, but not a different connection',async({page,backend})=>{
 const app=new Hearth(page);await app.signIn();await page.goto('live.html?ref='+friend);await expect(page.getByRole('heading',{name:'You’re connected.'})).toBeVisible();
 await page.getByRole('button',{name:'Done',exact:true}).click();await page.reload();await expect(page.getByRole('heading',{name:'You’re connected.'})).toHaveCount(0);
 await page.goto('live.html?ref='+friend);await expect(page.getByRole('heading',{name:'You’re connected.'})).toHaveCount(0);
 backend.tables.hearth_profiles.push({id:other,name:'Jo'});backend.tables.hearth_connections.push({requester:me,recipient:other,accepted:true});
 await page.goto('live.html?ref='+other);await expect(page.getByRole('heading',{name:'You’re connected.'})).toBeVisible();
});
test('post actions share dimensions and private replies keep context without inserting text',async({page,backend},info)=>{
 moment(backend);const app=new Hearth(page);await app.signIn();
 await expect(page.locator('.post-person .parlor-person')).toHaveCount(0);
 const sizes=await page.locator('.post-footer').first().locator('button').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));expect(Math.max(...sizes)-Math.min(...sizes)).toBeLessThan(2);
 await page.getByRole('button',{name:'Reply privately'}).click();await expect(page.locator('.reply-context')).toContainText('A quiet afternoon');
 await page.reload();await expect(page.locator('.reply-context')).toContainText('A quiet afternoon');await unlock(page);await expect(page.locator('#message textarea')).toHaveValue('');
 await page.screenshot({path:info.outputPath('context.png'),fullPage:true});
});
test('public replies stay on the post and one anonymous reaction replaces another',async({page,backend})=>{
 moment(backend);const app=new Hearth(page);await app.signIn();await page.getByRole('button',{name:'Public replies',exact:true}).click();
 await page.getByLabel('Reply to this moment').fill('Lovely garden');await page.getByRole('button',{name:'Share public reply'}).click();await expect(page.locator('.post-replies')).toContainText('Lovely garden');
 await page.getByRole('button',{name:'React ♥',exact:true}).click();await expect(page.getByRole('button',{name:'React ♥',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'React 🌱',exact:true}).click();await expect(page.getByRole('button',{name:'React ♥',exact:true})).toHaveAttribute('aria-pressed','false');
 expect(backend.tables.hearth_post_reactions).toHaveLength(1);expect(backend.tables.hearth_post_reactions[0].emoji).toBe('🌱');
});
test('two unread senders keep separate indicators when one conversation is opened',async({page,backend})=>{
 backend.tables.hearth_profiles.push({id:other,name:'Jo'});backend.tables.hearth_connections.push({requester:me,recipient:other,accepted:true});
 backend.tables.hearth_waiting_notes=[friend,other].map((sender,i)=>({id:'waiting'+i,sender,recipient:me,created_at:new Date().toISOString()}));
 const app=new Hearth(page);await app.signIn();await app.tab('parlor');await expect(page.locator('#parlor-kin-list [aria-label="Unread notes"]')).toHaveCount(2);
 await page.locator(`#parlor-kin-list [data-chat="${friend}"]`).click();await expect(page.locator('#parlor-kin-list [aria-label="Unread notes"]')).toHaveCount(1);
 await expect(page.locator(`#parlor-kin-list [data-chat="${other}"] [aria-label="Unread notes"]`)).toBeVisible();
 await app.tab('pulse');await app.tab('parlor');await expect(page.locator('#parlor-kin-list [aria-label="Unread notes"]')).toHaveCount(1);
});
test('pictures preview, upload, carousel and deletion use private Storage',async({page,backend})=>{
 const objects=new Map();let png;
 await page.route('**/storage/v1/object/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname.replace(/^\/storage\/v1\/object\/(?:authenticated\/)?hearth-moments\/?/,'');
  if(req.method()==='POST'){objects.set(path,png);return route.fulfill({json:{Key:path}});}
  if(req.method()==='DELETE'){for(const p of req.postDataJSON().prefixes)objects.delete(p);return route.fulfill({json:[]});}
  return route.fulfill({body:objects.get(path)||png,contentType:'image/png'});
 });
 const app=new Hearth(page);await app.signIn();png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=120;c.height=80;c.getContext('2d').fillRect(0,0,120,80);return c.toDataURL().split(',')[1];}),'base64');
 await page.locator('[data-action="toggle-moment"]').click();await page.getByLabel('A little moment from your day',{exact:true}).fill('Pictures from today');
 await page.getByLabel('Add pictures').setInputFiles([1,2].map(i=>({name:i+'.png',mimeType:'image/png',buffer:png})));
 await expect(page.locator('.media-previews img')).toHaveCount(2);await page.getByRole('button',{name:'Share moment',exact:true}).click();
 await expect(page.locator('.post-images img')).toHaveCount(2);expect(objects.size).toBe(2);
 await page.getByRole('button',{name:'Next picture'}).click();await expect.poll(()=>page.locator('.post-images').evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
 page.once('dialog',d=>d.accept());await page.locator('[data-delete]').click();await expect(page.locator('.post')).toHaveCount(0);expect(objects.size).toBe(0);
});
test('group chat creation, encrypted notes, workflow confirmation and removed-member history',async({page,backend})=>{
 const group=await groupFixture(backend),app=new Hearth(page);await app.signIn();await app.tab('parlor');await unlock(page);
 await page.getByRole('button',{name:'Create group chat',exact:true}).click();await page.getByLabel('Chat name').fill('Our garden');await page.locator('#group-chat-create input[type=checkbox]').check();await page.getByRole('button',{name:'Create chat',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Our garden',exact:true})).toBeVisible();await page.getByLabel('A note for the group').fill('An encrypted group note');await page.getByRole('button',{name:'Send encrypted group note'}).click();await expect(page.locator('.messages')).toContainText('An encrypted group note');
 await page.getByRole('button',{name:'Use Open for this chat'}).click();await expect(page.locator('#group-workflow-confirm')).toBeVisible();await page.getByRole('button',{name:'Confirm change'}).click();await expect(page.locator('#conversation')).toContainText('Open channel');
 await group.incoming();await page.locator('[data-group-chat]').click();await expect(page.locator('.messages')).toContainText('Hello from Alex');
 await page.getByText('Chat settings',{exact:true}).click();page.once('dialog',d=>d.accept());await page.locator('[data-group-remove]').click();await expect(page.locator('.messages')).toContainText('Alex (left group)');await expect(page.locator('.messages')).toContainText('Hello from Alex');
});
test('kin group preselects members and Safeguard only offers Moderate',async({page,backend})=>{
 backend.tables.hearth_preferences[0].channel_workflow='safeguard';backend.tables.hearth_kin_groups=[{id:'kin-group',name:'Family',owner:me}];backend.tables.hearth_kin_group_members=[{group_id:'kin-group',person:friend,owner:me}];
 await groupFixture(backend);const app=new Hearth(page);await app.signIn();await app.tab('parlor');await unlock(page);await app.tab('kin');await page.locator('[data-growth="group"]').click();await page.getByRole('button',{name:'Start group chat'}).click();
 await expect(page.getByLabel('Chat name')).toHaveValue('Family');await expect(page.locator('#group-chat-create input[type=checkbox]')).toBeChecked();await page.getByRole('button',{name:'Create chat',exact:true}).click();
 await expect(page.getByRole('button',{name:'Use Moderate for this chat'})).toBeVisible();await expect(page.getByRole('button',{name:/Use Open/})).toHaveCount(0);await expect(page.locator('.messages')).not.toContainText('New person');
 await page.getByRole('button',{name:'Use Moderate for this chat'}).click();await page.getByRole('button',{name:'Confirm change'}).click();await expect(page.locator('.messages')).toContainText('New person');await expect(page.getByRole('button',{name:/Use Open/})).toHaveCount(0);
});
