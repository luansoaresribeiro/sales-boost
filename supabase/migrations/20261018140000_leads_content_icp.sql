-- Agente de leads — ICP novo (dono, 2026-10-15): imobiliária com Instagram
-- SEM VÍDEO há tempo, OU FLOPADO, OU MAL PRODUZIDO, com potencial de crescer.
-- Varredura em lotes (continua sozinha até acabar) e busca por bairro.

-- Sinais de conteúdo do lead (mostrados na tela de Leads).
alter table sales_prospects add column if not exists ig_followers int;
alter table sales_prospects add column if not exists ig_last_video_days int;   -- null = nenhum vídeo na amostra
alter table sales_prospects add column if not exists ig_engagement_rate numeric; -- % por post
alter table sales_prospects add column if not exists content_quality int;       -- 0-10 (IA olhando as capas)
alter table sales_prospects add column if not exists content_issues text;

-- Fila da varredura em lotes + sinal de vida.
alter table prospect_scan_log add column if not exists queue jsonb;
alter table prospect_scan_log add column if not exists chain int not null default 0;
alter table prospect_scan_log add column if not exists heartbeat_at timestamptz;

-- Bairros: com lista, a busca vai "imobiliária em Botafogo, Rio de Janeiro"…
alter table prospect_settings add column if not exists search_areas text[] not null default '{}';
update prospect_settings
   set search_areas = array[
     'Copacabana','Ipanema','Leblon','Botafogo','Flamengo','Laranjeiras','Humaitá','Lagoa','Gávea','Jardim Botânico',
     'Urca','Leme','Catete','Glória','Centro','Tijuca','Vila Isabel','Grajaú','Maracanã','Méier',
     'Barra da Tijuca','Recreio dos Bandeirantes','Jacarepaguá','Freguesia','Itanhangá','São Conrado','Joá',
     'Ilha do Governador','Penha','Madureira','Campo Grande','Santa Teresa'
   ]
 where id = true and coalesce(array_length(search_areas, 1), 0) = 0;

-- Pesos: metade POTENCIAL (até 50) + metade OPORTUNIDADE (até 50).
update prospect_settings
   set scoring_weights = '{"rating_in_range":15,"reviews_in_range":10,"recent_review":5,"has_phone":5,"independent_business":10,"has_audience":5,"no_recent_video":20,"low_engagement":15,"poor_quality":15,"weak_presence_opportunity":25,"likely_chain_penalty":-40,"instagram_active":0,"has_website":0,"no_online_ordering":0}'::jsonb
 where id = true;
