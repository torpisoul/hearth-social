import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
import {cleanupMomentMedia} from './cleanup.js';
Deno.serve(async request=>{
 const secret=Deno.env.get('HEARTH_DISPATCH_SECRET');
 if(!secret || request.method!=='POST' || request.headers.get('x-hearth-dispatch-secret')!==secret)return new Response('Unauthorized',{status:401});
 try {
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  return Response.json(await cleanupMomentMedia(db));
 } catch {return new Response('Cleanup unavailable',{status:503});}
});
