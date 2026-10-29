-- Etapa 4 (Parte B) da Inteligência comercial — plano aprovado → peças em rascunho (automático).
-- Aditiva e idempotente: só colunas nuláveis, índices e dois textos da ficha. Sem cron, sem mudar RLS, sem apagar nada.
--
-- growth_opportunities.pieces_generated_at = quando as peças do plano foram PEDIDAS ao motor de criação (reserva atômica:
--                     impede gerar duas vezes; o cron só tenta de novo se, 30 min depois, nenhuma peça apareceu).
-- marketing_ai_test_content.opportunity_id / posts.opportunity_id = de qual oportunidade a peça veio. O vínculo segue a
--                     peça até o post aprovado (agent-actions copia, como item_id) — é por ele que a Etapa 6 mede por oportunidade.
--                     on delete set null: apagar a oportunidade nunca apaga a peça.
--
-- Ficha do setor (regra 6 — nada de setor no código): imoveis_rio ganha
--   opportunity_pieces       formato do plano (carousel/post/story) → formato do catálogo da ficha, com foto real (item)
--                            ou só texto (text). Vídeo e DM nunca entram aqui (custo extra / envio).
--   opportunity_texts.market_claims  adjetivos/expressões de mercado inteiros (borda de palavra, pt/en) que a IA só pode usar se estiverem nos fatos.
-- Setor sem esses textos usa os genéricos do código (carrossel de slides; lista genérica de afirmações).
--
-- Como reverter (as colunas só guardam o vínculo; nenhuma peça é apagada):
--   drop index if exists public.marketing_ai_test_content_opportunity_idx;
--   drop index if exists public.posts_opportunity_idx;
--   alter table public.marketing_ai_test_content drop column if exists opportunity_id;
--   alter table public.posts drop column if exists opportunity_id;
--   alter table public.growth_opportunities drop column if exists pieces_generated_at;
--   update public.vertical_playbooks set config = (config - 'opportunity_pieces') #- '{opportunity_texts,market_claims}' where key = 'imoveis_rio';

begin;

alter table public.growth_opportunities
  add column if not exists pieces_generated_at timestamptz;

alter table public.marketing_ai_test_content
  add column if not exists opportunity_id uuid references public.growth_opportunities(id) on delete set null;

alter table public.posts
  add column if not exists opportunity_id uuid references public.growth_opportunities(id) on delete set null;

create index if not exists marketing_ai_test_content_opportunity_idx
  on public.marketing_ai_test_content (opportunity_id) where opportunity_id is not null;
create index if not exists posts_opportunity_idx
  on public.posts (opportunity_id) where opportunity_id is not null;

-- Ficha: mapa formato do plano → formato do catálogo (só entra se ainda não existe — não sobrescreve ajuste do dono).
update public.vertical_playbooks
set config = jsonb_set(coalesce(config, '{}'::jsonb), '{opportunity_pieces}', $json${
  "carousel": { "item": "carrossel_imovel", "text": "carrossel_educativo" },
  "post":     { "item": "detalhe_imovel", "text": "carrossel_educativo" },
  "story":    { "item": "stories_enquete_pagaria", "text": "carrossel_educativo" }
}$json$::jsonb, true)
where key = 'imoveis_rio'
  and (config->'opportunity_pieces') is null;

-- Ficha: adjetivos/expressões de mercado que exigem dado (palavra inteira, sem acento; flexões listadas).
update public.vertical_playbooks
set config = jsonb_set(config, '{opportunity_texts,market_claims}', $json${
  "pt": ["disputado", "disputada", "disputados", "disputadas", "concorrido", "concorrida", "valorizado", "valorizada", "valorizados", "valorizadas", "valorizacao", "alto padrao", "nobre", "nobres", "em alta", "badalado", "badalada", "cobicado", "cobicada", "ticket elevado", "ticket alto", "muito procurado", "muito procurada", "bairro quente", "mercado aquecido", "alta demanda", "luxo", "sofisticado", "sofisticada"],
  "en": ["competitive", "in demand", "high demand", "hot market", "hot neighborhood", "upscale", "high-end", "high end", "prime location", "sought-after", "sought after", "booming", "appreciating", "appreciation", "luxury", "high ticket", "premium", "coveted"]
}$json$::jsonb, true)
where key = 'imoveis_rio'
  and jsonb_typeof(config->'opportunity_texts') = 'object'
  and (config->'opportunity_texts'->'market_claims') is null;

commit;
