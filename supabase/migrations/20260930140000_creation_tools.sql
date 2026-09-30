-- Fase 3+4 Etapa A (A2): ferramentas de criação por setor. Reaproveita
-- marketing_ai_tool_registry (mesma tabela/convenção de status live/
-- partial/planned que as ferramentas globais já usam) — só ganha uma
-- coluna opcional vertical_key: null = ferramenta global (comportamento
-- de sempre, todas as linhas existentes continuam null), preenchida =
-- só aparece pra quem tem aquela ficha.
--
-- "Tour virtual do imóvel" já é real hoje (carrossel de fotos reais via
-- "Gerar pacote"/catalog-package) — status 'live', descrição deixa claro
-- que é carrossel de fotos por enquanto, vídeo é etapa futura (Higgsfield).
-- As outras 3 dependem de integração que ainda não existe — 'planned'.
--
-- marketing_ai_tool_interest: registra quem clicou "Quero quando lançar"
-- numa ferramenta 'planned' — RLS: cada empresa só insere/vê o próprio
-- interesse; owner vê tudo (mesma regra de leitura ampla que outras
-- tabelas administrativas do Owner já usam).

begin;

alter table marketing_ai_tool_registry
  add column if not exists vertical_key text references vertical_playbooks(key) on delete cascade;

insert into marketing_ai_tool_registry (id, name, description, category, connected, requires_integration, status, notes, vertical_key)
values
  ('tour_virtual_tool', 'Tour virtual do imóvel', 'Gera um carrossel de fotos reais do imóvel, na ordem certa, pronto pra aprovar e publicar. Hoje é carrossel de fotos — vídeo com movimento de câmera (Higgsfield) entra numa etapa futura.', 'criacao', true, null, 'live', null, 'imoveis_rio'),
  ('criativos_anuncio_tool', 'Criativos de anúncio', 'Gera uma peça visual a partir da foto real do imóvel, pensada pra anúncio pago — ainda depende de uma integração de geração de imagem que não está pronta.', 'criacao', false, 'higgsfield', 'planned', null, 'imoveis_rio'),
  ('avatar_corretor_tool', 'Avatar do corretor', 'Um avatar seu (ou do corretor) apresentando o imóvel com o fundo real dele — depende de integração de avatar por IA que ainda não existe.', 'criacao', false, 'heygen', 'planned', null, 'imoveis_rio'),
  ('voz_corretor_tool', 'Voz do corretor', 'Narração com a voz do corretor nos vídeos gerados — depende da mesma integração de avatar/voz futura.', 'criacao', false, 'heygen', 'planned', null, 'imoveis_rio')
on conflict (id) do nothing;

create table if not exists marketing_ai_tool_interest (
  id uuid primary key default gen_random_uuid(),
  tool_id text not null references marketing_ai_tool_registry(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (tool_id, company_id)
);

alter table marketing_ai_tool_interest enable row level security;

create policy tool_interest_insert_own on marketing_ai_tool_interest
  for insert to authenticated
  with check (company_id in (select id from companies where user_id = auth.uid()));

create policy tool_interest_select_own on marketing_ai_tool_interest
  for select to authenticated
  using (
    company_id in (select id from companies where user_id = auth.uid())
    or exists (select 1 from user_roles where email = auth.jwt()->>'email' and role = 'owner')
  );

commit;
