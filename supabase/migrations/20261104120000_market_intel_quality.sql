-- Inteligência de Mercado, Fase 2 (2026-11-04) — filtro de qualidade na FICHA do setor (regra 6: nada de setor no código).
-- Aditiva e idempotente: SÓ a chave config.market_intel.news.quality (e domínios novos em exclude_domains), e só onde `quality` ainda não existe
-- (não sobrescreve ajuste feito à mão). Modo inicial 'audit': o sistema só conta e registra o que reprovaria; nada é ignorado até alguém
-- trocar mode para 'enforce' na ficha. Os domínios novos em exclude_domains valem desde já (a Tavily nem devolve esses sites).
--
-- Origem das regras: medição de 04/11/2026 em 47 sinais automáticos (Tespon + Teste Zero, todos Tavily): ~60% eram anúncios avulsos de
-- imobiliárias, páginas sem valor (mapa de transporte, enciclopédia, passagens, vaga de emprego, termos de uso) ou tipo errado.
--
--   mode                  off | audit | enforce
--   version               sobe quando as regras mudam; sinais com versão menor são reavaliados pela reclassificação
--   block_url_patterns    trecho do CAMINHO da URL que indica página de anúncio/utilidade
--   block_title_terms     termo solto no título (sem acento/caixa; borda de palavra só nas letras)
--   block_title_all       grupos de termos: bloqueia se o título tiver TODOS os do grupo (E) — sem regex na ficha; mire o ANÚNCIO (termo de oferta junto), não o tema
--   news_title_terms      sinal de notícia no título ("sobe", "diz", "fipezap"...): libera as regras de título (as de endereço continuam)
--   min_summary_chars     resumo mais curto que isso = página vazia
--   kind_terms            por tipo: o título/resumo precisa citar ao menos um termo (tipo sem lista = livre)
--   max_per_host_per_run  no máx. N sinais do mesmo site por rodada de coleta
--   trusted_domains       portais de notícia que passam pelas regras de bloqueio
--   min_score             nota mínima da Tavily (null = não filtra)
--
-- Como reverter (comentado):
--   update public.vertical_playbooks set config = config #- '{market_intel,news,quality}' where key = 'imoveis_rio';
--   (os domínios acrescentados em exclude_domains podem ficar; para tirar, edite a lista na ficha)

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
          || '["moovitapp.com", "moovit.com", "wikipedia.org", "skyscanner.gg", "threads.com", "catho.com.br", "apto.vc"]'::jsonb
        ) as t(d)
      ) u
    ),
    true
  ),
  '{market_intel,news,quality}',
  $json${
  "mode": "audit",
  "version": 1,
  "block_url_patterns": ["/como-chegar", "/imovel/", "/imoveis/", "/venda/", "/termos"],
  "block_title_terms": [
    "para venda", "imóveis encontrados", "m² privativos", "termos de uso", "vaga de emprego",
    "como chegar", "tudo sobre o bairro", "descubra a magia", "totalmente reformado"
  ],
  "block_title_all": [
    ["quartos", "venda"], ["quarto", "venda"], ["quartos", "aluguel"], ["quarto", "aluguel"], ["suítes", "venda"],
    ["apartamento", "quartos", "venda"], ["apartamento", "m²", "venda"],
    ["à venda", "m²"], ["à venda", "quartos"], ["à venda", "quarto"], ["à venda", "apartamento"], ["à venda", "cobertura"], ["à venda", "casa"], ["à venda", "flat"],
    ["m²", "suítes"], ["imóveis em", "lançamentos rj"], ["apto", "rio de janeiro"]
  ],
  "news_title_terms": [
    "sobe", "sobem", "cai", "caem", "diz", "dizem", "lidera", "mais caro", "mais barato", "fipezap",
    "aponta", "revela", "cresce", "dispara", "recua", "segundo"
  ],
  "min_summary_chars": 40,
  "kind_terms": {
    "infrastructure": [
      "obra", "obras", "metrô", "metro", "brt", "vlt", "estação", "estações", "trem", "transporte", "mobilidade", "infraestrutura",
      "túnel", "ciclovia", "saneamento", "viaduto", "ponte", "ônibus", "trânsito", "pavimentação", "urbanização", "revitalização"
    ],
    "tourism": [
      "turismo", "turista", "turistas", "hotel", "hotéis", "hospedagem", "evento", "eventos", "festival", "réveillon", "reveillon", "carnaval",
      "voo", "voos", "aeroporto", "cruzeiro", "visitantes", "gastronomia", "rock in rio", "show", "shows"
    ],
    "economy": [
      "juros", "financiamento", "inflação", "aluguel", "aluguéis", "preço", "preços", "mercado", "selic", "crédito", "vendas", "economia",
      "taxa", "taxas", "índice", "fipezap", "imobiliário", "imobiliária", "valorização"
    ]
  },
  "max_per_host_per_run": 2,
  "trusted_domains": [
    "oglobo.globo.com", "folha.uol.com.br", "vejario.abril.com.br", "riotur.rio", "metrocptm.com.br", "panrotas.com.br",
    "valor.globo.com", "g1.globo.com", "estadao.com.br", "exame.com", "infomoney.com.br", "cnnbrasil.com.br", "extra.globo.com", "odia.ig.com.br"
  ],
  "min_score": null
}$json$::jsonb,
  true
)
where key = 'imoveis_rio'
  and (config #> '{market_intel,news}') is not null
  and (config #> '{market_intel,news,quality}') is null;

commit;
