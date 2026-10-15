-- Imóveis: sem card genérico "tipo tweet" no calendário (dono, 2026-10-14:
-- "posts que parecem vir do fluxo antigo, como post tweet"). Aditivo e
-- idempotente. Regra 6: quem desliga é a ficha, não o código.

-- 1) A ficha desliga o formato genérico post_card: a estratégia nem vê.
update public.vertical_playbooks
set config = jsonb_set(config, '{content_rules}',
  coalesce(config->'content_rules', '{}'::jsonb) || '{"disabled_formats": ["post_card"]}'::jsonb)
where key = 'imoveis_rio'
  and not coalesce(config->'content_rules'->'disabled_formats', '[]'::jsonb) @> '["post_card"]'::jsonb;

-- 2) Estratégias ativas que já tinham post_card: a vaga vira carrossel de
--    slides (o formato novo, tipo apresentação), mesma quantidade por semana.
update public.marketing_ai_strategies s
set content_plan = jsonb_set(s.content_plan, '{weekly_mix}', (
  select jsonb_agg(case when m->>'format' = 'post_card'
    then m || '{"format": "carrossel_slides", "name": "Carrossel de slides (tipo apresentação) a partir de uma ideia ou trend"}'::jsonb
    else m end order by ord)
  from jsonb_array_elements(s.content_plan->'weekly_mix') with ordinality as t(m, ord)))
from public.companies c
where s.company_id = c.id and c.vertical_key = 'imoveis_rio'
  and s.status = 'active'
  and jsonb_typeof(s.content_plan->'weekly_mix') = 'array'
  and exists (select 1 from jsonb_array_elements(s.content_plan->'weekly_mix') m where m->>'format' = 'post_card');
