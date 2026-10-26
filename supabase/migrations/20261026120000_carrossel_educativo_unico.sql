-- Carrossel educativo único (PLANO-CRIATIVOS, decisão C da "Análise 2026-10-22"): junta
-- carrossel_slides (genérico) e carrossel_educativo (ficha) num formato só. Tema regulado
-- (jurídico, financiamento, documentação, impostos) usa só dica liberada do dica_faq; sem dica
-- liberada vira dica geral sem número/lei; tema leve segue livre com a trava de números.
-- Aditivo e idempotente. Só UPDATE em vertical_playbooks key='imoveis_rio' (regra 6: setor vive
-- na ficha). NÃO mexe em weekly_mix de nenhuma estratégia: o apelido (format_aliases) faz a vaga
-- antiga "carrossel_slides" sair como "carrossel_educativo".
--
-- DECISÃO PENDENTE DO DONO: "aluguel" e "geral" ficam como tema LEVE (não estão em
-- regulated_categories). Os termos de aluguel mais sensíveis (Lei do Inquilinato, Código Civil…)
-- continuam em regulated_terms e acionam a rede de segurança. Se o dono quiser aluguel como tema
-- regulado, é só acrescentar "aluguel" em config.faq.regulated_categories.
--
-- REVERTER (rodar cada UPDATE sozinho, nesta ordem; nada de dado de cliente é tocado):
--   update public.vertical_playbooks set config = jsonb_set(config, '{faq}', (config->'faq') - 'regulated_categories' - 'category_terms' - 'regulated_terms') where key = 'imoveis_rio' and config->'faq' is not null;
--   update public.vertical_playbooks set config = jsonb_set(config, '{content_rules}', (config->'content_rules') - 'format_aliases') where key = 'imoveis_rio' and config->'content_rules' is not null;
--   update public.vertical_playbooks set config = jsonb_set(config, '{content_rules,disabled_formats}', (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(config->'content_rules'->'disabled_formats') x where x <> '"carrossel_slides"'::jsonb)) where key = 'imoveis_rio' and jsonb_typeof(config->'content_rules'->'disabled_formats') = 'array';
--   update public.vertical_playbooks set config = jsonb_set(config, '{content_formats}', (select jsonb_agg(case when f->>'key' = 'carrossel_educativo' then (f - 'notes' - 'media' - 'cost' - 'family') || '{"name": "Carrossel educativo (financiamento, documentação)", "status": "planned"}'::jsonb else f end order by ord) from jsonb_array_elements(config->'content_formats') with ordinality as t(f, ord))) where key = 'imoveis_rio' and jsonb_typeof(config->'content_formats') = 'array';

-- 1) O formato da ficha sai de "planned" e vira o carrossel educativo (live). A estratégia passa
--    a vê-lo no catálogo e pode colocá-lo no mix.
update public.vertical_playbooks
set config = jsonb_set(config, '{content_formats}', (
  select jsonb_agg(case when f->>'key' = 'carrossel_educativo'
    then f || '{"name": "Carrossel educativo (dicas conferidas; tema leve livre)", "pillar": "educacao", "producer": "post", "status": "live", "family": "educativo", "media": "slides de texto com a marca (sem foto)", "cost": "centavos", "notes": "tema jurídico, de financiamento, documentação ou impostos usa só dica conferida; tema leve é livre"}'::jsonb
    else f end order by ord)
  from jsonb_array_elements(config->'content_formats') with ordinality as t(f, ord)))
where key = 'imoveis_rio'
  and jsonb_typeof(config->'content_formats') = 'array'
  and exists (select 1 from jsonb_array_elements(config->'content_formats') f where f->>'key' = 'carrossel_educativo');

-- 2) O genérico carrossel_slides sai do catálogo desta ficha (junto do post_card que já estava).
update public.vertical_playbooks
set config = jsonb_set(config, '{content_rules}',
  coalesce(config->'content_rules', '{}'::jsonb) || jsonb_build_object('disabled_formats',
    coalesce(config->'content_rules'->'disabled_formats', '[]'::jsonb) || '["carrossel_slides"]'::jsonb))
where key = 'imoveis_rio'
  and not coalesce(config->'content_rules'->'disabled_formats', '[]'::jsonb) @> '["carrossel_slides"]'::jsonb;

-- 3) Apelido: vaga/estratégia antiga com "carrossel_slides" sai como "carrossel_educativo".
update public.vertical_playbooks
set config = jsonb_set(config, '{content_rules}',
  coalesce(config->'content_rules', '{}'::jsonb) || jsonb_build_object('format_aliases',
    coalesce(config->'content_rules'->'format_aliases', '{}'::jsonb) || '{"carrossel_slides": "carrossel_educativo"}'::jsonb))
where key = 'imoveis_rio'
  and (config->'content_rules'->'format_aliases'->>'carrossel_slides') is distinct from 'carrossel_educativo';

-- 4) Ficha do dica_faq: categorias reguladas, termos que classificam o tema e termos que
--    carregam fato regulado (comparação sem acento nem maiúscula). Só entra se ainda não existe,
--    pra não sobrescrever ajuste feito depois pelo dono.
update public.vertical_playbooks
set config = jsonb_set(config, '{faq}', (config->'faq') || $json${
  "regulated_categories": ["juridico", "financiamento", "documentacao", "impostos"],
  "category_terms": {
    "juridico": ["jurídico", "contrato", "advogado", "usucapião", "inventário", "herança", "procuração", "distrato", "compra e venda", "penhora", "alienação fiduciária", "dívida", "ação judicial", "direitos do comprador"],
    "financiamento": ["financiamento", "financiar", "crédito imobiliário", "juros", "taxa de juros", "parcela", "entrada", "amortização", "simulação", "SFH", "SFI", "FGTS", "Minha Casa Minha Vida", "Caixa", "score", "carência", "consórcio", "Tabela Price", "SAC"],
    "documentacao": ["documentação", "documentos", "certidão", "certidões", "matrícula", "escritura", "registro de imóveis", "cartório", "registro", "habite-se", "averbação", "certidão negativa"],
    "impostos": ["ITBI", "ITCMD", "IPTU", "imposto", "impostos", "taxas e impostos", "ganho de capital", "imposto de renda", "laudêmio", "taxa de incêndio", "tributo", "isenção", "alíquota"],
    "aluguel": ["aluguel", "alugar", "locação", "inquilino", "inquilinato", "locatário", "locador", "fiador", "caução", "seguro fiança", "título de capitalização", "contrato de locação"],
    "geral": ["visita", "visitar", "vistoria", "decoração", "mudança", "reforma", "primeiro imóvel", "primeira vez"]
  },
  "regulated_terms": ["ITBI", "ITCMD", "IPTU", "FGTS", "SFH", "SFI", "Minha Casa Minha Vida", "Lei do Inquilinato", "Código Civil", "Código de Defesa do Consumidor", "alíquota", "Selic", "CET", "laudêmio", "Tabela Price", "ganho de capital", "imposto de renda", "taxa de incêndio", "usucapião", "alienação fiduciária"]
}$json$::jsonb)
where key = 'imoveis_rio'
  and config->'faq' is not null
  and (config->'faq'->'regulated_categories') is null;
