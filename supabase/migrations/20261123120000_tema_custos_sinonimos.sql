-- C1b, correção de 23/11 (revisão semanal): o plano de 22/11 repetiu "custos" na mesma semana porque "custos ocultos" e
-- "custos reais" não estavam entre os sinônimos do assunto "custos da compra". Só ACRESCENTA termos (regra 6: setor na ficha).
-- Desfazer: tirar os termos novos da lista "custos da compra" de content_rules.theme_topics (imoveis_rio).
update public.vertical_playbooks v
set config = jsonb_set(v.config, '{content_rules,theme_topics}', (
  select jsonb_agg(
    case when e.t->>'key' = 'custos da compra'
      then jsonb_set(e.t, '{terms}', (select jsonb_agg(distinct x) from jsonb_array_elements_text((e.t->'terms') || $json$["custos ocultos", "custos reais", "custos escondidos", "custo real da compra", "quanto custa comprar"]$json$::jsonb) x))
      else e.t end order by e.ord)
  from jsonb_array_elements(v.config->'content_rules'->'theme_topics') with ordinality as e(t, ord)))
where v.key = 'imoveis_rio' and jsonb_typeof(v.config->'content_rules'->'theme_topics') = 'array';
