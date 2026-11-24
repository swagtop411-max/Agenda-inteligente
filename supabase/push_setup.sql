-- Agenda Inteligente: agendamento do envio de notificações push
-- Execute somente depois de publicar a Edge Function send-push e configurar seus secrets.
-- Substitua os dois valores entre aspas antes de executar.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault with schema vault;

select vault.create_secret(
  'https://emzpmnnekznhoslfpuui.supabase.co/functions/v1/send-push',
  'agenda_push_function_url'
);

select vault.create_secret(
  'COLE_AQUI_A_CHAVE_SERVICE_ROLE_DO_SUPABASE',
  'agenda_push_service_role'
);

select cron.schedule(
  'agenda-inteligente-push-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_push_function_url' limit 1),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'agenda_push_service_role' limit 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
