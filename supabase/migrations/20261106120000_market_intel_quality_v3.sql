-- Inteligência de Mercado, correção 2 (2026-11-05, noite) — ficha do setor, regras versão 3: "sinal forte × sinal fraco".
-- Motivo: na rodada real de 05/11 (Tespon e Teste Zero) saíram oportunidades de mercado apoiadas em aviso de serviço do metrô,
-- conteúdo patrocinado de portal de confiança, guia genérico de bairro e uma obra embargada contada como 2 fontes.
-- Domínio de confiança pulava TODAS as regras, então o patrocinado passava.
--
-- O que muda (só a ficha; o código novo já sabe ler estes campos e, sem eles, trata tudo como forte):
--   version 3 (mode continua 'enforce'; todas as regras da v2 ficam);
--   block_url_patterns += "/guia-de-bairros" (guia genérico passa a ser barrado na coleta);
--   weak_url_patterns / weak_title_terms: marcam o sinal como FRACO mesmo em domínio de confiança (patrocinado, aviso de serviço, embargo...);
--   impact_terms.infrastructure: obra/transporte só é sinal forte se o texto mostrar impacto no mercado (imóveis, moradia, procura, preço...).
-- Sinal fraco NUNCA é apagado nem barrado por isso: fica como contexto rotulado e não pode ser a base de uma oportunidade.
--
-- QUANDO APLICAR: só depois do merge do PR que traz esta migration (o merge é a aprovação do dono). NÃO foi aplicada ainda.
--
-- ROLLBACK (comentado) — volta para a ficha versão 2 exatamente como estava:
-- update public.vertical_playbooks set config = jsonb_set(config, '{market_intel,news,quality}', $json$
-- {
--  "mode": "enforce",
--  "version": 2,
--  "block_url_patterns": [
--   "/como-chegar",
--   "/imovel/",
--   "/imoveis/",
--   "/venda/",
--   "/termos",
--   "/@",
--   "/hotels/",
--   "/hotel/",
--   "/store/apps"
--  ],
--  "block_title_terms": [
--   "para venda",
--   "imóveis encontrados",
--   "m² privativos",
--   "termos de uso",
--   "vaga de emprego",
--   "como chegar",
--   "tudo sobre o bairro",
--   "descubra a magia",
--   "totalmente reformado",
--   "bedrooms",
--   "| lançamento",
--   "| lançamentos rj",
--   "vale-transporte",
--   "depósito de bagagem",
--   "google play"
--  ],
--  "block_title_all": [
--   [
--    "quartos",
--    "venda"
--   ],
--   [
--    "quarto",
--    "venda"
--   ],
--   [
--    "quartos",
--    "aluguel"
--   ],
--   [
--    "quarto",
--    "aluguel"
--   ],
--   [
--    "suítes",
--    "venda"
--   ],
--   [
--    "apartamento",
--    "quartos",
--    "venda"
--   ],
--   [
--    "apartamento",
--    "m²",
--    "venda"
--   ],
--   [
--    "à venda",
--    "m²"
--   ],
--   [
--    "à venda",
--    "quartos"
--   ],
--   [
--    "à venda",
--    "quarto"
--   ],
--   [
--    "à venda",
--    "apartamento"
--   ],
--   [
--    "à venda",
--    "cobertura"
--   ],
--   [
--    "à venda",
--    "casa"
--   ],
--   [
--    "à venda",
--    "flat"
--   ],
--   [
--    "m²",
--    "suítes"
--   ],
--   [
--    "imóveis em",
--    "lançamentos rj"
--   ],
--   [
--    "apto",
--    "rio de janeiro"
--   ],
--   [
--    "quartos",
--    "suíte"
--   ],
--   [
--    "quarto",
--    "suíte"
--   ],
--   [
--    "a partir de",
--    "r$"
--   ],
--   [
--    "venda em",
--    "studio"
--   ],
--   [
--    "estação",
--    "exposição"
--   ]
--  ],
--  "news_title_terms": [
--   "sobe",
--   "sobem",
--   "cai",
--   "caem",
--   "diz",
--   "dizem",
--   "lidera",
--   "mais caro",
--   "mais barato",
--   "fipezap",
--   "aponta",
--   "revela",
--   "cresce",
--   "dispara",
--   "recua",
--   "segundo",
--   "anuncia",
--   "lança",
--   "ganha",
--   "ganham",
--   "esgota"
--  ],
--  "min_summary_chars": 40,
--  "kind_terms": {
--   "infrastructure": [
--    "obra",
--    "obras",
--    "metrô",
--    "metro",
--    "brt",
--    "vlt",
--    "estação",
--    "estações",
--    "trem",
--    "transporte",
--    "mobilidade",
--    "infraestrutura",
--    "túnel",
--    "ciclovia",
--    "saneamento",
--    "viaduto",
--    "ponte",
--    "ônibus",
--    "trânsito",
--    "pavimentação",
--    "urbanização",
--    "revitalização"
--   ],
--   "tourism": [
--    "turismo",
--    "turista",
--    "turistas",
--    "hotel",
--    "hotéis",
--    "hospedagem",
--    "evento",
--    "eventos",
--    "festival",
--    "réveillon",
--    "reveillon",
--    "carnaval",
--    "voo",
--    "voos",
--    "aeroporto",
--    "cruzeiro",
--    "visitantes",
--    "gastronomia",
--    "rock in rio",
--    "show",
--    "shows"
--   ],
--   "economy": [
--    "juros",
--    "financiamento",
--    "inflação",
--    "aluguel",
--    "aluguéis",
--    "preço",
--    "preços",
--    "mercado",
--    "selic",
--    "crédito",
--    "vendas",
--    "economia",
--    "taxa",
--    "taxas",
--    "índice",
--    "fipezap",
--    "imobiliário",
--    "imobiliária",
--    "valorização"
--   ]
--  },
--  "max_per_host_per_run": 2,
--  "trusted_domains": [
--   "oglobo.globo.com",
--   "folha.uol.com.br",
--   "vejario.abril.com.br",
--   "riotur.rio",
--   "metrocptm.com.br",
--   "panrotas.com.br",
--   "valor.globo.com",
--   "g1.globo.com",
--   "estadao.com.br",
--   "exame.com",
--   "infomoney.com.br",
--   "cnnbrasil.com.br",
--   "extra.globo.com",
--   "odia.ig.com.br"
--  ],
--  "min_score": null
-- }
-- $json$::jsonb), updated_at = now() where key = 'imoveis_rio';

update public.vertical_playbooks
set config = jsonb_set(config, '{market_intel,news,quality}', $json$
{
 "mode": "enforce",
 "version": 3,
 "block_url_patterns": [
  "/como-chegar",
  "/imovel/",
  "/imoveis/",
  "/venda/",
  "/termos",
  "/@",
  "/hotels/",
  "/hotel/",
  "/store/apps",
  "/guia-de-bairros"
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
 "min_score": null,
 "weak_url_patterns": [
  "/conteudo-de-marca/",
  "/patrocinado",
  "/publieditorial",
  "/especial-publicitario",
  "/guia-de-bairros",
  "/guia-de-bairro"
 ],
 "weak_title_terms": [
  "funcionamento",
  "neste fim de semana",
  "fim de semana",
  "destinos diferentes",
  "esquema especial",
  "horário especial",
  "embarga",
  "embargada",
  "embargo",
  "interdição",
  "interditada",
  "acidente",
  "incêndio",
  "assalto"
 ],
 "impact_terms": {
  "infrastructure": [
   "valoriza",
   "imóve",
   "imobili",
   "moradia",
   "morador",
   "procura",
   "demanda",
   "preço",
   "metro quadrado",
   "m²",
   "empreendimento",
   "lançamento",
   "incorporação",
   "acesso ao bairro",
   "novos moradores",
   "mercado"
  ]
 }
}
$json$::jsonb),
  updated_at = now()
where key = 'imoveis_rio';
