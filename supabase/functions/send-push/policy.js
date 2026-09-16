export function allowedEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && !url.port && !url.username && !url.password &&
      (url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com' ||
       url.hostname === 'web.push.apple.com' || url.hostname.endsWith('.notify.windows.com'));
  } catch { return false; }
}
export const maySend = mode => ['immediate','hourly','daily'].includes(mode);
