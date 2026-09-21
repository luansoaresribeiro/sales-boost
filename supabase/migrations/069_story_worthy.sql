-- Marca posts do Calendário da Semana que valem a pena repetir nos Stories
-- também (pedido do dono, 2026-09) — anotação no próprio post, não um post
-- duplicado gerado à parte.
alter table marketing_ai_test_content
  add column if not exists story_worthy boolean not null default false,
  add column if not exists story_note text;
