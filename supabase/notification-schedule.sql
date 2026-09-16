-- Run only after Edge Function secrets and the matching Vault secret are set.
-- Vault name: hearth_dispatch_secret (same value as HEARTH_DISPATCH_SECRET).
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$begin
 if not exists(select 1 from vault.decrypted_secrets where name='hearth_dispatch_secret') then
  raise exception 'Set the Hearth dispatch Vault secret before scheduling.';
 end if;
end$$;
do $$begin
 if exists(select 1 from cron.job where jobname='hearth-notifications') then
  perform cron.unschedule('hearth-notifications');
 end if;
end$$;
select cron.schedule('hearth-notifications','* * * * *',$job$
 select net.http_post(
  url:='https://nkpzdvpzlxiwrtivpiwv.supabase.co/functions/v1/dispatch-push',
  headers:=jsonb_build_object('Content-Type','application/json','x-hearth-dispatch-secret',
    (select decrypted_secret from vault.decrypted_secrets where name='hearth_dispatch_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=60000
 );
$job$);
