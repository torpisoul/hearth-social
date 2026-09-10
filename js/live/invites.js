const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function readInvite(href) {
  const value = new URL(href).searchParams.get('ref');
  return value && uuid.test(value) ? value.toLowerCase() : null;
}
export function inviteUrl(href, person) {
  if (!uuid.test(person)) throw Error('Invalid friend code');
  const url = new URL('./live.html', href);
  url.searchParams.set('ref', person.toLowerCase());
  return url.href;
}
