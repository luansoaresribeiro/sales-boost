-- Etapa 3 da Inteligência comercial — notícias de mercado AUTOMÁTICAS (collected_by='system').
-- Aditiva e idempotente: um índice e uma chave na ficha. Sem cron, sem mudar RLS, sem apagar nada.
--
-- market_signals_system_url_uq = a mesma notícia (mesmo link) não entra duas vezes para a mesma empresa. Vale só para
--                     sinais do sistema: o que o dono cola à mão não é afetado.
-- Ficha do setor (regra 6 — nada de setor no código): imoveis_rio ganha config.market_news
--   queries          busca por idioma; {region} vira o bairro do catálogo
--   exclude_domains  portais de anúncio (não são notícia)
--   days / max_regions / max_results / max_new_per_week  janela e limites da coleta
-- Só entra se ainda não existe (não sobrescreve ajuste feito à mão). Setor sem a chave = a coleta não roda.
--
-- Como reverter (os sinais já gravados continuam; apague pela tela ou com delete ... where collected_by='system'):
--   drop index if exists public.market_signals_system_url_uq;
--   update public.vertical_playbooks set config = config - 'market_news' where key = 'imoveis_rio';

begin;

create unique index if not exists market_signals_system_url_uq
  on public.market_signals (company_id, source_url) where collected_by = 'system';

update public.vertical_playbooks
set config = jsonb_set(coalesce(config, '{}'::jsonb), '{market_news}', $json${
  "queries": {
    "pt": "{region} Rio de Janeiro imóveis OR obra OR metrô OR lançamento OR infraestrutura",
    "en": "{region} real estate OR development OR transit"
  },
  "exclude_domains": ["zapimoveis.com.br", "vivareal.com.br", "imovelweb.com.br", "olx.com.br", "quintoandar.com.br", "chavesnamao.com.br", "zillow.com", "realtor.com", "redfin.com", "trulia.com"],
  "days": 30,
  "max_regions": 3,
  "max_results": 5,
  "max_new_per_week": 5
}$json$::jsonb, true)
where key = 'imoveis_rio'
  and (config->'market_news') is null;

commit;
