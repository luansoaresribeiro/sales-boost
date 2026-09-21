-- Geração automática diária de post de teste (Área de Testes → botão
-- "gerar automaticamente"). auto_daily_test liga/desliga por empresa;
-- auto_daily_test_image decide se a rodada automática inclui imagem ou só
-- texto. O job cron chama creative-generate em modo lote (cron_secret, sem
-- company_id) 1x/dia às 10h de Brasília (13h UTC).
alter table marketing_ai_config
  add column if not exists auto_daily_test boolean not null default false,
  add column if not exists auto_daily_test_image boolean not null default true;

select cron.schedule(
  'auto-daily-test-10am-brt',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://miwcxakzyforbahpnpst.supabase.co/functions/v1/creative-generate',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := json_build_object('cron_secret', (SELECT value FROM _app_config WHERE key = 'cron_secret'))::jsonb
  );
  $$
);
