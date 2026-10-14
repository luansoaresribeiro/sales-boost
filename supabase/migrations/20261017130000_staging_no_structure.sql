-- Mobiliar virtualmente: o teste de 2026-10-14 (terraço com vista) mobiliou
-- bem, mas a IA ACRESCENTOU uma cobertura que não existe e trocou a luz pra
-- fim de tarde — isso muda o imóvel. Reforça na ficha (regra 6) que estrutura,
-- céu e hora do dia ficam iguais. O dono continua aprovando o antes/depois.
update public.vertical_playbooks
set config = jsonb_set(jsonb_set(config,
  '{virtual_staging,base}', to_jsonb((config->'virtual_staging'->>'base') || ' Never add or extend a roof, ceiling, awning, pergola, wall, railing or any structure. Keep the same sky, weather, time of day and light as the original photo.')),
  '{virtual_staging,negative}', to_jsonb((config->'virtual_staging'->>'negative') || ', added roof, added ceiling, added awning, added pergola, new structure, changed sky, sunset, night, changed time of day'))
where key = 'imoveis_rio' and config ? 'virtual_staging'
  and position('Never add or extend a roof' in config->'virtual_staging'->>'base') = 0;
