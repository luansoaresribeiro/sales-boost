-- Tudo em inglês no modo inglês (I1, dono 16/11). Só ACRESCENTA texto em inglês; o português fica como está.
-- 1) Ficha imoveis_rio: vocabulary_en (a tela lê; `vocabulary` continua igual porque os agentes do servidor o leem)
--    e name_en em cada formato de content_formats.
-- 2) marketing_ai_tool_registry: colunas name_en/description_en, preenchidas.
-- Desfazer: update vertical_playbooks set config = config - 'vocabulary_en' where key='imoveis_rio';
--           (name_en dos formatos e as colunas novas podem ficar: só a tela em inglês as lê).

update vertical_playbooks
set config = jsonb_set(config, '{vocabulary_en}', '{"item":"Property","catalog":"My properties","lead":"Interested person","sale":"Closed deal","conversion":"Scheduled visit"}'::jsonb)
where key = 'imoveis_rio';

update vertical_playbooks v
set config = jsonb_set(v.config, '{content_formats}', (
  select jsonb_agg(case when m.en is not null and not (f ? 'name_en') then f || jsonb_build_object('name_en', m.en) else f end order by o)
  from jsonb_array_elements(v.config->'content_formats') with ordinality as e(f, o)
  left join (values
    ('carrossel_imovel','Property carousel (real photos)'),
    ('detalhe_imovel','"The detail you missed"'),
    ('video_comodo','Short video of 1 room (5 s)'),
    ('video_dois_comodos','Video walking between 2 adjoining rooms (6 s)'),
    ('video_abertura_vista','Opening from outside the building/house showing the view (5 s)'),
    ('comente_quero','"Comment WANT" → DM with the property details + visit invitation'),
    ('o_que_rs_compra','"What R$X buys in the neighborhood"'),
    ('tres_coisas_perto','"3 things nearby" the property'),
    ('stories_enquete_pagaria','Stories poll "would you pay R$X?"'),
    ('stories_caixa_perguntas','Stories question box'),
    ('pov_pegou_a_chave','"POV: you got the keys"'),
    ('isso_ou_aquilo','"This or that" (2 properties side by side)'),
    ('carrossel_educativo','Educational carousel (checked tips; light topic free)'),
    ('post_trend','Trending post'),
    ('cartao_postal_bairro','Neighborhood postcard'),
    ('avatar_corretor','Agent avatar presenting the property'),
    ('post_vendido','"Sold!"'),
    ('dica_faq','Checked tip or FAQ (legal, financing, paperwork)')
  ) as m(k, en) on m.k = f->>'key'))
where v.key = 'imoveis_rio' and jsonb_typeof(v.config->'content_formats') = 'array';

alter table marketing_ai_tool_registry add column if not exists name_en text, add column if not exists description_en text;

update marketing_ai_tool_registry t set name_en = m.n, description_en = m.d from (values
  ('comment_tool','Comment Intelligence Tool','Sentiment, complaints and praise in comments.'),
  ('competitor_tool','Competitor Tool','Tracks registered competitors via scraping.'),
  ('insights_tool','Insights Tool','Official Instagram reach, impressions and engagement.'),
  ('instagram_tool','Instagram Tool','Profile, posts, reels and stories via scraping (Apify).'),
  ('messaging_tool','Messaging Intelligence Tool','Conversations, leads and intent via Instagram Direct.'),
  ('calendar_tool','Calendar Tool','Content and campaign calendar.'),
  ('caption_generation_tool','Caption Generation Tool','Writes captions based on the Marketing Brain.'),
  ('configuration_tool','Configuration Tool','Dynamic configuration — the strategy agent refines it automatically with evidence.'),
  ('image_generation_tool','Image Generation Tool','Creates images that respect the brand and visual identity.'),
  ('publishing_tool','Publishing Tool','Creates drafts, schedules and publishes.'),
  ('analytics_tool','Analytics Tool','Weekly, monthly and campaign reports.'),
  ('experiment_tool','Experiment Tool','Controlled tests (CTA, time, format).'),
  ('learning_tool','Learning Tool','Every run becomes permanent knowledge in the Marketing Brain.'),
  ('research_tool','Research Tool','Keeps learning about the business, products and clients.'),
  ('trend_discovery_tool','Trend Discovery Tool','Trending hashtags, formats and topics for the industry.'),
  ('avatar_corretor_tool','Agent avatar','An avatar of you (or the agent) presenting the property with its real background — depends on an AI avatar integration that does not exist yet.'),
  ('criativos_anuncio_tool','Ad creatives','Creates a visual piece from the real property photo, designed for paid ads — still depends on an image generation integration that is not ready.'),
  ('tour_virtual_tool','Property virtual tour','A continuous walk through the property made from its real photos, ready to approve. Built in the Virtual tour menu.'),
  ('voz_corretor_tool','Agent voice','Narration with the agent''s voice in the generated videos — depends on the same future avatar/voice integration.')
) as m(id, n, d) where t.id = m.id and t.name_en is null;
