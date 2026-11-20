-- Frente 1, item 1.3 (20/11): textos dos pedidos de foto da tela de cobertura do tour, na ficha (regra 6).
-- Só acrescenta config.tour.coverage_hints onde ainda não existe. Desfazer:
--   update vertical_playbooks set config = config #- '{tour,coverage_hints}' where key in ('imoveis_rio','imoveis_us');
update vertical_playbooks
set config = jsonb_set(config, '{tour,coverage_hints}', jsonb_build_object(
  'pt', jsonb_build_object(
    'probable', 'Fique em {a}, na porta ou passagem que dá para {b}, e fotografe com a porta aberta: os dois cômodos precisam aparecer na mesma foto.',
    'isolated', 'Na porta de {a}, pelo lado de fora (no corredor ou no cômodo vizinho), fotografe para dentro com a porta aberta: o batente e o cômodo na mesma foto.',
    'stairs', 'No meio da escada de {a}, aponte para onde ela chega: os degraus e o andar de cima (ou de baixo) na mesma foto.'),
  'en', jsonb_build_object(
    'probable', 'Stand in {a}, at the door or passage to {b}, and take the photo with the door open: both rooms must show in the same photo.',
    'isolated', 'At the door of {a}, standing outside (in the hallway or next room), shoot inwards with the door open: the door frame and the room in the same photo.',
    'stairs', 'Halfway up the stairs in {a}, point to where they lead: the steps and the floor above (or below) in the same photo.')
), true)
where key in ('imoveis_rio', 'imoveis_us') and config ? 'tour' and not (config->'tour' ? 'coverage_hints');
