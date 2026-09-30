export const reactionChoices = ['♥','🌱','☀️','🫂'];
const check=({data,error})=>{if(error)throw error;return data;};
export async function preparePostImage(file) {
 if(!['image/jpeg','image/png','image/webp'].includes(file?.type) || file.size>10*1024*1024) throw Error('Choose JPEG, PNG or WebP images, up to 10 MB each.');
 const bitmap=await createImageBitmap(file);
 try {
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.82));
  if(!blob || blob.size>2*1024*1024)throw Error('That image is too detailed. Choose a smaller image.');
  return blob;
 } finally {bitmap.close();}
}
export function postInteractions({client,user,esc,name,run,render,say}) {
 let replies=[],reactions=[],media=[],images=[],urls=[],open=new Set(),drafts={};
 const bucket=()=>client().storage.from('hearth-moments');
 function clearImages(){images.forEach(i=>URL.revokeObjectURL(i.url));images=[];}
 function reset(){clearImages();urls.forEach(URL.revokeObjectURL);urls=[];replies=[];reactions=[];media=[];open.clear();drafts={};}
 async function load(posts){
  const ids=posts.map(p=>p.id);
  if(!ids.length){replies=[];reactions=[];media=[];return;}
  [replies,reactions,media]=await Promise.all(['hearth_post_replies','hearth_post_reactions','hearth_status_media'].map(async table=>check(await client().from(table).select('*').in(table==='hearth_status_media'?'status':'post',ids))));
  replies.sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
  urls.forEach(URL.revokeObjectURL);urls=[];
  await Promise.all(media.map(async m=>{try{m.url=URL.createObjectURL(check(await bucket().download(m.path)));urls.push(m.url);}catch{m.url=null;}}));
 }
 function composer(){return `<label class="field">Add pictures<span class="file-choice"><input id="post-images" type="file" accept="image/jpeg,image/png,image/webp" multiple aria-describedby="post-image-help"><span class="file-choice-label">Choose pictures</span></span></label><small id="post-image-help">Choose up to four JPEG, PNG or WebP pictures, 10 MB each.</small><div class="media-previews">${images.map((image,i)=>`<figure><img src="${esc(image.url)}" alt="Selected picture ${i+1}"><button type="button" data-remove-image="${i}">Remove picture ${i+1}</button></figure>`).join('')}</div>`;}
 function view(p){
  const pictures=media.filter(m=>m.status===p.id).sort((a,b)=>a.position-b.position);
  return `${pictures.length?`<div class="post-images" id="images-${p.id}" tabindex="0" role="region" aria-label="Pictures for this moment. Use arrow keys to browse.">${pictures.map((m,i)=>`<figure>${m.url?`<img src="${esc(m.url)}" alt="Picture ${i+1} shared by ${esc(name(p.author))}" loading="lazy">`:'<p>Picture unavailable. Try Refresh.</p>'}<figcaption>Picture ${i+1} of ${pictures.length}</figcaption></figure>`).join('')}</div>${pictures.length>1?`<div class="live-actions"><button data-image-step="-1" data-image-post="${p.id}" aria-controls="images-${p.id}">Previous picture</button><button data-image-step="1" data-image-post="${p.id}" aria-controls="images-${p.id}">Next picture</button></div>`:''}`:''}`;
 }
 function actions(p){return `<div class="post-footer"><label class="post-reaction">React<select name="reaction-${p.id}" data-reaction="${p.id}"><option value="" disabled ${!reactions.some(r=>r.post===p.id)?'selected':''}>React</option>${reactionChoices.map(emoji=>`<option value="${emoji}" ${reactions.some(r=>r.post===p.id&&r.emoji===emoji)?'selected':''}>${emoji} ${{'♥':'Love','🌱':'Encouragement','☀️':'Joy','🫂':'Hug'}[emoji]}</option>`).join('')}</select></label><button class="post-action" data-replies="${p.id}" aria-expanded="${open.has(p.id)}">Public replies</button></div>${open.has(p.id)?`<section class="post-replies" aria-label="Public replies">${replies.filter(r=>r.post===p.id).map(r=>`<article><strong>${esc(r.author_name || name(r.author))}</strong><p class="live-text">${esc(r.content)}</p><time datetime="${esc(r.created_at)}">${esc(new Date(r.created_at).toLocaleString())}</time>${r.author===user().id||p.author===user().id?`<button data-delete-reply="${r.id}">Delete reply</button>`:''}</article>`).join('')}<form data-post-reply="${p.id}" class="live-form"><label class="field">Reply to this moment<textarea name="content" required maxlength="1500">${esc(drafts[p.id]||'')}</textarea></label><small>Everyone who can see this moment can read these replies.</small><button>Share public reply</button></form></section>`:''}`;}
 async function create(row){
  const id=crypto.randomUUID(),paths=[];let inserted=false;
  try {
   for(const image of images){const path=`${user().id}/${id}/${crypto.randomUUID()}.webp`;check(await bucket().upload(path,image.blob,{contentType:'image/webp'}));paths.push(path);}
   check(await client().from('hearth_statuses').insert({...row,id}));inserted=true;
   if(paths.length)check(await client().from('hearth_status_media').insert(paths.map((path,position)=>({status:id,owner:user().id,path,position}))));
   clearImages();
  } catch(error){
   let cleanupError;
   if(paths.length){const result=await bucket().remove(paths);cleanupError=result.error;}
   if(inserted){const result=await client().from('hearth_statuses').delete().eq('id',id);cleanupError ||= result.error;}
   if(cleanupError)throw Error('The moment could not be completed and cleanup failed. Please refresh and remove any incomplete moment. '+error.message);
   throw error;
  }
 }
 async function remove(id){const paths=media.filter(m=>m.status===id).map(m=>m.path);if(paths.length)check(await bucket().remove(paths));check(await client().from('hearth_statuses').delete().eq('id',id).eq('author',user().id));}
 function click(d){
  if(d.imageStep){const el=document.getElementById(`images-${d.imagePost}`);el.scrollBy({left:Number(d.imageStep)*el.clientWidth,behavior:"instant"});return true;}
  if(d.removeImage!==undefined){const [removed]=images.splice(Number(d.removeImage),1);if(removed)URL.revokeObjectURL(removed.url);render();return true;}
  if(d.replies){if(open.has(d.replies))open.delete(d.replies);else open.add(d.replies);render();return true;}
  if(d.react){run(async()=>{try{check(await client().from('hearth_post_reactions').upsert({post:d.react,actor:user().id,emoji:d.emoji},{onConflict:'post,actor'}));reactions=reactions.filter(r=>r.post!==d.react).concat({post:d.react,emoji:d.emoji});}finally{render();}});return true;}
  if(d.deleteReply){run(async()=>{check(await client().from('hearth_post_replies').delete().eq('id',d.deleteReply));replies=replies.filter(r=>r.id!==d.deleteReply);render();});return true;}
  return false;
 }
 function submit(form,data){if(!form.dataset.postReply)return false;run(async()=>{const post=form.dataset.postReply;check(await client().from('hearth_post_replies').insert({post,content:data.content.trim()}));drafts[post]='';replies=check(await client().from('hearth_post_replies').select('*').in('post',[...open]));render();});return true;}
 function input(target){if(target.closest('[data-post-reply]'))drafts[target.closest('form').dataset.postReply]=target.value;}
 async function select(files){if(images.length+files.length>4)throw Error('Choose up to four pictures.');const prepared=[];try{for(const file of files){const blob=await preparePostImage(file);prepared.push({blob,url:URL.createObjectURL(blob)});}images.push(...prepared);}catch(e){prepared.forEach(i=>URL.revokeObjectURL(i.url));throw e;}render();}
 return {load,composer,view,actions,create,remove,click,submit,input,select,reset};
}
