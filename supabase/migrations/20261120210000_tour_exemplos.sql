-- Item 1.3b / B (dono, 19–20/11): exemplos no topo do Tour virtual. Material REAL já existente, nada gerado para isto.
-- Tour: o tour completo da Tespon de 13/11 (8 ambientes), autorizado pelo dono em 20/11 ("sim, pode usar").
-- Mobiliado: sem exemplo ainda (o de 14/10 expirou; o de 20/11 inventou arquitetura, item 1.3c) — a tela mostra só o texto.
-- Só acrescenta config.tour.examples onde não existe. Desfazer:
--   update vertical_playbooks set config = config #- '{tour,examples}' where key in ('imoveis_rio','imoveis_us');
update vertical_playbooks
set config = jsonb_set(config, '{tour,examples}', jsonb_build_object(
  'tour', jsonb_build_object(
    'video_url', 'https://miwcxakzyforbahpnpst.supabase.co/storage/v1/object/public/videos/plan/f8f602ee-4089-4536-b2ff-2a11d759c80a/9d8805f4-9660-430f-abd3-20f504e3c1bf.mp4',
    'poster', 'https://miwcxakzyforbahpnpst.supabase.co/storage/v1/object/public/post-images/renders/f8f602ee-4089-4536-b2ff-2a11d759c80a/catalog-c4614a0b-9cfa-43b1-bd76-9630a9556b81.jpg'),
  'staging', null
), true)
where key in ('imoveis_rio', 'imoveis_us') and config ? 'tour' and not (config->'tour' ? 'examples');
