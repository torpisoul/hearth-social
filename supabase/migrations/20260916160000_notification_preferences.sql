alter table public.hearth_preferences
  add column notification_mode text not null default 'in_app'
    check(notification_mode in('in_app','immediate','hourly','daily','manual')),
  add column notification_time text;

comment on column public.hearth_preferences.notification_mode is
  'User preference for future notification delivery; delivery is not enabled by this migration.';
comment on column public.hearth_preferences.notification_time is
  'Optional local HH:MM check-in time for daily notification mode.';
