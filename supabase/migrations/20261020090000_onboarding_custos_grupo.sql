-- Pedido do dono 2026-10-20 (docs/DECISIONS.md, entrada da estratégia de
-- 2026-10-19). Só muda o JSON da ficha imoveis_rio:
--   1) pergunta nova `gasto_aquisicao` (quanto gasta por mês pra conseguir
--      clientes), no diagnóstico, logo antes de `prioridade_principal`;
--   2) `imobiliaria_parceira` (só pra corretor associado) vira "imobiliária ou
--      grupo imobiliário" e entra no diagnóstico — base do Business Game por
--      imobiliária.
-- Idempotente: não duplica `gasto_aquisicao` se rodar de novo.
-- DESFAZER:
--   update public.vertical_playbooks set config = jsonb_set(config, '{onboarding_v2,questions}', (
--     select jsonb_agg(case when q->>'key' = 'imobiliaria_parceira'
--                           then (q - 'diagnostic' - 'why') || '{"label": {"pt": "Com qual imobiliária você trabalha?"}}'::jsonb
--                           else q end order by ord)
--     from jsonb_array_elements(config->'onboarding_v2'->'questions') with ordinality as t(q, ord)
--     where q->>'key' <> 'gasto_aquisicao'))
--   where key = 'imoveis_rio';
update public.vertical_playbooks
set config = jsonb_set(config, '{onboarding_v2,questions}', (
  select jsonb_agg(x.q order by x.ord, x.sub)
  from (
    select case when q->>'key' = 'imobiliaria_parceira'
                then q || '{
                  "label": {"pt": "A que imobiliária ou grupo imobiliário você está ligado(a)?"},
                  "why": {"pt": "Os corretores da mesma imobiliária jogam juntos no Business Game."},
                  "diagnostic": true
                }'::jsonb
                else q end as q, ord, 1 as sub
    from jsonb_array_elements(config->'onboarding_v2'->'questions') with ordinality as t(q, ord)
    union all
    select '{
      "key": "gasto_aquisicao",
      "step": "prioridade",
      "type": "select",
      "label": {"pt": "Quanto você gasta por mês, hoje, pra conseguir clientes?"},
      "why": {"pt": "Some portais (ZAP, VivaReal), anúncios, fotógrafo/vídeo, social media ou agência."},
      "options": [
        {"pt": "Nada / quase nada"},
        {"pt": "Até R$ 500"},
        {"pt": "R$ 500 a R$ 2 mil"},
        {"pt": "R$ 2 mil a R$ 5 mil"},
        {"pt": "Mais de R$ 5 mil"}
      ],
      "allow": ["unknown", "later"],
      "diagnostic": true,
      "needed_for": ["estrategia"]
    }'::jsonb, ord, 0
    from jsonb_array_elements(config->'onboarding_v2'->'questions') with ordinality as t(q, ord)
    where q->>'key' = 'prioridade_principal'
      and not exists (select 1 from jsonb_array_elements(config->'onboarding_v2'->'questions') e where e->>'key' = 'gasto_aquisicao')
  ) x
))
where key = 'imoveis_rio' and jsonb_typeof(config->'onboarding_v2'->'questions') = 'array';
