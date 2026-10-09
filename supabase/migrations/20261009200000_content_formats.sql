-- Estratégia escolhe a linha central de conteúdo e o mix semanal de formatos
-- a partir de um catálogo (ficha do setor + formatos da própria empresa).
-- content_plan = {central_line, hero_formats[{key,name}], why,
--                 weekly_mix[{format,name,producer,per_week,pillar,purpose}], updated_at}
alter table public.marketing_ai_strategies
  add column if not exists content_plan jsonb;

-- Catálogo de formatos do setor imóveis (aprovado pelo dono em 2026-10-09).
-- producer: post (calendário gera sozinho) | item_package (botão do item) |
-- item_video (vídeo curto, custa) | dm (resposta automática aprovada 1x).
-- status: live | needs_material | planned.
update public.vertical_playbooks
set config = jsonb_set(coalesce(config, '{}'::jsonb), '{content_formats}', $json$[
  {"key":"carrossel_imovel","name":"Carrossel do imóvel (fotos reais)","pillar":"imoveis","producer":"item_package","status":"live","media":"fotos reais do catálogo + texto da marca","cost":"centavos"},
  {"key":"detalhe_imovel","name":"\"O detalhe que você não viu\"","pillar":"imoveis","producer":"item_package","status":"live","media":"1 foto real + texto","cost":"centavos"},
  {"key":"video_comodo","name":"Vídeo curto de 1 cômodo (5 s)","pillar":"imoveis","producer":"item_video","status":"live","media":"foto real em movimento","cost":"~US$ 0,54 por vídeo"},
  {"key":"video_dois_comodos","name":"Vídeo passando entre 2 cômodos vizinhos (6 s)","pillar":"imoveis","producer":"item_video","status":"live","media":"2 fotos reais em movimento","cost":"~US$ 0,65 por vídeo"},
  {"key":"video_abertura_vista","name":"Abertura de fora do prédio/casa mostrando a vista (5 s)","pillar":"imoveis","producer":"item_video","status":"live","media":"foto real da fachada/vista","cost":"~US$ 0,54 por vídeo","notes":"precisa de foto de fora"},
  {"key":"comente_quero","name":"\"Comente QUERO\" → DM com os dados do imóvel + convite pra visita","pillar":"imoveis","producer":"dm","status":"live","media":"legenda com CTA + DM automática","cost":"grátis"},
  {"key":"o_que_rs_compra","name":"\"O que R$X compra no bairro\"","pillar":"bairro_estilo_vida","producer":"item_package","status":"live","media":"imagem de clima (nunca finge lugar real) + texto","cost":"centavos"},
  {"key":"tres_coisas_perto","name":"\"3 coisas perto\" do imóvel","pillar":"bairro_estilo_vida","producer":"item_package","status":"live","media":"imagem de clima + texto","cost":"centavos"},
  {"key":"stories_enquete_pagaria","name":"Stories enquete \"pagaria R$X?\"","pillar":"mercado","producer":"item_package","status":"live","media":"card de texto","cost":"centavos"},
  {"key":"stories_caixa_perguntas","name":"Stories caixa de perguntas","pillar":"marca_pessoal_prova_social","producer":"item_package","status":"needs_material","notes":"material e autorização do corretor"},
  {"key":"pov_pegou_a_chave","name":"\"POV: pegou a chave\"","pillar":"marca_pessoal_prova_social","producer":"item_package","status":"needs_material","notes":"material e autorização do cliente"},
  {"key":"isso_ou_aquilo","name":"\"Isso ou aquilo\" (2 imóveis lado a lado)","pillar":"imoveis","producer":"item_package","status":"planned"},
  {"key":"carrossel_educativo","name":"Carrossel educativo (financiamento, documentação)","pillar":"educacao","producer":"post","status":"planned"},
  {"key":"post_trend","name":"Post de trend do momento","pillar":"educacao","producer":"post","status":"planned"},
  {"key":"cartao_postal_bairro","name":"Cartão-postal do bairro","pillar":"bairro_estilo_vida","producer":"item_package","status":"planned"},
  {"key":"avatar_corretor","name":"Avatar do corretor apresentando o imóvel","pillar":"marca_pessoal_prova_social","producer":"item_video","status":"planned"},
  {"key":"post_vendido","name":"\"Vendido!\"","pillar":"marca_pessoal_prova_social","producer":"item_package","status":"planned"}
]$json$::jsonb)
where key = 'imoveis_rio';
