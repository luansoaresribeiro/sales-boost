-- Fase "Hermes independente" (Frente 2, parte 1 + ajustes 1/2 aprovados):
-- estrategia passa a ter gatilhos automaticos (bootstrap no cadastro,
-- reanalyze semanal, refresh mensal/quando o check-up pedir, estrategia
-- nova so em PIVOT/TERMINATE). auto_strategy e o interruptor de seguranca
-- por empresa -- mora em `companies` (nao em marketing_ai_config, que a
-- Liga dos Sonhos nem tem linha) porque toda empresa tem linha em
-- `companies`, sem excecao. Default ligado pra empresa nova; a Liga dos
-- Sonhos fica desligada ate o dono decidir (pedido explicito).

begin;

alter table companies add column if not exists auto_strategy boolean not null default true;

update companies set auto_strategy = false where business_name ilike '%Liga%Sonhos%';

alter table marketing_ai_strategies add column if not exists last_reanalyzed_at timestamptz;
alter table marketing_ai_strategies add column if not exists last_refreshed_at timestamptz;

alter table marketing_ai_strategy_log drop constraint if exists marketing_ai_strategy_log_decision_type_check;
alter table marketing_ai_strategy_log add constraint marketing_ai_strategy_log_decision_type_check
  check (decision_type in ('refine', 'pivot', 'terminate', 'update'));

commit;
