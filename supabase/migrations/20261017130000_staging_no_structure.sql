-- Mobiliar virtualmente: o teste de 2026-10-14 (terraço com vista) mobiliou
-- bem, mas a IA ACRESCENTOU uma cobertura que não existe — isso muda o imóvel.
-- Reforça na ficha (regra 6) que a estrutura fica igual. Luz de fim de tarde /
-- pôr do sol é permitida (decisão do dono, 2026-10-14: "pode deixar pôr do sol,
-- mas nunca inventar uma cobertura"). O dono continua aprovando o antes/depois.
update public.vertical_playbooks
set config = jsonb_set(jsonb_set(config,
  '{virtual_staging,base}', to_jsonb((config->'virtual_staging'->>'base') || ' Never add or extend a roof, ceiling, awning, pergola, wall, column, railing, window, door or any other structure — the building stays exactly as it is. A warm sunset light is fine.')),
  '{virtual_staging,negative}', to_jsonb((config->'virtual_staging'->>'negative') || ', added roof, added ceiling, added awning, added pergola, added wall, added column, new structure'))
where key = 'imoveis_rio' and config ? 'virtual_staging'
  and position('Never add or extend a roof' in config->'virtual_staging'->>'base') = 0;
