-- Fase 3+4 Etapa A (A3): "Gerar pacote" grava cada peça já como um rascunho
-- em marketing_ai_test_content — mesma tabela/caminho que já publica de
-- verdade (aprovar aqui chama publishToInstagram, ver agent-actions). item_id
-- aponta pro item do catálogo (marketing_ai_knowledge) que originou a peça;
-- media é a lista ordenada de foto/vídeo real (carrossel usa isso, não só
-- image_url); pillar/recipe identificam de qual pilar/receita da ficha a
-- peça veio (usado pelo motor de agendamento pra nunca lotar um pilar só,
-- ver planWeekForCompany); provider identifica a origem da mídia
-- (catalogo_real | ia_generica | render-format).

begin;

alter table marketing_ai_test_content
  add column if not exists item_id uuid references marketing_ai_knowledge(id) on delete set null,
  add column if not exists media jsonb,
  add column if not exists pillar text,
  add column if not exists recipe text,
  add column if not exists provider text;

commit;
