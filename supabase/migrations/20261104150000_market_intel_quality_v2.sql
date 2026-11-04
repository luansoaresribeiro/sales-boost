-- Inteligência de Mercado, Fase 2 — gate de qualidade (2026-11-04): filtro da ficha passa de 'audit' para 'enforce', regras versão 2.
-- Decisão do dono em 04/11/2026 ("Ativar e apertar"), registrada em docs/DECISIONS.md ("Gate da Fase 2").
--
-- Medição que sustenta a troca (67 sinais automáticos já gravados, Tespon + Teste Zero, classificados à mão em 04/11):
--   v1: barrava 33, todos lixo (0 notícia boa barrada); deixava passar 13 lixos (anúncio de lançamento sem "venda" no título,
--       Booking/Skyscanner, app de shopping, depósito de bagagem, tabela de vale-transporte, post do Threads).
--   v2: barra os 46 lixos e mantém os 21 sinais úteis ou duvidosos (0 notícia boa barrada). scripts/test-market-news.mjs
--       trava essas amostras e 10 manchetes de notícia que precisam continuar passando.
--
-- O que muda (só a ficha; nenhum código):
--   mode 'enforce' + version 2 → a reclassificação diária marca os reprovados como ignorados pelo sistema
--     (meta.ignored=true, ignored_by='system'); nada é apagado, e o dono pode restaurar (owner_restored nunca é reignorado).
--   regras novas: caminhos "/@" (perfil de rede social), "/hotels/", "/hotel/", "/store/apps"; termos "bedrooms", "| lançamento",
--     "| lançamentos rj", "vale-transporte", "depósito de bagagem", "google play"; grupos quartos+suíte, quarto+suíte,
--     "a partir de"+"r$", "venda em"+"studio", estação+exposição; termos de notícia "anuncia", "lança", "ganha", "ganham", "esgota".
--   exclude_domains (a Tavily nem devolve): booking.com, radicalstorage.com, play.google.com, otimizapro.com, skyscanner.com,
--     skyscanner.com.br, tripadvisor.com, tripadvisor.com.br, airbnb.com, airbnb.com.br.
-- Só troca a ficha se ela ainda estiver na versão 1 (não sobrescreve ajuste feito à mão depois).
--
-- Como reverter (comentado) — volta a só observar, sem perder as regras novas:
--   update public.vertical_playbooks set config = jsonb_set(config, '{market_intel,news,quality,mode}', '"audit"') where key = 'imoveis_rio';
--   e, para devolver os sinais que o sistema ignorou:
--   update public.market_signals set meta = meta - 'ignored' - 'ignored_at' - 'ignored_by' where meta->>'ignored_by' = 'system';

begin;

update public.vertical_playbooks
set config = jsonb_set(
  jsonb_set(
    config,
    '{market_intel,news,exclude_domains}',
    (
      select coalesce(jsonb_agg(d order by d), '[]'::jsonb)
      from (
        select distinct d
        from jsonb_array_elements_text(
          coalesce(config #> '{market_intel,news,exclude_domains}', '[]'::jsonb)
          || '["booking.com", "radicalstorage.com", "play.google.com", "otimizapro.com", "skyscanner.com", "skyscanner.com.br", "tripadvisor.com", "tripadvisor.com.br", "airbnb.com", "airbnb.com.br"]'::jsonb
        ) as t(d)
      ) u
    ),
    true
  ),
  '{market_intel,news,quality}',
  $json$
{
 "mode": "enforce",
 "version": 2,
 "block_url_patterns": [
  "/como-chegar",
  "/imovel/",
  "/imoveis/",
  "/venda/",
  "/termos",
  "/@",
  "/hotels/",
  "/hotel/",
  "/store/apps"
 ],
 "block_title_terms": [
  "para venda",
  "imóveis encontrados",
  "m² privativos",
  "termos de uso",
  "vaga de emprego",
  "como chegar",
  "tudo sobre o bairro",
  "descubra a magia",
  "totalmente reformado",
  "bedrooms",
  "| lançamento",
  "| lançamentos rj",
  "vale-transporte",
  "depósito de bagagem",
  "google play"
 ],
 "block_title_all": [
  [
   "quartos",
   "venda"
  ],
  [
   "quarto",
   "venda"
  ],
  [
   "quartos",
   "aluguel"
  ],
  [
   "quarto",
   "aluguel"
  ],
  [
   "suítes",
   "venda"
  ],
  [
   "apartamento",
   "quartos",
   "venda"
  ],
  [
   "apartamento",
   "m²",
   "venda"
  ],
  [
   "à venda",
   "m²"
  ],
  [
   "à venda",
   "quartos"
  ],
  [
   "à venda",
   "quarto"
  ],
  [
   "à venda",
   "apartamento"
  ],
  [
   "à venda",
   "cobertura"
  ],
  [
   "à venda",
   "casa"
  ],
  [
   "à venda",
   "flat"
  ],
  [
   "m²",
   "suítes"
  ],
  [
   "imóveis em",
   "lançamentos rj"
  ],
  [
   "apto",
   "rio de janeiro"
  ],
  [
   "quartos",
   "suíte"
  ],
  [
   "quarto",
   "suíte"
  ],
  [
   "a partir de",
   "r$"
  ],
  [
   "venda em",
   "studio"
  ],
  [
   "estação",
   "exposição"
  ]
 ],
 "news_title_terms": [
  "sobe",
  "sobem",
  "cai",
  "caem",
  "diz",
  "dizem",
  "lidera",
  "mais caro",
  "mais barato",
  "fipezap",
  "aponta",
  "revela",
  "cresce",
  "dispara",
  "recua",
  "segundo",
  "anuncia",
  "lança",
  "ganha",
  "ganham",
  "esgota"
 ],
 "min_summary_chars": 40,
 "kind_terms": {
  "infrastructure": [
   "obra",
   "obras",
   "metrô",
   "metro",
   "brt",
   "vlt",
   "estação",
   "estações",
   "trem",
   "transporte",
   "mobilidade",
   "infraestrutura",
   "túnel",
   "ciclovia",
   "saneamento",
   "viaduto",
   "ponte",
   "ônibus",
   "trânsito",
   "pavimentação",
   "urbanização",
   "revitalização"
  ],
  "tourism": [
   "turismo",
   "turista",
   "turistas",
   "hotel",
   "hotéis",
   "hospedagem",
   "evento",
   "eventos",
   "festival",
   "réveillon",
   "reveillon",
   "carnaval",
   "voo",
   "voos",
   "aeroporto",
   "cruzeiro",
   "visitantes",
   "gastronomia",
   "rock in rio",
   "show",
   "shows"
  ],
  "economy": [
   "juros",
   "financiamento",
   "inflação",
   "aluguel",
   "aluguéis",
   "preço",
   "preços",
   "mercado",
   "selic",
   "crédito",
   "vendas",
   "economia",
   "taxa",
   "taxas",
   "índice",
   "fipezap",
   "imobiliário",
   "imobiliária",
   "valorização"
  ]
 },
 "max_per_host_per_run": 2,
 "trusted_domains": [
  "oglobo.globo.com",
  "folha.uol.com.br",
  "vejario.abril.com.br",
  "riotur.rio",
  "metrocptm.com.br",
  "panrotas.com.br",
  "valor.globo.com",
  "g1.globo.com",
  "estadao.com.br",
  "exame.com",
  "infomoney.com.br",
  "cnnbrasil.com.br",
  "extra.globo.com",
  "odia.ig.com.br"
 ],
 "min_score": null
}$json$::jsonb,
  true
)
where key = 'imoveis_rio'
  and (config #>> '{market_intel,news,quality,version}') = '1';

commit;
