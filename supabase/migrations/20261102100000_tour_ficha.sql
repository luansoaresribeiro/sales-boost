-- PR A (qualidade do tour virtual) — ficha de imóveis: config.tour + instrução de câmera da abertura.
-- Decisões do dono 2026-11-02 (docs/DECISIONS.md). Regra 6: tudo que é de setor vive aqui, o código só lê.
--  - config.tour.rooms: cômodos que a IA de visão pode devolver ao dar nota na foto (meta.photos[i].room).
--  - config.tour.adjacent_rooms: pares de cômodos plausivelmente vizinhos pro tour "2 cômodos" (pair). A vizinhança
--    vem do TIPO do cômodo, não da planta — por isso a peça sempre avisa "passagem não confirmada por planta".
--  - config.tour.opening_rooms: cômodos aceitos pra abertura de fora (opening) — só foto real de fachada/vista.
--  - config.tour.room_priority / avoid_rooms: ordem de preferência; o que é "evitar" só entra sem alternativa.
--  - config.tour.min_quality (0-100) / min_room_conf (0-1): pisos pra foto contar como "boa"/"cômodo confiável".
--  - config.tour.forbidden_claims: frases que a legenda do tour não pode afirmar (o vídeo é animação por IA de foto real).
--  - config.tour.endcard_*: encerramento de marca (duração; campos do cadastro do imóvel usados como lugar e preço —
--    preço só aparece se preenchido, exatamente como cadastrado).
--  - config.clip_prompts.opening: câmera da abertura limitada ao que a foto mostra (não "revela" o que está fora do quadro).
-- Só JSON, aditivo e idempotente (rodar 2x dá o mesmo resultado). Não toca em nenhuma outra chave da ficha.
--
-- REVERTER:
--   update vertical_playbooks set config = (config #- '{tour}') #- '{clip_prompts,opening}' where key = 'imoveis_rio';
-- (sem config.tour o código cai no padrão seguro: só tour de 1 cômodo, escolhido por qualidade; sem clip_prompts.opening
--  volta o texto padrão do tourEngine.ts. Nada quebra.)
update vertical_playbooks
set config = jsonb_set(
  jsonb_set(coalesce(config, '{}'::jsonb), '{tour}', $json$
  {
    "rooms": [
      {"key": "fachada", "label": "fachada / entrada do prédio ou da casa, vista de fora"},
      {"key": "vista", "label": "vista (janela, varanda ou área externa mostrando a paisagem/o entorno)"},
      {"key": "sala", "label": "sala de estar"},
      {"key": "sala_jantar", "label": "sala de jantar"},
      {"key": "varanda", "label": "varanda / terraço / sacada"},
      {"key": "cozinha", "label": "cozinha"},
      {"key": "quarto", "label": "quarto / suíte"},
      {"key": "banheiro", "label": "banheiro / lavabo"},
      {"key": "hall", "label": "hall de entrada / recepção"},
      {"key": "corredor", "label": "corredor / circulação"},
      {"key": "area_servico", "label": "área de serviço / lavanderia / dependência"},
      {"key": "outro", "label": "outro / não dá pra saber"}
    ],
    "adjacent_rooms": [
      ["sala", "varanda"], ["sala", "cozinha"], ["sala", "sala_jantar"], ["cozinha", "area_servico"],
      ["quarto", "banheiro"], ["quarto", "varanda"], ["sala", "hall"], ["sala_jantar", "cozinha"], ["hall", "sala_jantar"]
    ],
    "opening_rooms": ["fachada", "vista"],
    "room_priority": ["fachada", "vista", "sala", "varanda", "cozinha", "sala_jantar", "quarto", "hall"],
    "avoid_rooms": ["banheiro", "corredor", "area_servico"],
    "min_quality": 50,
    "min_room_conf": 0.6,
    "recent_exclude": 2,
    "forbidden_claims": [
      "filmado", "filmada", "filmagem", "filmamos", "gravado", "gravada", "gravamos",
      "sem edição", "sem filtro", "sem encenação", "sem retoque", "sem montagem",
      "vídeo real", "câmera no local", "tour ao vivo", "ao vivo"
    ],
    "endcard_seconds": 2.5,
    "endcard_place_field": "bairro",
    "endcard_price_field": "preco"
  }
  $json$::jsonb, true),
  '{clip_prompts}',
  coalesce(config->'clip_prompts', '{}'::jsonb) || jsonb_build_object('opening',
    'Cinematic establishing shot from outside, slow smooth camera movement (a gentle push-in or slight pan) that stays inside what the photo already shows, golden natural light. Do not reveal, invent or add anything that is not in the frame: no new buildings, floors, rooms, people, vehicles, signs or scenery beyond the edges. Keep the building, the landscape and the view exactly as in the photo — do not add, remove or change anything. No people, no text, no logos.'),
  true)
where key = 'imoveis_rio' and config is not null;
