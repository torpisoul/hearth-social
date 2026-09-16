export const systemMode = mode => ['immediate', 'hourly', 'daily'].includes(mode);

export function pushAvailable(env = globalThis) {
  return Boolean(env.isSecureContext && env.Notification && env.PushManager && env.navigator?.serviceWorker);
}

export async function enablePush(client, owner, mode, key, env = globalThis) {
  if (!systemMode(mode) || !key) throw Error('Save a notification preference first.');
  if (!pushAvailable(env)) throw Error('Notifications aren’t available here. On iPhone or iPad, add Hearth to your Home Screen and open it there.');
  // Call immediately from the deliberate button click, before any network work.
  const permission = await env.Notification.requestPermission();
  if (permission !== 'granted') throw Error('Notifications remain off. You can change browser permissions whenever you choose.');
  const registration = await env.navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: key});
  const {keys} = subscription.toJSON();
  const {error} = await client.from('hearth_push_subscriptions').upsert({owner, endpoint: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth});
  if (error) { if (!existing) await subscription.unsubscribe(); throw Error('Couldn’t save this device. Try again when you’re connected.'); }
}

export async function disablePush(client, owner, env = globalThis) {
  if (!env.navigator?.serviceWorker) return;
  const registration = await env.navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return;
  const {error} = await client.from('hearth_push_subscriptions').delete().eq('owner', owner).eq('endpoint', subscription.endpoint);
  if (error) throw Error('Couldn’t turn off this device. Please reconnect and try again.');
  await subscription.unsubscribe();
  for (const notification of await registration.getNotifications()) notification.close();
}
