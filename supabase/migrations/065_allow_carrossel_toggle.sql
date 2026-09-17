-- Botão pra considerar ou não o formato "carrossel" na geração de imagem
-- (creative-generate). Desligado por padrão: sem carrossel, todo post vira
-- "foto" e sempre passa pelo sistema de templates reais (Tweet Print,
-- Anúncio, Antes/Depois, Produto, simples) — nenhum dos templates hoje é
-- pensado pra vários slides.
alter table marketing_ai_config
  add column if not exists allow_carrossel boolean not null default false;
