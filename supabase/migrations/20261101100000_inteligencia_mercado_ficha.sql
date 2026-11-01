-- Inteligência de Mercado ampla (estágios 1-3) — ficha do setor. Aditiva e idempotente: SÓ uma chave na ficha.
-- Decisão do dono (2026-11-01): teto de US$ 5 por cliente por mês para Apify + Tavily, contado DENTRO dos US$ 40 de spendCap.
-- Sem tabela nova, sem cron, sem mudar RLS, sem apagar nada. O contador de dólar usa agent_performance (cost_usd já existe).
--
-- config.market_intel (regra 6 — nada de setor no código):
--   cap_usd              teto mensal Apify+Tavily (o secret MARKET_INTEL_CAP_USD, se existir, vale mais)
--   split                fatia de cada fonte no teto (soma <= cap; se passar, é reduzida proporcionalmente)
--   news.city            cidade usada nos tópicos {city}
--   news.topics          {kind, query{pt,en}}; kind só pode ser valor do CHECK de market_signals.kind
--                        ({region} = bairro do catálogo; {city} = cidade; tópico só com {city} vira 1 busca na rotação)
--   news.exclude_domains portais de anúncio (não são notícia)
--   news.days / max_regions / max_results / max_searches_per_day / max_searches_per_month / max_new_per_day
-- Só entra se ainda não existe (não sobrescreve ajuste feito à mão). A chave antiga config.market_news fica (histórico).
--
-- Como reverter:
--   update public.vertical_playbooks set config = config - 'market_intel' where key = 'imoveis_rio';

begin;

update public.vertical_playbooks
set config = jsonb_set(coalesce(config, '{}'::jsonb), '{market_intel}', $json${
  "cap_usd": 5,
  "split": { "instagram": 3, "news": 2 },
  "news": {
    "city": "Rio de Janeiro",
    "topics": [
      { "kind": "launch", "query": { "pt": "{region} Rio de Janeiro lançamento imobiliário", "en": "{region} Rio de Janeiro new real estate development launch" } },
      { "kind": "infrastructure", "query": { "pt": "{region} Rio de Janeiro obra OR metrô OR infraestrutura OR transporte", "en": "{region} Rio de Janeiro construction OR metro OR infrastructure OR transit" } },
      { "kind": "economy", "query": { "pt": "mercado imobiliário {city} financiamento OR juros OR vendas", "en": "{city} real estate market mortgage OR interest rates OR sales" } },
      { "kind": "tourism", "query": { "pt": "turismo {city} hotéis OR eventos OR turistas", "en": "{city} tourism hotels OR events OR tourists" } }
    ],
    "exclude_domains": ["zapimoveis.com.br", "vivareal.com.br", "imovelweb.com.br", "olx.com.br", "quintoandar.com.br", "chavesnamao.com.br", "zillow.com", "realtor.com", "redfin.com", "trulia.com"],
    "days": 30,
    "max_regions": 3,
    "max_results": 5,
    "max_searches_per_day": 8,
    "max_searches_per_month": 250,
    "max_new_per_day": 10
  }
}$json$::jsonb, true)
where key = 'imoveis_rio'
  and (config->'market_intel') is null;

commit;
