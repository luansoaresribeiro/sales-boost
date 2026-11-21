-- C1b (dono, 21/11): trava de ASSUNTO repetido na mesma semana. Os assuntos-chave e os sinônimos são de setor, então ficam na
-- ficha (regra 6): content_rules.theme_topics = [{key, terms[]}] e content_rules.theme_week_similarity (0.6).
-- Só acrescenta (não troca o que já existe). Lido por _shared/themeDedupe.ts (parseThemeCfg / findWeekRepeat).
-- Desfazer: update public.vertical_playbooks set config = config #- '{content_rules,theme_topics}' #- '{content_rules,theme_week_similarity}'
--           where key in ('imoveis_rio','imoveis_us');

update public.vertical_playbooks
set config = jsonb_set(config, '{content_rules}', coalesce(config->'content_rules', '{}'::jsonb) || jsonb_build_object(
  'theme_week_similarity', 0.6,
  'theme_topics', $json$[
    {"key": "ITBI", "terms": ["itbi", "imposto de transmissão", "imposto de transmissao"]},
    {"key": "custos da compra", "terms": ["custos além do preço", "custos alem do preco", "custos invisíveis", "custos invisiveis", "custos da compra", "taxas da compra", "custos de cartório", "custos de cartorio"]},
    {"key": "financiamento", "terms": ["financiamento", "financiar", "fgts", "crédito imobiliário", "credito imobiliario"]},
    {"key": "documentação", "terms": ["certidão", "certidao", "certidões", "certidoes", "matrícula", "matricula", "documentação", "documentacao"]},
    {"key": "garantia do aluguel", "terms": ["garantia no aluguel", "garantia do aluguel", "fiador", "seguro fiança", "seguro fianca", "caução", "caucao"]},
    {"key": "liquidez e revenda", "terms": ["liquidez", "revenda", "revender"]},
    {"key": "IPTU", "terms": ["iptu"]},
    {"key": "condomínio", "terms": ["taxa de condomínio", "taxa de condominio", "cota condominial"]}
  ]$json$::jsonb), true)
where key = 'imoveis_rio' and (config->'content_rules'->'theme_topics') is null;

update public.vertical_playbooks
set config = jsonb_set(config, '{content_rules}', coalesce(config->'content_rules', '{}'::jsonb) || jsonb_build_object(
  'theme_week_similarity', 0.6,
  'theme_topics', $json$[
    {"key": "closing costs", "terms": ["closing costs", "closing cost", "title insurance", "transfer tax"]},
    {"key": "mortgage", "terms": ["mortgage", "pre-approval", "preapproval", "down payment", "interest rate"]},
    {"key": "HOA", "terms": ["hoa", "homeowners association"]},
    {"key": "property tax", "terms": ["property tax", "property taxes"]},
    {"key": "inspection", "terms": ["home inspection", "inspection", "appraisal"]},
    {"key": "escrow", "terms": ["escrow"]}
  ]$json$::jsonb), true)
where key = 'imoveis_us' and (config->'content_rules'->'theme_topics') is null;
