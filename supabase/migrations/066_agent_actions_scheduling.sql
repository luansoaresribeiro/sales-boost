-- Agendamento de publicação (Vault → "Agendar"). Quando preenchido, a ação
-- fica aprovada (o dono já decidiu) mas só executa (publica de verdade) na
-- hora certa — um cron varre e roda as que já venceram (ver agent-actions,
-- action 'run_scheduled').
alter table agent_actions add column if not exists scheduled_at timestamptz;

select cron.schedule(
  'run-scheduled-actions-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://miwcxakzyforbahpnpst.supabase.co/functions/v1/agent-actions',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := json_build_object('action', 'run_scheduled', 'cron_secret', (SELECT value FROM _app_config WHERE key = 'cron_secret'))::jsonb
  );
  $$
);
