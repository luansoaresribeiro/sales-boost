-- Fase 3 do PLANO-CRIATIVOS (decisões A + B, 2026-10-22): rótulo único por
-- peça (familia · pilar_ss · tema) e a "intenção" da estratégia que guiou a
-- peça. Aditivo e idempotente.
--
-- DESFAZER (nada se perde, só some o rótulo):
--   alter table public.marketing_ai_test_content drop column if exists familia, drop column if exists pilar_ss, drop column if exists intent;
--   alter table public.posts drop column if exists familia, drop column if exists pilar_ss;
--   update public.vertical_playbooks set config = jsonb_set(config, '{content_formats}',
--     (select jsonb_agg(f - 'family' order by ord) from jsonb_array_elements(config->'content_formats') with ordinality as t(f, ord)))
--     where key = 'imoveis_rio' and jsonb_typeof(config->'content_formats') = 'array';
--
-- `tema` NÃO ganha coluna: continua na coluna `pillar` (pilar de conteúdo da
-- ficha: imoveis, bairro_estilo_vida, educacao…). Ver docs/DECISIONS.md.

-- 1) Colunas novas (texto livre validado no código; jsonb só pro "porquê").
alter table public.marketing_ai_test_content
  add column if not exists familia text,
  add column if not exists pilar_ss text,
  add column if not exists intent jsonb;
alter table public.posts
  add column if not exists familia text,
  add column if not exists pilar_ss text;

-- 2) `family` em cada formato da ficha do setor imóveis (regra 6: setor vive
--    na ficha). tour | oferta | educativo | bairro | eventual.
update public.vertical_playbooks
set config = jsonb_set(config, '{content_formats}', (
  select jsonb_agg(f || jsonb_build_object('family', case f->>'key'
    when 'video_comodo' then 'tour'
    when 'video_dois_comodos' then 'tour'
    when 'video_abertura_vista' then 'tour'
    when 'carrossel_imovel' then 'oferta'
    when 'detalhe_imovel' then 'oferta'
    when 'o_que_rs_compra' then 'oferta'
    when 'comente_quero' then 'oferta'
    when 'stories_enquete_pagaria' then 'oferta'
    when 'isso_ou_aquilo' then 'oferta'
    when 'carrossel_educativo' then 'educativo'
    when 'dica_faq' then 'educativo'
    when 'post_trend' then 'educativo'
    when 'tres_coisas_perto' then 'bairro'
    when 'cartao_postal_bairro' then 'bairro'
    else 'eventual' end) order by ord)
  from jsonb_array_elements(config->'content_formats') with ordinality as t(f, ord)))
where key = 'imoveis_rio' and jsonb_typeof(config->'content_formats') = 'array';
