-- Importar anúncios do portal (XML VRSync do ZAP/VivaReal) pro catálogo —
-- pedido do dono, 2026-10-14. O conector (portal-import) devolve campos
-- neutros (neighborhood, price, bedrooms, ...); ESTA parte da ficha diz em
-- qual campo do catálogo de imóveis cada um entra (regra 6: setor é dado).
--   fields: campo do catálogo ← campo neutro (número/texto copiado como veio)
--   select: campo do catálogo ← campo neutro, traduzido por "contém" (a
--           primeira dupla [contém, valor] de `match` que bater vence — lista,
--           não objeto, porque jsonb não guarda a ordem das chaves; sem
--           correspondência o campo fica vazio pro dono escolher)
-- Aditivo: só acrescenta a chave catalog_import na ficha imoveis_rio.
update public.vertical_playbooks
set config = jsonb_set(coalesce(config, '{}'::jsonb), '{catalog_import}', $json${
  "source": "vrsync",
  "fields": { "bairro": "neighborhood", "preco": "price", "quartos": "bedrooms", "m2": "area", "vagas": "parking", "condominio": "hoa", "iptu": "tax" },
  "select": {
    "tipo": { "from": "property_type", "match": [["Penthouse", "Cobertura"], ["Cobertura", "Cobertura"], ["Apartment", "Apartamento"], ["Flat", "Apartamento"], ["Apartamento", "Apartamento"], ["Home", "Casa"], ["House", "Casa"], ["Sobrado", "Casa"], ["Casa", "Casa"], ["Office", "Sala comercial"], ["Commercial", "Sala comercial"], ["Land", "Terreno"], ["Lot", "Terreno"], ["Terreno", "Terreno"]] },
    "venda_ou_aluguel": { "from": "transaction", "match": [["sale", "Venda"], ["rent", "Aluguel"]] }
  }
}$json$::jsonb)
where key = 'imoveis_rio';
