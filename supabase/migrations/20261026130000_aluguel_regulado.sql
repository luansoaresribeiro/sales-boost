-- Aluguel vira tema regulado no carrossel educativo (decisão do dono, 2026-10-26): carrossel de
-- aluguel (Lei do Inquilinato, fiador, caução, reajuste…) usa só dica liberada do dica_faq daquela
-- categoria; sem dica liberada, sai como dica geral sem número, prazo, taxa nem nome de lei.
-- Aditivo e idempotente. Só UPDATE em vertical_playbooks key='imoveis_rio' (regra 6). Depende da
-- 20261026120000_carrossel_educativo_unico (só age se regulated_categories já existe).
--
-- REVERTER (rodar cada UPDATE sozinho, nada de dado de cliente é tocado):
--   update public.vertical_playbooks set config = jsonb_set(config, '{faq,regulated_categories}', (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(config->'faq'->'regulated_categories') x where x <> '"aluguel"'::jsonb)) where key = 'imoveis_rio' and jsonb_typeof(config->'faq'->'regulated_categories') = 'array';
--   update public.vertical_playbooks set config = jsonb_set(config, '{content_formats}', (select jsonb_agg(case when f->>'key' = 'carrossel_educativo' then f || '{"notes": "tema jurídico, de financiamento, documentação ou impostos usa só dica conferida; tema leve é livre"}'::jsonb else f end order by ord) from jsonb_array_elements(config->'content_formats') with ordinality as t(f, ord))) where key = 'imoveis_rio' and jsonb_typeof(config->'content_formats') = 'array';

-- 1) aluguel entra nas categorias reguladas.
update public.vertical_playbooks
set config = jsonb_set(config, '{faq,regulated_categories}',
  (config->'faq'->'regulated_categories') || '["aluguel"]'::jsonb)
where key = 'imoveis_rio'
  and jsonb_typeof(config->'faq'->'regulated_categories') = 'array'
  and not (config->'faq'->'regulated_categories') @> '["aluguel"]'::jsonb;

-- 2) A nota do formato (que a estratégia lê no catálogo) passa a citar aluguel.
update public.vertical_playbooks
set config = jsonb_set(config, '{content_formats}', (
  select jsonb_agg(case when f->>'key' = 'carrossel_educativo'
    then f || '{"notes": "tema jurídico, de financiamento, documentação, impostos ou aluguel usa só dica conferida; tema leve é livre"}'::jsonb
    else f end order by ord)
  from jsonb_array_elements(config->'content_formats') with ordinality as t(f, ord)))
where key = 'imoveis_rio'
  and jsonb_typeof(config->'content_formats') = 'array'
  and exists (select 1 from jsonb_array_elements(config->'content_formats') f
              where f->>'key' = 'carrossel_educativo' and (f->>'notes') is distinct from 'tema jurídico, de financiamento, documentação, impostos ou aluguel usa só dica conferida; tema leve é livre');
