-- Agente de Dados, etapa 2: "Dicas e FAQ" com aprovação pela IA em fonte
-- oficial (decisão do dono 2026-10-14). Aditivo e idempotente. Regra 6:
-- categorias, temas e a lista de sites oficiais moram na ficha.

-- 1) Config da ficha.
update public.vertical_playbooks
set config = jsonb_set(config, '{faq}', '{
  "recheck_days": 60,
  "categories": [
    {"key": "juridico",      "label": "Jurídico"},
    {"key": "financiamento", "label": "Financiamento"},
    {"key": "documentacao",  "label": "Documentação"},
    {"key": "impostos",      "label": "Impostos e taxas"},
    {"key": "aluguel",       "label": "Aluguel"},
    {"key": "geral",         "label": "Dica geral"}
  ],
  "topics": "ITBI no Rio de Janeiro, escritura e registro no cartório, certidões do imóvel e do vendedor, uso do FGTS na compra, financiamento SFH e SFI, Minha Casa Minha Vida, IPTU e taxa de incêndio, condomínio, garantias do aluguel e Lei do Inquilinato, vistoria, documentos pra comprar e pra alugar",
  "official_domains": ["gov.br", "jus.br", "leg.br", "bcb.gov.br", "caixa.gov.br", "planalto.gov.br", "rj.gov.br", "rio.rj.gov.br", "prefeitura.rio", "carioca.rio", "fazenda.rj.gov.br", "cnj.jus.br", "registrodeimoveis.org.br", "notariado.org.br"]
}'::jsonb)
where key = 'imoveis_rio' and config->'faq' is null;

-- 2) Formato do calendário: card de pergunta e resposta com uma dica já
--    liberada (geral, aprovada pelo dono ou conferida em fonte oficial).
update public.vertical_playbooks
set config = jsonb_set(config, '{content_formats}', (config->'content_formats') || '[{"key": "dica_faq", "name": "Dica ou FAQ conferida (jurídico, financiamento, documentação)", "pillar": "educacao", "producer": "post", "status": "live", "media": "card de pergunta e resposta com a marca", "cost": "centavos"}]'::jsonb)
where key = 'imoveis_rio'
  and jsonb_typeof(config->'content_formats') = 'array'
  and not exists (select 1 from jsonb_array_elements(config->'content_formats') f where f->>'key' = 'dica_faq');

-- 3) Estratégias ativas de imóveis ganham 1 dica por semana.
update public.marketing_ai_strategies s
set content_plan = jsonb_set(s.content_plan, '{weekly_mix}', (s.content_plan->'weekly_mix') || '[{"format": "dica_faq", "name": "Dica ou FAQ conferida (jurídico, financiamento, documentação)", "producer": "post", "per_week": 1, "pillar": "educacao", "purpose": "Responder dúvidas reais de quem compra ou aluga, só com dica conferida em fonte oficial — gera confiança."}]'::jsonb)
from public.companies c
where s.company_id = c.id and c.vertical_key = 'imoveis_rio'
  and s.kind = 'main' and s.status = 'active'
  and jsonb_typeof(s.content_plan->'weekly_mix') = 'array'
  and not exists (select 1 from jsonb_array_elements(s.content_plan->'weekly_mix') m where m->>'format' = 'dica_faq');
