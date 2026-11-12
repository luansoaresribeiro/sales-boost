-- Link rastreável por PUBLICAÇÃO (dono, 2026-11-12). Antes: um link por (imóvel, oportunidade, canal), então todas as
-- publicações do mesmo imóvel dividiam o link e não dava para saber de qual post veio o lead. Agora a publicação
-- (content_id) entra na regra de unicidade. Links antigos continuam iguais e funcionando (o código não muda); o link
-- geral (sem publicação) continua existindo para DM, bio e manual. Não é identidade de pessoa nem regra de cobrança.
drop index if exists tracked_links_item_opp_channel_uq;
create unique index if not exists tracked_links_item_opp_channel_content_uq on public.tracked_links
  (item_id, coalesce(opportunity_id, '00000000-0000-0000-0000-000000000000'::uuid), channel,
   coalesce(content_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Rollback (só funciona se não houver 2 links do mesmo imóvel/oportunidade/canal com publicações diferentes):
-- drop index if exists tracked_links_item_opp_channel_content_uq;
-- create unique index tracked_links_item_opp_channel_uq on public.tracked_links
--   (item_id, coalesce(opportunity_id, '00000000-0000-0000-0000-000000000000'::uuid), channel);
