-- Permite os novos status usados pela geracao em 2 execucoes separadas
-- (strategy-generate/index.ts, 2026-09-29): 'generating' enquanto a IA
-- trabalha em segundo plano, 'failed' se qualquer etapa nao terminar (ou
-- se ficar 'generating' por mais de 10 minutos, tratado como falha).

begin;

alter table marketing_ai_strategies drop constraint if exists marketing_ai_strategies_status_check;
alter table marketing_ai_strategies add constraint marketing_ai_strategies_status_check
  check (status = any (array['draft','active','paused','completed','needs_review','generating','failed']));

commit;
