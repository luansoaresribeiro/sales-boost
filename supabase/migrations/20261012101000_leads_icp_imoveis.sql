-- Agente de leads do Owner voltado pro setor de imóveis (pedido do dono
-- 2026-10-11): imobiliárias, corretores(as) e aluguel por temporada (Airbnb).
-- As palavras-chave antigas (moda, beleza, e-commerce, escritórios) ficam
-- desligadas, não apagadas — dá pra religar em Configurações de Leads.

update prospect_search_keywords set active = false
where business_type not in ('Imobiliárias', 'Corretores de imóveis', 'Aluguel por temporada (Airbnb)');

insert into prospect_search_keywords (business_type, keyword, active)
select v.t, v.k, true from (values
  ('Imobiliárias', 'imobiliária'),
  ('Imobiliárias', 'imobiliária de alto padrão'),
  ('Imobiliárias', 'imobiliária de lançamentos'),
  ('Imobiliárias', 'venda de apartamentos'),
  ('Corretores de imóveis', 'corretor de imóveis'),
  ('Corretores de imóveis', 'corretora de imóveis'),
  ('Corretores de imóveis', 'consultor imobiliário'),
  ('Aluguel por temporada (Airbnb)', 'aluguel por temporada'),
  ('Aluguel por temporada (Airbnb)', 'administração de imóveis por temporada'),
  ('Aluguel por temporada (Airbnb)', 'gestão de airbnb'),
  ('Aluguel por temporada (Airbnb)', 'apartamento por temporada')
) as v(t, k)
where not exists (select 1 from prospect_search_keywords x where x.business_type = v.t and x.keyword = v.k);

update prospect_settings set
  business_types = array['Imobiliárias', 'Corretores de imóveis', 'Aluguel por temporada (Airbnb)'],
  min_rating = 4.0, max_rating = 5.0, min_reviews = 5, max_reviews = 1000,
  require_active_instagram = true, require_phone = true, exclude_chains = true,
  icp_confidence_threshold = 60,
  scoring_weights = '{"rating_in_range":20,"reviews_in_range":10,"instagram_active":30,"has_website":10,"no_online_ordering":0,"has_phone":15,"independent_business":10,"recent_review":5,"likely_chain_penalty":-40}'::jsonb,
  icp_custom_instructions = $icp$Perfil de cliente ideal (ICP) do Sales Boost — setor de imóveis

Missão: achar quem tem MAIS chance de virar cliente pagante. Qualidade acima de quantidade: melhor 10 leads ótimos do que 100 fracos. Na dúvida, rejeite.

O que o Sales Boost resolve: transforma o Instagram em canal de vendas de imóveis — cria vídeos e posts com as fotos reais dos imóveis, publica com "Comente QUERO", responde quem comenta na DM na hora e entrega o contato pro dono. Tudo com aprovação do dono.

Quem priorizar:
1. Imobiliárias independentes (uma ou poucas unidades), com dono que decide rápido.
2. Corretores(as) de imóveis autônomos com marca própria.
3. Quem administra imóveis de aluguel por temporada (Airbnb), anfitriões com vários imóveis ou empresas pequenas de gestão de temporada.

Sinais que aumentam a chance:
- Instagram ativo, mas com posts irregulares, sem vídeo, ou fotos sem chamada pra ação.
- Imóveis bons pra mostrar (alto padrão, vista, lançamentos, temporada em área turística).
- Telefone/WhatsApp público e site ou página própria.
- Boas avaliações no Google (4 estrelas ou mais).

Rejeite:
- Redes e franquias grandes de imobiliárias, portais de anúncio, construtoras/incorporadoras grandes, hotéis e pousadas de rede.
- Órgãos públicos, cartórios, condomínios/administradoras de condomínio, empresas sem contato público ou fechadas.
- Qualquer coisa fora de imobiliária, corretor(a) ou aluguel por temporada.$icp$,
  updated_at = now();
