import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanupMomentMedia} from '../../supabase/functions/cleanup-moment-media/cleanup.js';
import {postInteractions,preparePostImage} from '../../js/live/post-interactions.js';
test('cleanup removes file bytes through Storage API and reports failures for retry',async()=>{
 let removed;const db={rpc:async()=>({data:[{path:'owner/orphan.webp'}]}),storage:{from(bucket){assert.equal(bucket,'hearth-moments');return {remove:async paths=>{removed=paths;return {};}};}}};
 assert.deepEqual(await cleanupMomentMedia(db),{removed:1});assert.deepEqual(removed,['owner/orphan.webp']);
 db.storage.from=()=>({remove:async()=>({error:Error('Storage unavailable')})});await assert.rejects(cleanupMomentMedia(db),/Storage unavailable/);
});
test('unsupported or oversized source images are rejected before decoding',async()=>{
 await assert.rejects(preparePostImage({type:'image/svg+xml',size:1}),/JPEG/);
 await assert.rejects(preparePostImage({type:'image/png',size:11*1024*1024}),/10 MB/);
});
test('failed media metadata write compensates uploads and the incomplete post',async()=>{
 const oldDoc=globalThis.document,oldBitmap=globalThis.createImageBitmap;
 globalThis.createImageBitmap=async()=>({width:10,height:10,close(){}});
 globalThis.document={createElement:()=>({getContext:()=>({drawImage(){}}),toBlob:callback=>callback(new Blob(['picture'],{type:'image/webp'}))})};
 const writes=[],removed=[];const db={storage:{from:()=>({upload:async path=>{writes.push(path);return {};},remove:async paths=>{removed.push(...paths);return {};}})},from(table){return {insert:async()=>table==='hearth_status_media'?{error:Error('Metadata failed')}:{},delete(){return {eq:async()=>{writes.push('delete-post');return {};}}}}}};
 const posts=postInteractions({client:()=>db,user:()=>({id:'owner'}),render(){}});
 try {await posts.select([{type:'image/png',size:10}]);await assert.rejects(posts.create({content:'test'}),/Metadata failed/);assert.equal(removed[0],writes[0]);assert.equal(writes.at(-1),'delete-post');}finally{posts.reset();globalThis.document=oldDoc;globalThis.createImageBitmap=oldBitmap;}
});
