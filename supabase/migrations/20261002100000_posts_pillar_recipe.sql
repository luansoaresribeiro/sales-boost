-- P2 parte 1 (80/20 determinístico): o post publicado passa a lembrar de qual
-- pilar/receita/formato/item do catálogo veio (antes essa informação morria
-- quando agent-actions apagava a linha de marketing_ai_test_content).
-- Só ADD COLUMN IF NOT EXISTS + índice: aditivo, sem RLS, sem cron, sem apagar.
--
-- PARA DESFAZER:
--   drop index if exists idx_posts_company_pillar;
--   alter table posts drop column if exists pillar, drop column if exists recipe,
--     drop column if exists format, drop column if exists item_id;

alter table posts
  add column if not exists pillar text,
  add column if not exists recipe text,
  add column if not exists format text,
  add column if not exists item_id uuid references marketing_ai_knowledge(id) on delete set null;

create index if not exists idx_posts_company_pillar on posts (company_id, pillar) where pillar is not null;
