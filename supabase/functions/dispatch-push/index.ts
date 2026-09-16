import webpush from 'npm:web-push@3.6.7';
import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
import {dispatchBatch} from './dispatch.js';

Deno.serve(async request=>{
  const secret=Deno.env.get('HEARTH_DISPATCH_SECRET');
  if (!secret || request.method!=='POST' || request.headers.get('x-hearth-dispatch-secret')!==secret)
    return new Response('Unauthorized',{status:401});
  const publicKey=Deno.env.get('VAPID_PUBLIC_KEY'),privateKey=Deno.env.get('VAPID_PRIVATE_KEY'),subject=Deno.env.get('VAPID_SUBJECT');
  if (!publicKey || !privateKey || !subject) return new Response('Not configured',{status:503});
  try {
    webpush.setVapidDetails(subject,publicKey,privateKey);
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
    const result=await dispatchBatch(db,webpush.sendNotification.bind(webpush));
    return Response.json(result,{status:result.failed ? 503 : 200});
  } catch {return new Response('Delivery unavailable',{status:503});}
});
