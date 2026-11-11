-- Dono (2026-11-11): "não existe postarmos uma foto perguntando quanto você pagaria nesse imóvel. Isso é um formato
-- que não deveríamos estar tendo mais." Tira o formato `stories_enquete_pagaria` da ficha imoveis_rio pelo caminho que
-- já existe (content_rules.disabled_formats — o mesmo que desligou o card "tipo tweet"): a estratégia não vê mais, o
-- plano da semana não gera, e o pacote do imóvel e a peça "story" de oportunidade não usam mais.
-- A entrada em content_formats e o código da receita ficam (histórico); só não são usados.
update vertical_playbooks set config =
  jsonb_set(jsonb_set(jsonb_set(jsonb_set(config,
    '{content_rules,disabled_formats}', coalesce(config->'content_rules'->'disabled_formats', '[]'::jsonb) || '["stories_enquete_pagaria"]'::jsonb),
    '{production_recipes,mercado,etapa_a,recipes}', '[]'::jsonb),
    '{item_package}', (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(config->'item_package') e where e <> '"stories_enquete_pagaria"'::jsonb)),
    '{opportunity_pieces,story}', (config->'opportunity_pieces'->'story') - 'item')
where key = 'imoveis_rio' and not (coalesce(config->'content_rules'->'disabled_formats', '[]'::jsonb) ? 'stories_enquete_pagaria');

-- Rollback (valores de antes, lidos em 2026-11-11):
-- update vertical_playbooks set config =
--   jsonb_set(jsonb_set(jsonb_set(jsonb_set(config,
--     '{content_rules,disabled_formats}', '["post_card","carrossel_slides"]'::jsonb),
--     '{production_recipes,mercado,etapa_a,recipes}', '["stories_enquete_pagaria"]'::jsonb),
--     '{item_package}', '["carrossel_tour","reels_tour_fotos_reais","reels_o_que_compra_no_bairro","post_detalhe_que_voce_nao_viu","post_3_coisas_perto","stories_enquete_pagaria","stories_caixa_perguntas","post_pov_pegou_a_chave"]'::jsonb),
--     '{opportunity_pieces,story}', '{"item":"stories_enquete_pagaria","text":"carrossel_educativo"}'::jsonb)
-- where key = 'imoveis_rio';
