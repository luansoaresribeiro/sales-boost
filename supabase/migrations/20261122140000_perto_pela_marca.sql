-- Pontos fortes, item 3 (dono, 22/11 — docs/PONTOS-FORTES.md §3): a marca de localização do imóvel puxa estas categorias de
-- lugar perto para a frente (as categorias já existem em nearby_places). Só acrescenta. Lido por _shared/nearbyPlaces.ts.
-- Desfazer: update public.vertical_playbooks set config = config #- '{nearby_places,mark_field}' #- '{nearby_places,mark_categories}'
--           where key in ('imoveis_rio','imoveis_us');
update public.vertical_playbooks
set config = jsonb_set(config, '{nearby_places}', config->'nearby_places' || jsonb_build_object(
  'mark_field', 'pontos_localizacao',
  'mark_categories', $json${
    "Perto da praia": ["praia"],
    "Perto do metrô": ["metro"],
    "Rua tranquila / perto da natureza": ["parque", "praia"],
    "Vida noturna e restaurantes": ["restaurante", "cultura"],
    "Escolas perto": ["escola"],
    "Tudo a pé (mercado, padaria, farmácia)": ["mercado", "padaria", "farmacia"]
  }$json$::jsonb), true)
where key in ('imoveis_rio', 'imoveis_us') and config ? 'nearby_places' and not (config->'nearby_places' ? 'mark_categories');
