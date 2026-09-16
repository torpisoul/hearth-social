// Generate secrets without printing private material or overwriting existing keys.
import {createECDH,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile,chmod} from 'node:fs/promises';
const directory=new URL('../supabase/.temp/',import.meta.url);
await mkdir(directory,{recursive:true});
const path=new URL('push-secrets.env',directory);
let contents;
try {contents=await readFile(path,'utf8');} catch(error) {
 if(error.code!=='ENOENT')throw error;
 const key=createECDH('prime256v1');key.generateKeys();
 const privateKey=Buffer.alloc(32);key.getPrivateKey().copy(privateKey,32-key.getPrivateKey().length);
 contents=`VAPID_PUBLIC_KEY=${key.getPublicKey().toString('base64url')}\nVAPID_PRIVATE_KEY=${privateKey.toString('base64url')}\nVAPID_SUBJECT=https://torpisoul.github.io/hearth-social/\nHEARTH_DISPATCH_SECRET=${randomBytes(32).toString('hex')}\n`;
 await writeFile(path,contents,{mode:0o600,flag:'wx'});
}
await chmod(path,0o600);
const values=Object.fromEntries(contents.trim().split('\n').map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)]}));
if(!/^[0-9a-f]{64}$/.test(values.HEARTH_DISPATCH_SECRET) || !/^[A-Za-z0-9_-]{87}$/.test(values.VAPID_PUBLIC_KEY))throw Error('Unexpected existing push secrets; left unchanged.');
// This generated SQL is ignored, private, and must never be committed.
await writeFile(new URL('push-vault.sql',directory),`do $$begin
 if exists(select 1 from vault.decrypted_secrets where name='hearth_dispatch_secret') then
  if not exists(select 1 from vault.decrypted_secrets where name='hearth_dispatch_secret' and decrypted_secret='${values.HEARTH_DISPATCH_SECRET}') then
   raise exception 'Existing dispatch secret differs; refusing to rotate it automatically';
  end if;
 else perform vault.create_secret('${values.HEARTH_DISPATCH_SECRET}','hearth_dispatch_secret');
 end if;
end$$;`,{mode:0o600});
console.log(JSON.stringify({pushPublicKey:values.VAPID_PUBLIC_KEY}));
