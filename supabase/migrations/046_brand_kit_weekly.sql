-- Kit da Marca decide sozinho, uma vez por semana, a partir das fotos reais —
-- sem o dono precisar clicar em nada. Para de mexer assim que ele editar e
-- salvar manualmente (brand_dna.auto_generated vira false nesse momento).
select cron.schedule(
  'brand-kit-suggest-weekly',
  '0 10 * * 1',
  $$
  SELECT net.http_post(
    url     := 'https://miwcxakzyforbahpnpst.supabase.co/functions/v1/brand-kit-suggest',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := json_build_object('cron_secret', (SELECT value FROM _app_config WHERE key = 'cron_secret'))::jsonb
  );
  $$
);
