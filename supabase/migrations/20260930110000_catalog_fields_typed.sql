-- Fase 3+4 (Etapa A): catalog_fields de imoveis_rio era só uma lista de
-- chaves soltas (string[]) — sem tipo nem label, não dava pra montar um
-- formulário genérico a partir disso. Vira o mesmo formato tipado/bilíngue
-- que onboarding_questions já usa (key/type/label/options), pra o
-- catálogo renderizar campo por campo sem nenhum código específico de
-- setor. `fotos_min_5` vira type:'photos' com `min:5` — tratado à parte
-- no formulário (uploader de várias fotos), não como campo de texto comum.

begin;

update vertical_playbooks
set config = jsonb_set(
  config,
  '{catalog_fields}',
  '{
    "required": [
      {"key": "fotos_min_5", "type": "photos", "min": 5, "label": {"pt": "Fotos do imóvel (mínimo 5)", "en": "Property photos (minimum 5)"}},
      {"key": "tipo", "type": "select", "label": {"pt": "Tipo", "en": "Type"}, "options": [
        {"pt": "Apartamento", "en": "Apartment"}, {"pt": "Casa", "en": "House"},
        {"pt": "Cobertura", "en": "Penthouse"}, {"pt": "Sala comercial", "en": "Commercial space"},
        {"pt": "Terreno", "en": "Land"}
      ]},
      {"key": "bairro", "type": "text", "label": {"pt": "Bairro", "en": "Neighborhood"}},
      {"key": "venda_ou_aluguel", "type": "select", "label": {"pt": "Venda ou aluguel", "en": "Sale or rental"}, "options": [
        {"pt": "Venda", "en": "Sale"}, {"pt": "Aluguel", "en": "Rental"}
      ]},
      {"key": "preco", "type": "number", "label": {"pt": "Preço (R$)", "en": "Price (R$)"}},
      {"key": "quartos", "type": "number", "label": {"pt": "Quartos", "en": "Bedrooms"}},
      {"key": "m2", "type": "number", "label": {"pt": "Metragem (m²)", "en": "Size (m²)"}}
    ],
    "optional": [
      {"key": "vagas", "type": "number", "label": {"pt": "Vagas de garagem", "en": "Parking spots"}},
      {"key": "condominio", "type": "number", "label": {"pt": "Condomínio (R$)", "en": "HOA fee (R$)"}},
      {"key": "iptu", "type": "number", "label": {"pt": "IPTU (R$)", "en": "Property tax (R$)"}},
      {"key": "andar", "type": "text", "label": {"pt": "Andar", "en": "Floor"}},
      {"key": "vista", "type": "text", "label": {"pt": "Vista", "en": "View"}},
      {"key": "lazer", "type": "text", "label": {"pt": "Lazer / Amenidades", "en": "Amenities"}},
      {"key": "perto_de", "type": "text", "label": {"pt": "Perto de", "en": "Near"}},
      {"key": "video_tour", "type": "url", "label": {"pt": "Link de vídeo-tour (se já tiver)", "en": "Video tour link (if any)"}},
      {"key": "detalhe_que_ninguem_percebe", "type": "text", "label": {"pt": "Um detalhe que ninguém percebe de cara", "en": "A detail no one notices at first"}}
    ]
  }'::jsonb
),
updated_at = now()
where key = 'imoveis_rio';

commit;
