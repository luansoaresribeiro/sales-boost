-- Inteligência de Mercado (2026-11-01): a 1ª coleta real trouxe post de rede social e site de venda de lançamentos como
-- "notícia". A ficha passa a excluir também redes sociais e sites de anúncio/venda de imóveis. Aditiva e idempotente
-- (só roda se 'threads.com' ainda não está na lista). Regra 6: a lista mora na ficha, não no código.
-- Como reverter: rodar o update com a lista anterior (ver 20261101100000_inteligencia_mercado_ficha.sql).
update public.vertical_playbooks
set config = jsonb_set(config, '{market_intel,news,exclude_domains}',
  (config #> '{market_intel,news,exclude_domains}') || '["threads.com","instagram.com","facebook.com","x.com","twitter.com","tiktok.com","youtube.com","linkedin.com","pinterest.com","kwai.com","lancamentosrj.com","imoveis.estadao.com.br","123i.com.br","imovelguide.com.br","netimoveis.com","agenteimovel.com.br","mercadolivre.com.br","casamineira.com.br","lopes.com.br","apsa.com.br","patrimovel.com.br","sergiocastro.com.br","judice.com.br"]'::jsonb)
where key = 'imoveis_rio'
  and jsonb_typeof(config #> '{market_intel,news,exclude_domains}') = 'array'
  and not ((config #> '{market_intel,news,exclude_domains}') ? 'threads.com');
