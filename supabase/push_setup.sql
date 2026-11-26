-- Agenda Inteligente: agendamento do envio de notificações push.
-- Execute somente depois de publicar a Edge Function send-push e configurar os secrets.
-- Substitua o valor de exemplo pela chave cadastrada como APP_SERVICE_ROLE_KEY.
-- Nunca publique esta chave em arquivos do aplicativo ou em repositórios.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault with schema vault;

select vault.create_secret(
  'https://emzpmnnekznhoslfpuui.supabase.co/functions/v1/send-push',
  'agenda_push_function_url'
);

select vault.create_secret(
  'COLE_AQUI_O_VALOR_DO_SECRET_APP_SERVICE_ROLE_KEY',
  'agenda_push_app_secret'
);

select cron.schedule(
  'agenda-inteligente-push-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'agenda_push_function_url'
      limit 1
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-app-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'agenda_push_app_secret'
        limit 1
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
