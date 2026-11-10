-- Medição de custo (auditoria de custos, passo 1 — aprovado pelo dono em 10/11): agent_performance passa a separar os tokens
-- da IA (entrada normal, saída, escrita e leitura do reaproveitamento de prompt / prompt caching) e a origem da chamada
-- (agendamento × clique de uma pessoa), para separar operação de teste/uso manual e medir a economia do cache.
-- Só ACRESCENTA colunas que podem ficar vazias: nenhuma linha antiga muda, nenhum dado é apagado, RLS igual.
-- O código grava sem essas colunas se a migration ainda não estiver aplicada (_shared/aiCost.ts → insertPerf).
--
-- ROLLBACK:
--   alter table public.agent_performance drop column if exists input_tokens, drop column if exists output_tokens,
--     drop column if exists cache_write_tokens, drop column if exists cache_read_tokens, drop column if exists call_origin;
alter table public.agent_performance
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists cache_write_tokens integer,
  add column if not exists cache_read_tokens integer,
  add column if not exists call_origin text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'agent_performance_call_origin_check') then
    alter table public.agent_performance add constraint agent_performance_call_origin_check check (call_origin is null or call_origin in ('cron', 'manual'));
  end if;
end $$;
