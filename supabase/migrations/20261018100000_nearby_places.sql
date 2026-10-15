-- Agente de Dados, etapa 1: "Lugares perto" (pedido do dono 2026-10-14).
-- Aditivo e idempotente. Nada de código de setor (regra 6): as categorias e
-- as tags do OpenStreetMap moram na ficha.

-- 1) Categorias, raio e quantos por categoria.
update public.vertical_playbooks
set config = jsonb_set(config, '{nearby_places}', '{
  "address_field": "endereco",
  "area_field": "bairro",
  "radius_m": 1500,
  "max_per_category": 3,
  "categories": [
    {"key": "praia",       "label": "Praia",              "emoji": "🏖️", "osm": ["natural=beach"], "name_pattern": "^praia"},
    {"key": "metro",       "label": "Metrô",              "emoji": "🚇", "osm": ["station=subway"]},
    {"key": "parque",      "label": "Parque e praça",     "emoji": "🌳", "osm": ["leisure=park"], "name_pattern": "^(praça|praca|parque|jardim|largo|bosque|pracinha)"},
    {"key": "escola",      "label": "Escola",             "emoji": "🏫", "osm": ["amenity=school"]},
    {"key": "mercado",     "label": "Mercado",            "emoji": "🛒", "osm": ["shop=supermarket"]},
    {"key": "padaria",     "label": "Padaria",            "emoji": "🥖", "osm": ["shop=bakery"]},
    {"key": "farmacia",    "label": "Farmácia",           "emoji": "💊", "osm": ["amenity=pharmacy"]},
    {"key": "academia",    "label": "Academia",           "emoji": "🏋️", "osm": ["leisure=fitness_centre"]},
    {"key": "restaurante", "label": "Restaurante e café", "emoji": "🍽️", "osm": ["amenity=restaurant|cafe"]},
    {"key": "saude",       "label": "Hospital",           "emoji": "🏥", "osm": ["amenity=hospital"]},
    {"key": "shopping",    "label": "Shopping",           "emoji": "🛍️", "osm": ["shop=mall"]},
    {"key": "cultura",     "label": "Cultura e lazer",    "emoji": "🎭", "osm": ["amenity=theatre|cinema", "tourism=museum"]}
  ]
}'::jsonb)
where key = 'imoveis_rio' and config->'nearby_places' is null;

-- 2) Campo opcional "Endereço" no imóvel: só pra achar o ponto no mapa e
--    calcular a distância certa. "private": nunca vai pra IA de legenda nem
--    pra tela pública (ver privateFieldKeys em _shared/nearbyPlaces.ts).
update public.vertical_playbooks
set config = jsonb_set(config, '{catalog_fields,optional}',
  (config->'catalog_fields'->'optional') || '[{"key": "endereco", "type": "text", "max": 200, "private": true, "label": {"pt": "Endereço (rua e número — só pra achar o que tem perto, nunca aparece nos posts)", "en": "Address (street and number — only to find what is nearby, never shown in posts)"}}]'::jsonb)
where key = 'imoveis_rio'
  and jsonb_typeof(config->'catalog_fields'->'optional') = 'array'
  and not exists (select 1 from jsonb_array_elements(config->'catalog_fields'->'optional') f where f->>'key' = 'endereco');
