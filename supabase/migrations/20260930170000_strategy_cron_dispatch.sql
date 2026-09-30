-- Hermes independente: despachante roda 1x por dia, sempre -- a
-- elegibilidade de verdade (empresa sem estrategia, ou 7+ dias desde o
-- ultimo check-up, ou 30+ dias desde o ultimo refresh) e decidida por
-- dentro do proprio cron_dispatch, nao pelo agendamento do cron em si.
-- Roda de madrugada (6h BRT = 9h UTC) pra nao competir com o calendario
-- semanal (domingo 18h BRT) nem com o uso normal do dono durante o dia.
select cron.schedule(
  'strategy-cron-dispatch-daily-6h-brt',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://miwcxakzyforbahpnpst.supabase.co/functions/v1/strategy-generate',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := json_build_object('action', 'cron_dispatch', 'cron_secret', (SELECT value FROM _app_config WHERE key = 'cron_secret'))::jsonb
  );
  $$
);
