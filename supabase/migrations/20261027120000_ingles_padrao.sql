-- Inglês como idioma principal (decisão do dono 2026-10-27, docs/DECISIONS.md).
-- `companies.language` (text, nullable) guarda a língua do CONTEÚDO gerado pra
-- empresa (legendas, ganchos, CTA). Empresa NOVA passa a nascer em inglês.
--
-- 1) Defensivo: linha sem idioma (null) é conta antiga em português — fixa 'pt'
--    ANTES de trocar o padrão, pra nenhuma empresa existente mudar de idioma.
--    (Em produção as 4 empresas atuais já têm 'pt'; este update não toca ninguém.)
-- 2) Muda só o valor padrão de linhas FUTURAS. Não altera nenhuma linha que já tem valor.
--
-- Sem cron e sem chamada externa: o mesmo SQL serve ao ensaio.
-- REVERTER: alter table public.companies alter column language set default 'pt';
update public.companies set language = 'pt' where language is null;
alter table public.companies alter column language set default 'en';
