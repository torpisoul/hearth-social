import {allowedEndpoint} from '../send-push/policy.js';

function checked(result) {
  if (result.error) throw Error('Notification database unavailable');
  return result.data;
}

export async function dispatchBatch(db, send) {
  const claims = checked(await db.rpc('hearth_claim_notifications')) || [];
  let delivered=0, failed=0;
  // Bounded batches keep each cron invocation below the Edge Function time limit.
  for (let offset=0; offset<claims.length; offset+=5) {
    await Promise.all(claims.slice(offset,offset+5).map(async claim => {
      try {
        const targets=checked(await db.rpc('hearth_notification_targets',{person:claim.owner,lease:claim.token})) || [];
        const results=await Promise.all(targets.filter(s=>allowedEndpoint(s.endpoint)).map(async subscription=>{
          try {
            await send({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},
              JSON.stringify({kind:'update',mode:claim.mode}), {TTL:300,timeout:5000,urgency:'normal',topic:'hearth-updates'});
            return true;
          } catch(error) {
            if ([404,410].includes(error?.statusCode)) checked(await db.from('hearth_push_subscriptions').delete().eq('owner',claim.owner).eq('endpoint',subscription.endpoint));
            return false;
          }
        }));
        const success=results.some(Boolean);
        checked(await db.rpc('hearth_finish_notifications',{person:claim.owner,lease:claim.token,delivered:success}));
        if(success) delivered++; else failed++;
      } catch { failed++; /* Lease expiry permits retry; no endpoints or keys in logs. */ }
    }));
  }
  return {claimed:claims.length,delivered,failed};
}
