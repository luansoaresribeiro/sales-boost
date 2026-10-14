-- Kit grátis vira 1 foto → 3 artes (decisão do dono, 2026-10-14: "caminho A,
-- mas precisa chamar atenção"). A foto real é tratada 1 vez pela Higgsfield e
-- o render-format imprime as 3 artes abaixo por cima (regra 4: a IA nunca
-- escreve). Texto sem número nenhum (regra 5); {cidade} vira a cidade do
-- cadastro. `tag` = selo colorido no topo; `offer` = faixa colorida; tamanho em
-- pixels (1080×1350 = feed, 1080×1920 = stories); `scale` = letras maiores
-- (1 a 1,6) pra chamar atenção. Aditivo: só acrescenta a
-- chave variants em gift_creative da ficha imoveis_rio (o texto antigo fica
-- como reserva).
update public.vertical_playbooks
set config = jsonb_set(config, '{gift_creative,variants}', $json$[
  { "tag": "{cidade}", "headline": "Seu próximo lar pode estar aqui", "cta": "Comente QUERO", "width": 1080, "height": 1350, "scale": 1.2 },
  { "tag": "{cidade}", "headline": "Imagina acordar aqui todo dia?", "offer": "Detalhes na DM", "cta": "Responda QUERO", "width": 1080, "height": 1920, "scale": 1.4 },
  { "tag": "Para morar ou investir", "headline": "A foto é só o começo", "offer": "O resto a gente mostra na DM", "cta": "Comente QUERO", "width": 1080, "height": 1350, "scale": 1.15 }
]$json$::jsonb)
where key = 'imoveis_rio' and config ? 'gift_creative';
