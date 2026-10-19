-- /setup removido (decisão do dono 2026-10-19, docs/DECISIONS.md): as perguntas
-- essenciais passam a ser feitas já no diagnóstico (criação da conta). Marca
-- `diagnostic: true` em 4 perguntas da ficha imoveis_rio; as outras continuam
-- em Configurações e o sino cobra o que faltar. Só muda o JSON da ficha.
-- DESFAZER: rodar o mesmo update trocando `q || '{"diagnostic": true}'` por
--   `q - 'diagnostic'`.
update public.vertical_playbooks
set config = jsonb_set(config, '{onboarding_v2,questions}', (
  select jsonb_agg(case when q->>'key' in ('creci', 'tipos_imovel', 'faixa_preco', 'publico')
                        then q || '{"diagnostic": true}'::jsonb else q end order by ord)
  from jsonb_array_elements(config->'onboarding_v2'->'questions') with ordinality as t(q, ord)
))
where key = 'imoveis_rio' and jsonb_typeof(config->'onboarding_v2'->'questions') = 'array';
