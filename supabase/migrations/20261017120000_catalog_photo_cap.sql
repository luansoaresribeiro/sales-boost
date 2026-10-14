-- Máximo de 50 fotos por item do catálogo (decisão do dono, 2026-10-14). A
-- tela já não deixa passar disso (MAX_PHOTOS_PER_ITEM em src/lib/setupRules.ts);
-- o banco garante o mesmo mesmo pra quem gravar direto pela API (o dono grava
-- o próprio item via RLS). Em 2026-10-14 nenhum item em produção tinha fotos,
-- então nada existente quebra.
alter table public.marketing_ai_knowledge
  drop constraint if exists marketing_ai_knowledge_photos_cap;
alter table public.marketing_ai_knowledge
  add constraint marketing_ai_knowledge_photos_cap
  check (jsonb_typeof(meta->'photos') is distinct from 'array' or jsonb_array_length(meta->'photos') <= 50);
