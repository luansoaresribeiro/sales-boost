-- Calendário da semana vem da estratégia (pedido do dono, 2026-10-14).
--
-- 1) auto_weekly_calendar vira tri-estado: null = "não mexi" → o cron de
--    domingo planeja sozinho quando existe estratégia ativa com mix semanal;
--    true/false = escolha explícita do dono no interruptor. Aditivo: em
--    2026-10-14 a tabela marketing_ai_config estava vazia em produção, então
--    nenhuma escolha existente é perdida.
alter table public.marketing_ai_config
  alter column auto_weekly_calendar drop not null,
  alter column auto_weekly_calendar set default null;

-- 2) Ficha de imóveis: cada formato ganha
--    - surface: onde aparece (feed | stories | reels | dm) — o calendário
--      mostra feed e stories separados sem nada de setor no código;
--    - recipe: qual receita do catalog-package produz aquele formato a partir
--      de um item do catálogo (só os formatos item_package que já funcionam).
update public.vertical_playbooks vp
set config = jsonb_set(vp.config, '{content_formats}', (
  select jsonb_agg(
    f
    || jsonb_build_object('surface', case
         when f->>'key' like 'stories_%' then 'stories'
         when f->>'producer' = 'item_video' or f->>'key' like 'pov_%' then 'reels'
         when f->>'producer' = 'dm' then 'dm'
         else 'feed' end)
    || coalesce(case f->>'key'
         when 'carrossel_imovel' then '{"recipe":"carrossel_tour"}'::jsonb
         when 'detalhe_imovel' then '{"recipe":"post_detalhe_que_voce_nao_viu"}'::jsonb
         when 'o_que_rs_compra' then '{"recipe":"reels_o_que_compra_no_bairro"}'::jsonb
         when 'tres_coisas_perto' then '{"recipe":"post_3_coisas_perto"}'::jsonb
         when 'stories_enquete_pagaria' then '{"recipe":"stories_enquete_pagaria"}'::jsonb
       end, '{}'::jsonb)
    order by ord)
  from jsonb_array_elements(vp.config->'content_formats') with ordinality as t(f, ord)
))
where vp.key = 'imoveis_rio' and jsonb_typeof(vp.config->'content_formats') = 'array';
