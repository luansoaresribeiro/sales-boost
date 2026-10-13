-- Lembrete "Suas informações ainda estão atualizadas?" (decisão do dono 2026-10-13,
-- docs/DECISIONS.md). Migration ADITIVA: só duas colunas anuláveis, sem default,
-- sem RLS nova (o dono já atualiza a própria empresa pela policy existente de companies).
--  - profile_confirmed_at: quando o dono disse "Está tudo certo" ou salvou a ficha.
--  - profile_changed_at: quando a ficha foi SALVA com mudança (não conta "Está tudo
--    certo"). A tela de Estratégia usa pra avisar que a ficha mudou depois da
--    estratégia atual. Nunca refaz a estratégia sozinho (regra 7).
alter table companies add column if not exists profile_confirmed_at timestamptz;
alter table companies add column if not exists profile_changed_at timestamptz;
