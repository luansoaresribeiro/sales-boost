-- Calendário da Semana (Agente de Conteúdo): planeja a semana toda (posts +
-- stories) e usa o MESMO motor de geração/QC que já existe (creative-generate
-- → content-test → Vault automático) — não é um motor separado.
-- planned_for guarda pra qual dia da semana aquela peça foi planejada (a UI
-- do Calendário agrupa por essa data, independente do status/agendamento).
-- auto_weekly_calendar liga/desliga o cron por empresa (o dono também pode
-- disparar manualmente com o botão "Planejar semana agora").
alter table marketing_ai_test_content add column if not exists planned_for date;
alter table marketing_ai_config add column if not exists auto_weekly_calendar boolean not null default false;

-- Todo domingo às 18h de Brasília (21h UTC, Brasil não tem mais horário de
-- verão desde 2019 — fuso fixo -03:00).
select cron.schedule(
  'weekly-calendar-plan-sun-18h-brt',
  '0 21 * * 0',
  $$
  SELECT net.http_post(
    url     := 'https://miwcxakzyforbahpnpst.supabase.co/functions/v1/creative-generate',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := json_build_object('action', 'run_weekly_plan', 'cron_secret', (SELECT value FROM _app_config WHERE key = 'cron_secret'))::jsonb
  );
  $$
);
