-- Perfil pessoal x profissional (decisão do dono 2026-10-09): quem não informa
-- nome de empresa no cadastro fica como "pessoal". É só um rótulo pra
-- organizar — não muda nada no que o produto faz.
-- Aditiva: empresas existentes ficam 'profissional' (todas têm nome).
-- DESFAZER: alter table public.companies drop column if exists profile_type;
alter table public.companies
  add column if not exists profile_type text not null default 'profissional'
  check (profile_type in ('profissional', 'pessoal'));
