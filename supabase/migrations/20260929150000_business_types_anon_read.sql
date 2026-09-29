-- Bug real encontrado testando a Fase 2 (checagem pedida pelo dono, 2026-09-29):
-- business_types_read estava restrita ao role "authenticated" (sem "anon"),
-- diferente de vertical_playbooks_read (aberta a PUBLIC). O onboarding roda
-- ANTES de existir conta/sessao (/onboarding e rota livre) -- na pratica um
-- visitante anonimo real sempre recebia [] do banco e caia no fallback
-- hardcoded de 6 tipos em src/lib/businessTypes.ts, que NAO inclui
-- "Imobiliaria / Corretor" nem "Software". Ou seja: um corretor de verdade
-- nunca conseguia escolher o proprio tipo de negocio no onboarding.
--
-- Corrige business_types_read pra incluir anon (igual vertical_playbooks_read
-- ja fazia) e, nos dois casos, trava a regra em "enabled = true" (defesa em
-- profundidade -- antes dependia so do filtro .eq('enabled', true) no
-- codigo do app; agora o banco garante isso mesmo se algum client esquecer
-- o filtro). Escrita continua so pra owner autenticado nas duas tabelas --
-- nao mexido aqui.

begin;

drop policy if exists business_types_read on business_types;
create policy business_types_read on business_types
  for select using (enabled = true);

drop policy if exists vertical_playbooks_read on vertical_playbooks;
create policy vertical_playbooks_read on vertical_playbooks
  for select using (enabled = true);

commit;
