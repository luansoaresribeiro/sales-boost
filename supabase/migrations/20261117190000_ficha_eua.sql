-- E1 (dono, 17/11: "Abrir os EUA agora" + "pode") — ficha dos EUA `imoveis_us`, separada da do Rio.
-- Só ACRESCENTA: uma ficha nova e um tipo de negócio novo. A ficha do Rio e as contas existentes não mudam.
-- Ponto de partida = estrutura da `imoveis_rio` (mesmas chaves de campo do imóvel — bairro, preco, quartos, m2 — porque o
-- código lê essas chaves); por cima, tudo que é do Brasil vira dos EUA: idioma, moeda, tom, chamadas, FAQ, notícias,
-- licença do corretor (sem travar a publicação), Fair Housing e bairros. Revisão jurídica (E2) ainda não feita.
--
-- DESFAZER:
--   delete from business_types where label = 'Realtor (EUA)';
--   delete from vertical_playbooks where key = 'imoveis_us';
--   (antes, voltar as contas que entraram: update companies set business_type = '<antigo>' where vertical_key = 'imoveis_us';)

begin;

insert into vertical_playbooks (key, name, config, enabled)
select 'imoveis_us', 'Real estate · USA',
  rio.config
  || jsonb_build_object(
    'default_language', 'en',
    'currency', '$',
    'tone', 'Warm, local and straight to the facts; no hype, no "once in a lifetime".',
    'vocabulary', '{"item": "Property", "lead": "Interested buyer", "sale": "Closed deal", "catalog": "My listings", "conversion": "Scheduled showing"}'::jsonb,
    'vocabulary_en', '{"item": "Property", "lead": "Interested buyer", "sale": "Closed deal", "catalog": "My listings", "conversion": "Scheduled showing"}'::jsonb,
    'ctas', '{"imovel": "Comment TOUR", "educacao": "Comment GUIDE", "sem_automacao": "Send me a DM", "bairro_mercado": "Save this / Share with someone looking"}'::jsonb,
    'hooks_by_pillar', '{"mercado": ["what homes really sell for in your area", "is now a good time to buy?"], "educacao": ["what nobody tells you about buying your first home", "how much income do you need for a $X mortgage?"], "marca_pessoal_prova_social": ["behind the scenes / closing day"]}'::jsonb,
    'rules', '["Photos are always real, never AI-generated", "Never make up prices, square footage, HOA fees or market data", "Never promise appreciation or returns", "Follow Fair Housing: describe the property, never who it is for", "Nothing is published without the agent''s approval", "Never hide defects, change the window view, enlarge a room or swap the sky/weather in a photo"]'::jsonb,
    'market_hashtags', '["realestate{local}", "homesforsale{local}", "realtor{local}"]'::jsonb,
    'setup_checklist', '["Professional profile connected", "Bio with areas served / license / call to action", "Profile photo", "Highlights: Listings / Areas / Clients / About me", "Link in bio", "Add your first 3 listings"]'::jsonb,
    'metrics', '{"intent": ["saves", "shares", "story replies"], "primary": "DMs + keyword comments per listing", "do_not_optimize": ["likes", "followers"]}'::jsonb,
    'dm_qualification', '{"goal": "schedule a showing", "questions": ["buy or rent", "price range", "areas", "timeline / mortgage pre-approval"]}'::jsonb,
    'dm_reply', '{"keyword": "TOUR", "template": "Hi! Glad you liked it 😊\n\n{tipo} in {bairro} · {venda_ou_aluguel}\n• {quartos} bedrooms\n• {m2} sq ft\n• Price: ${preco}\n\nWant to see it in person? Tell me the best day and time and I''ll set up your showing 🙂"}'::jsonb,
    'gift_creative', '{"cta": "Comment YES", "eyebrow": "{cidade}", "headline": "Your next home could be here", "variants": [{"cta": "Comment YES", "tag": "{cidade}", "scale": 1.2, "width": 1080, "height": 1350, "headline": "Your next home could be here"}, {"cta": "Reply YES", "tag": "{cidade}", "offer": "Details in DM", "scale": 1.4, "width": 1080, "height": 1920, "headline": "Imagine waking up here every day?"}, {"cta": "Comment YES", "tag": "To live or invest", "offer": "We show the rest in DM", "scale": 1.15, "width": 1080, "height": 1350, "headline": "The photo is just the start"}]}'::jsonb,
    'faq', '{"topics": "closing costs, title insurance and escrow, home inspection and appraisal, mortgage pre-approval vs pre-qualification, down payment and PMI, FHA, VA and conventional loans, property taxes and homestead exemption, HOA fees and rules, homeowners and flood insurance, renting: security deposit, lease and tenant screening, documents to buy and to rent", "categories": [{"key": "juridico", "label": "Legal"}, {"key": "financiamento", "label": "Financing"}, {"key": "documentacao", "label": "Paperwork"}, {"key": "impostos", "label": "Taxes and fees"}, {"key": "aluguel", "label": "Renting"}, {"key": "geral", "label": "General tip"}], "recheck_days": 60, "category_terms": {"geral": ["showing", "open house", "walkthrough", "moving", "renovation", "first home", "first-time buyer"], "aluguel": ["rent", "rental", "lease", "tenant", "landlord", "security deposit", "renters insurance", "tenant screening"], "impostos": ["property tax", "homestead", "capital gains", "transfer tax", "documentary stamp", "tax", "taxes", "exemption", "millage"], "juridico": ["contract", "attorney", "title", "deed", "lien", "probate", "power of attorney", "contingency", "earnest money", "disclosure"], "documentacao": ["documents", "paperwork", "title search", "survey", "certificate of occupancy", "closing disclosure", "loan estimate"], "financiamento": ["mortgage", "pre-approval", "pre-qualification", "interest rate", "down payment", "PMI", "FHA", "VA loan", "conventional loan", "credit score", "refinance", "APR", "closing costs"]}, "regulated_terms": ["APR", "PMI", "FHA", "VA loan", "Fair Housing", "RESPA", "TILA", "escrow", "title insurance", "homestead exemption", "capital gains", "property tax", "flood zone", "HOA"], "official_domains": ["gov", "consumerfinance.gov", "hud.gov", "fanniemae.com", "freddiemac.com", "irs.gov", "myfloridalicense.com", "floridarevenue.com"], "regulated_categories": ["juridico", "financiamento", "documentacao", "impostos", "aluguel"]}'::jsonb,
    'market_news', '{"days": 30, "queries": {"en": "{region} real estate OR development OR transit", "pt": "{region} real estate OR development OR transit"}, "max_regions": 3, "max_results": 5, "exclude_domains": ["zillow.com", "realtor.com", "redfin.com", "trulia.com", "homes.com", "apartments.com"], "max_new_per_week": 5}'::jsonb
  )
  -- Notícias: cidade vazia = a do cadastro da empresa (E1, cityFor); queries em inglês nos dois idiomas.
  || jsonb_build_object('market_intel', (rio.config->'market_intel') || jsonb_build_object('news',
       (rio.config->'market_intel'->'news') || jsonb_build_object(
         'city', '',
         'topics', '[{"kind": "launch", "query": {"en": "{region} {city} new home development OR new construction", "pt": "{region} {city} new home development OR new construction"}}, {"kind": "infrastructure", "query": {"en": "{region} {city} road OR transit OR infrastructure project", "pt": "{region} {city} road OR transit OR infrastructure project"}}, {"kind": "economy", "query": {"en": "{city} housing market home prices OR mortgage rates OR inventory", "pt": "{city} housing market home prices OR mortgage rates OR inventory"}}, {"kind": "tourism", "query": {"en": "{city} tourism events OR hotels OR visitors", "pt": "{city} tourism events OR hotels OR visitors"}}]'::jsonb,
         'exclude_domains', '["zillow.com", "realtor.com", "redfin.com", "trulia.com", "homes.com", "apartments.com", "facebook.com", "instagram.com", "youtube.com", "tiktok.com", "x.com", "twitter.com", "linkedin.com", "pinterest.com", "wikipedia.org", "airbnb.com", "booking.com", "tripadvisor.com"]'::jsonb,
         'quality', ((rio.config->'market_intel'->'news'->'quality') || '{"trusted_domains": ["apnews.com", "reuters.com", "wsj.com", "bloomberg.com", "cnbc.com", "sun-sentinel.com", "palmbeachpost.com", "miamiherald.com", "bizjournals.com"], "block_title_all": [["bedrooms", "for sale"], ["bed", "bath", "for sale"], ["sq ft", "for sale"]], "block_url_patterns": ["/homedetails/", "/realestateandhomes-detail/", "/home/", "/listing/", "/for-sale/", "/terms"]}'::jsonb)
       )))
  -- Bairros do Rio saem; temas de reserva em inglês.
  || jsonb_build_object('content_rules', (rio.config->'content_rules') || '{"theme_places": [], "theme_alternatives": ["How the mortgage process works, step by step", "Documents a buyer should have ready before making an offer", "What to check during a showing before deciding", "Closing costs: what they are and who pays them", "How to read HOA rules and fees before buying", "New construction vs resale: what changes", "Common first-time buyer mistakes", "How to prepare your home to sell", "How location shapes daily life"]}'::jsonb)
  -- Licença: estadual (ex.: Florida DBPR), sem travar a publicação até a regra ser decidida (E2). Fair Housing já vem do bloco `en`.
  || jsonb_build_object('compliance', (rio.config->'compliance') || jsonb_build_object('license', '{"name": {"en": "State real estate license", "pt": "Licença estadual de corretor"}, "types": {"F": {"en": "sales associate / broker", "pt": "corretor"}, "J": {"en": "brokerage", "pt": "imobiliária"}}, "footer": {"en": "Lic. #{license}", "pt": "Lic. #{license}"}, "pattern": "^[^0-9A-Z]*(?:LIC(?:ENSE)?)?[^0-9A-Z]*#?[^0-9A-Z]*(?<type>[A-Z]{1,3})?[^0-9A-Z]*(?<number>\\d{4,10})$", "answer_key": "creci", "verify_url": "https://www.myfloridalicense.com/wl11.asp", "block_publish_without": false}'::jsonb))
  -- Trava de afirmação de mercado: o catalog-package lê `.pt`; nos EUA as listas em inglês valem para os dois.
  || jsonb_build_object('opportunity_texts', (rio.config->'opportunity_texts') || jsonb_build_object(
       'market_claims', jsonb_build_object('en', rio.config->'opportunity_texts'->'market_claims'->'en', 'pt', rio.config->'opportunity_texts'->'market_claims'->'en'),
       'market_claims_ctx', jsonb_build_object('en', rio.config->'opportunity_texts'->'market_claims_ctx'->'en', 'pt', rio.config->'opportunity_texts'->'market_claims_ctx'->'en')))
  -- Formatos com o nome em inglês.
  || jsonb_build_object('content_formats', (select jsonb_agg(f || jsonb_build_object('name', coalesce(f->>'name_en', f->>'name'))) from jsonb_array_elements(rio.config->'content_formats') f))
  -- Campos do imóvel: preço em dólar e área em sq ft (mesmas chaves).
  || jsonb_build_object('catalog_fields', (rio.config->'catalog_fields') || jsonb_build_object('required', (
       select jsonb_agg(case
         when x->>'key' = 'preco' then x || '{"label": {"en": "Price ($)", "pt": "Preço ($)"}}'::jsonb
         when x->>'key' = 'm2' then x || '{"label": {"en": "Size (sq ft)", "pt": "Área (sq ft)"}}'::jsonb
         else x end) from jsonb_array_elements(rio.config->'catalog_fields'->'required') x))),
  true
from vertical_playbooks rio
where rio.key = 'imoveis_rio'
on conflict (key) do nothing;

insert into business_types (label, vertical_key, sort, enabled, plan_tier)
select 'Realtor (EUA)', 'imoveis_us', 82, true, 'corretor'
where not exists (select 1 from business_types where label = 'Realtor (EUA)');

commit;
