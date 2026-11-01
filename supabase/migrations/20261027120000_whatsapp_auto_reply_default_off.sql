-- Regra inviolável 1: nada vai ao público (inclui DM/resposta) sem aprovação do dono.
-- O padrão de whatsapp_auto_reply era true (resposta automática ligada) — empresa NOVA já nascia enviando
-- resposta sozinha. Passa a nascer DESLIGADO; o dono liga de propósito.
-- Aditiva: muda só o valor padrão de linhas FUTURAS. Não altera nenhuma linha existente
-- (o dono roda à mão o update dos valores atuais, se quiser).
-- REVERTER: alter table public.companies alter column whatsapp_auto_reply set default true;
alter table public.companies alter column whatsapp_auto_reply set default false;
