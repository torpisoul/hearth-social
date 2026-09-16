import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { allowedEndpoint, maySend } from './policy.js';

const headers = {'Access-Control-Allow-Origin':'https://torpisoul.github.io',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods':'POST, OPTIONS', 'Content-Type':'application/json'};
const reply = (status: number, body: object) => new Response(JSON.stringify(body), {status,headers});

// Self-test only. No service-role key, recipient parameter, arbitrary payload or URL.
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null,{headers});
  if (request.method !== 'POST') return reply(405,{error:'Method not allowed'});
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return reply(401,{error:'Sign in first'});
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
      {global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
    const {data:{user},error:authError} = await client.auth.getUser(authorization.slice(7));
    if (authError || !user) return reply(401,{error:'Sign in first'});
    const {data:preferences,error} = await client.from('hearth_preferences').select('notification_mode').eq('owner',user.id).maybeSingle();
    if (error) return reply(503,{error:'Try again later'});
    if (!maySend(preferences?.notification_mode)) return reply(403,{error:'Notifications are off'});
    const {data:allowed,error:limitError}=await client.rpc('hearth_allow_push_test');
    if (limitError) return reply(503,{error:'Try again later'});
    if (!allowed) return reply(429,{error:'Please wait a minute before another test'});
    const publicKey=Deno.env.get('VAPID_PUBLIC_KEY'), privateKey=Deno.env.get('VAPID_PRIVATE_KEY'), subject=Deno.env.get('VAPID_SUBJECT');
    if (!publicKey || !privateKey || !subject) return reply(503,{error:'Notifications are not configured yet'});
    webpush.setVapidDetails(subject,publicKey,privateKey);
    const {data:subscriptions,error:subscriptionError} = await client.from('hearth_push_subscriptions').select('endpoint,p256dh,auth').eq('owner',user.id).limit(10);
    if (subscriptionError) return reply(503,{error:'Try again later'});
    let sent=0;
    for (const subscription of subscriptions || []) {
      if (!allowedEndpoint(subscription.endpoint)) continue;
      try {
        await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},'{}',{TTL:60,timeout:5000});
        sent++;
      } catch (error) {
        if ([404,410].includes((error as {statusCode:number}).statusCode))
          await client.from('hearth_push_subscriptions').delete().eq('endpoint',subscription.endpoint);
      }
    }
    return reply(sent ? 200 : 409,{sent});
  } catch { return reply(503,{error:'Couldn’t send a test right now'}); }
});
