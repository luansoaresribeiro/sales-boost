-- Fase 4 (2026-11-04) — "Por que este imóvel": o motivo REAL da escolha do imóvel fica na peça (e segue pro post aprovado).
-- Conteúdo (jsonb): { rule: least_used|opportunity|owner_choice, candidates, usage_21d, cooldown_ok, photos, min_photos,
--   attributes: [{key,value,path}], availability: {status, checked_at}, picked_at } — só dados que entraram na decisão, nada de
--   justificativa escrita por IA. Ver supabase/functions/_shared/itemService.ts.
-- Aditiva e idempotente. O código grava em UPDATE separado e tolerante (nunca no insert): deploy antes desta migration não quebra nada,
-- só a peça nasce sem o motivo (a tela diz "motivo não registrado").
--
-- DESFAZER (só some o motivo; nada mais depende da coluna):
--   alter table public.marketing_ai_test_content drop column if exists item_pick;
--   alter table public.posts drop column if exists item_pick;
alter table public.marketing_ai_test_content add column if not exists item_pick jsonb;
alter table public.posts add column if not exists item_pick jsonb;
