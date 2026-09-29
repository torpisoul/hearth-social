import {test,expect,Hearth,me,friend} from './fixtures.js';
async function images(page){
 const state={objects:new Map(),calls:[],failUpload:false,failRemove:false};let bytes;
 await page.route('**/storage/v1/object/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname.replace(/^\/storage\/v1\/object\/(?:authenticated\/)?hearth-moments\/?/,'');state.calls.push({method:req.method(),path});
  if(req.method()==='POST'){if(state.failUpload)return route.fulfill({status:400,json:{message:'Picture upload unavailable'}});state.objects.set(path,bytes);return route.fulfill({json:{Key:path}});}
  if(req.method()==='DELETE'){if(state.failRemove)return route.fulfill({status:400,json:{message:'Picture removal unavailable'}});for(const path of req.postDataJSON().prefixes)state.objects.delete(path);return route.fulfill({json:[]});}
  if(!state.objects.has(path))return route.fulfill({status:404,json:{message:'Not found'}});
  return route.fulfill({body:state.objects.get(path),contentType:'image/png'});
 });
 state.file=async(type='image/png')=>{
  const encoded=await page.evaluate(type=>{const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=900;canvas.getContext('2d').fillRect(0,0,1800,900);return canvas.toDataURL(type).split(',')[1];},type);
  const buffer=Buffer.from(encoded,'base64');bytes=buffer;return {name:'picture.'+type.split('/')[1],mimeType:type,buffer};
 };return state;
}
async function composer(page,backend){const app=new Hearth(page);await app.signIn();await page.locator('[data-action="toggle-moment"]').click();await page.getByLabel('A little moment from your day',{exact:true}).fill('A day in pictures');return app;}
for(const [format,count,audience] of [['jpeg',1,'All kin'],['png',4,'Only me'],['webp',2,'group:family']]){
 test(`${format}: ${count} images, ${audience} audience, previews, reduced-motion and keyboard carousel`,async({page,backend})=>{
  backend.tables.hearth_kin_groups=[{id:'family',name:'Family',owner:me}];const storage=await images(page);await page.emulateMedia({reducedMotion:'reduce'});const app=await composer(page,backend);await app.choice('#status','audience',audience);
  const file=await storage.file('image/'+format);await page.getByLabel('Add pictures').setInputFiles(Array.from({length:count},(_,i)=>({...file,name:i+'-'+file.name})));await expect(page.locator('.media-previews img')).toHaveCount(count);
  await page.getByRole('button',{name:'Share moment',exact:true}).click();await expect(page.locator('.post-images img')).toHaveCount(count);expect(backend.tables.hearth_statuses[0]).toMatchObject({audience:audience.startsWith('group:')?'Group':audience,...(audience.startsWith('group:')?{audience_group:'family'}:{})});
  expect(backend.tables.hearth_status_media).toHaveLength(count);expect([...storage.objects.keys()].every(p=>p.startsWith(me+'/'))).toBe(true);
  if(count===1)await expect(page.getByRole('button',{name:'Next picture'})).toHaveCount(0);
  else {await page.getByRole('button',{name:'Next picture'}).focus();await page.keyboard.press('Enter');await expect.poll(()=>page.locator('.post-images').evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);await page.getByRole('button',{name:'Previous picture'}).click();await expect.poll(()=>page.locator('.post-images').evaluate(e=>e.scrollLeft)).toBe(0);}
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('[data-delete]').click();await expect(page.locator('.post')).toHaveCount(1);expect(storage.objects.size).toBe(count);
  page.once('dialog',dialog=>dialog.accept());await page.locator('[data-delete]').click();await expect(page.locator('.post')).toHaveCount(0);expect(storage.objects.size).toBe(0);
 });
}
test('image count, type and size validation preserve the draft and avoid uploads',async({page,backend})=>{
 const storage=await images(page);await composer(page,backend);const file=await storage.file();const input=page.getByLabel('Add pictures');
 await input.setInputFiles(Array.from({length:5},()=>file));await expect(page.locator('#notice')).toContainText('up to four');await expect(page.locator('.media-previews img')).toHaveCount(0);
 await input.setInputFiles({name:'oversized.png',mimeType:'image/png',buffer:Buffer.alloc(10*1024*1024+1)});await expect(page.locator('#notice')).toContainText('10 MB');
 await input.setInputFiles({name:'vector.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await expect(page.locator('#notice')).toContainText('JPEG');
 await input.setInputFiles([file,file]);await expect(page.locator('.media-previews img')).toHaveCount(2);await page.getByRole('button',{name:'Remove picture 1',exact:true}).click();await expect(page.locator('.media-previews img')).toHaveCount(1);
 await expect(page.getByRole('textbox',{name:'A little moment from your day',exact:true})).toHaveValue('A day in pictures');expect(storage.calls).toHaveLength(0);
});
for(const failure of ['upload','post','media']){
 test(`failed ${failure} creation cleans up and allows retry with the same draft`,async({page,backend})=>{
  const storage=await images(page);await composer(page,backend);await page.getByLabel('Add pictures').setInputFiles(await storage.file());await expect(page.locator('.media-previews img')).toHaveCount(1);
  if(failure==='upload')storage.failUpload=true;else backend.fail=c=>c.method==='POST'&&c.path.endsWith(failure==='post'?'/hearth_statuses':'/hearth_status_media');
  await page.getByRole('button',{name:'Share moment',exact:true}).click();await expect(page.locator('#notice')).toContainText(/unavailable/i);expect(storage.objects.size).toBe(0);expect(backend.tables.hearth_statuses).toHaveLength(0);await expect(page.locator('.media-previews img')).toHaveCount(1);
  storage.failUpload=false;backend.fail=null;await page.getByRole('button',{name:'Share moment',exact:true}).click();await expect(page.locator('.post')).toContainText('A day in pictures');expect(storage.objects.size).toBe(1);
 });
}
test('failed picture deletion preserves the post until storage can retry',async({page,backend})=>{
 const storage=await images(page);await composer(page,backend);await page.getByLabel('Add pictures').setInputFiles(await storage.file());await expect(page.locator('.media-previews img')).toHaveCount(1);await page.getByRole('button',{name:'Share moment',exact:true}).click();await expect(page.locator('.post-images img')).toHaveCount(1);
 storage.failRemove=true;page.once('dialog',d=>d.accept());await page.locator('[data-delete]').click();await expect(page.locator('#notice')).toContainText(/unavailable/i);await expect(page.locator('.post')).toHaveCount(1);
 storage.failRemove=false;page.once('dialog',d=>d.accept());await page.locator('[data-delete]').click();await expect(page.locator('.post')).toHaveCount(0);expect(storage.objects.size).toBe(0);
});
