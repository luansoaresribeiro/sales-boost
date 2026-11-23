-- C8 (auditoria do conteúdo, etapa 2 — dono, 23/11 "tudo sim"). Só acrescenta na ficha de imóveis (Rio e EUA):
--  offer_guided: textos e nomes dos cômodos do carrossel "Visita guiada" e do "Custo de morar" (regra 6: nada disso no código);
--  formato novo "Custo de morar" (receita carrossel_custo_de_morar), só gera com condomínio E IPTU do cadastro.
-- Desfazer: remover a chave offer_guided (o carrossel volta ao antigo) e o formato/receita carrossel_custo_de_morar.
update public.vertical_playbooks v
set config = jsonb_set(jsonb_set(jsonb_set(v.config,
  '{offer_guided}', $json${
    "enabled": true,
    "pt": {
      "room_titles": {"fachada": "A chegada", "hall": "A entrada", "sala": "A sala", "sala_jantar": "A sala de jantar", "varanda": "A varanda", "vista": "A vista", "cozinha": "A cozinha", "quarto": "O quarto", "banheiro": "O banheiro", "area_servico": "A área de serviço", "corredor": "O corredor"},
      "texts": {"invite_title": "Quer ver de perto?", "invite_text": "A gente marca a visita no horário que for melhor para você.", "places_title": "Lá fora", "numbers_title": "Os números", "cost_cover": "Quanto custa por mês morar aqui?", "cost_title": "Todo mês", "cost_condo": "Condomínio", "cost_iptu": "IPTU", "cost_everyday": "O que o condomínio tem", "cost_close": "Quer a ficha completa?"}
    },
    "en": {
      "room_titles": {"fachada": "Arriving", "hall": "The entry", "sala": "The living room", "sala_jantar": "The dining room", "varanda": "The balcony", "vista": "The view", "cozinha": "The kitchen", "quarto": "The bedroom", "banheiro": "The bathroom", "area_servico": "The laundry", "corredor": "The hallway"},
      "texts": {"invite_title": "Want to see it in person?", "invite_text": "We'll book the showing at the time that works for you.", "places_title": "Around the block", "numbers_title": "The numbers", "cost_cover": "What does it cost to live here each month?", "cost_title": "Every month", "cost_condo": "HOA", "cost_iptu": "Property tax", "cost_everyday": "What the building offers", "cost_close": "Want the full listing?"}
    }
  }$json$::jsonb, true),
  '{content_formats}', (v.config->'content_formats') || $json$[{"key": "custo_de_morar", "cost": "centavos", "name": "Custo de morar (condomínio + IPTU)", "name_en": "Monthly cost of living here", "media": "fotos reais do catálogo + texto da marca", "family": "oferta", "pillar": "imoveis", "recipe": "carrossel_custo_de_morar", "status": "live", "surface": "feed", "producer": "item_package"}]$json$::jsonb, true),
  '{production_recipes,imoveis,etapa_a,recipes}', (v.config->'production_recipes'->'imoveis'->'etapa_a'->'recipes') || '["carrossel_custo_de_morar"]'::jsonb, true)
where v.key in ('imoveis_rio', 'imoveis_us')
  and v.config ? 'production_recipes'
  and not (v.config->'production_recipes'->'imoveis'->'etapa_a'->'recipes') ? 'carrossel_custo_de_morar';
