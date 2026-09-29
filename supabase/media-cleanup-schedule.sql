-- Deploy cleanup-moment-media first, using the same dispatch secret as push.
-- The existing Vault secret must match HEARTH_DISPATCH_SECRET in Edge Functions.
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$begin
 if not exists(select 1 from vault.decrypted_secrets where name='hearth_dispatch_secret') then
  raise exception 'Set the Hearth dispatch Vault secret before scheduling.';
 end if;
 if exists(select 1 from cron.job where jobname='hearth-media-cleanup') then
  perform cron.unschedule('hearth-media-cleanup');
 end if;
end$$;
select cron.schedule('hearth-media-cleanup','17 * * * *',$job$
 select net.http_post(
  url:='https://nkpzdvpzlxiwrtivpiwv.supabase.co/functions/v1/cleanup-moment-media',
  headers:=jsonb_build_object('Content-Type','application/json','x-hearth-dispatch-secret',
    (select decrypted_secret from vault.decrypted_secrets where name='hearth_dispatch_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=60000
 );
$job$);
