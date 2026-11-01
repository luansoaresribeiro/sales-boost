-- Etapa 5 da Inteligência comercial — página pública do imóvel + link rastreável + lead com origem.
-- Direção decidida pelo dono (docs/DECISIONS.md, 2026-10-30): a página é SÓ destino de link (sem listagem, sem busca,
-- noindex) e só vai ao ar com a aprovação do dono ("Aprovar e publicar" no card do imóvel). Corretores: Etapa 7.
-- Aditiva e idempotente. Sem cron, sem mudar RLS de tabela existente, sem apagar nada.
--
-- public_pages   uma linha por imóvel; `enabled` = página no ar (aprovada pelo dono; approved_at/approved_by guardam quem e quando)
--                + o WhatsApp e o Instagram que aparecem na página (cópia da empresa no momento da aprovação).
-- tracked_links  um código curto (8 letras/números sem ambíguos) por (imóvel, oportunidade, canal); é o /p/<código>.
-- link_events    visitas, cliques e leads de cada link (visitor_hash = SHA-256 com sal; o IP NUNCA é guardado).
-- leads          ganha item_id / opportunity_id / link_id / consent_at / consent_text (nuláveis, on delete set null).
--                (`leads` não tem migration de criação local — deriva documentada em PITFALLS; só ADICIONAMOS colunas.)
-- RLS: as 3 tabelas novas só deixam LER a dona da empresa e o owner da plataforma. Toda escrita é pela service role
--      (edge function marketing-ai) — a página pública não tem login, então nada é escrito pelo navegador.
-- Ficha (regra 6 — nada de setor no código): imoveis_rio ganha config.public_page
--      fields        quais campos do catálogo aparecem na página (lista BRANCA: o que não está aqui nunca sai)
--      min_photos    mínimo de fotos reais para o dono poder publicar
--      caption_line  frase com o link que entra na legenda/DM (uma vez só)
--      country_code  DDI usado quando o telefone da empresa vem sem ele (wa.me exige)
--
-- Como reverter (a página sai do ar na hora; os leads já recebidos continuam, só perdem a origem):
--   alter table public.leads drop column if exists item_id, drop column if exists opportunity_id,
--     drop column if exists link_id, drop column if exists consent_at, drop column if exists consent_text;
--   drop table if exists public.link_events;
--   drop table if exists public.tracked_links;
--   drop table if exists public.public_pages;
--   update public.vertical_playbooks set config = config - 'public_page' where key = 'imoveis_rio';

begin;

create table if not exists public.public_pages (
  item_id uuid primary key references public.marketing_ai_knowledge(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  enabled boolean not null default false,
  approved_at timestamptz,
  approved_by uuid,
  contact_phone text,
  contact_ig text,
  created_at timestamptz not null default now()
);
create index if not exists public_pages_company on public.public_pages (company_id);

create table if not exists public.tracked_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null unique,
  item_id uuid not null references public.marketing_ai_knowledge(id) on delete cascade,
  opportunity_id uuid references public.growth_opportunities(id) on delete set null,
  content_id uuid,
  channel text not null check (channel in ('caption','dm','bio','manual')),
  created_at timestamptz not null default now()
);
create unique index if not exists tracked_links_item_opp_channel_uq
  on public.tracked_links (item_id, coalesce(opportunity_id, '00000000-0000-0000-0000-000000000000'::uuid), channel);
create index if not exists tracked_links_company on public.tracked_links (company_id);

create table if not exists public.link_events (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  link_id uuid not null references public.tracked_links(id) on delete cascade,
  event text not null check (event in ('view','click_whatsapp','click_dm','lead')),
  visitor_hash text,
  lead_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists link_events_link_event_created on public.link_events (link_id, event, created_at desc);
create index if not exists link_events_company_created on public.link_events (company_id, created_at desc);
create index if not exists link_events_visitor on public.link_events (visitor_hash, event, created_at desc);

alter table public.leads add column if not exists item_id uuid references public.marketing_ai_knowledge(id) on delete set null;
alter table public.leads add column if not exists opportunity_id uuid references public.growth_opportunities(id) on delete set null;
alter table public.leads add column if not exists link_id uuid references public.tracked_links(id) on delete set null;
alter table public.leads add column if not exists consent_at timestamptz;
alter table public.leads add column if not exists consent_text text;

alter table public.public_pages enable row level security;
alter table public.tracked_links enable row level security;
alter table public.link_events enable row level security;

-- Mesmo padrão de market_signals / growth_opportunities: a empresa lê o que é dela; o owner da plataforma lê tudo.
drop policy if exists public_pages_select on public.public_pages;
create policy public_pages_select on public.public_pages
  for select to authenticated
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
    or exists (select 1 from public.user_roles where email = auth.jwt()->>'email' and role = 'owner')
  );
drop policy if exists tracked_links_select on public.tracked_links;
create policy tracked_links_select on public.tracked_links
  for select to authenticated
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
    or exists (select 1 from public.user_roles where email = auth.jwt()->>'email' and role = 'owner')
  );
drop policy if exists link_events_select on public.link_events;
create policy link_events_select on public.link_events
  for select to authenticated
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
    or exists (select 1 from public.user_roles where email = auth.jwt()->>'email' and role = 'owner')
  );

revoke all on public.public_pages from anon, authenticated;
revoke all on public.tracked_links from anon, authenticated;
revoke all on public.link_events from anon, authenticated;
grant select on public.public_pages to authenticated;
grant select on public.tracked_links to authenticated;
grant select on public.link_events to authenticated;

-- Ficha do setor: só entra se ainda não existe (não sobrescreve ajuste feito à mão).
-- A lista de campos é BRANCA e não inclui `detalhe_que_ninguem_percebe` nem `video_tour` (uso interno).
update public.vertical_playbooks
set config = jsonb_set(coalesce(config, '{}'::jsonb), '{public_page}', $json${
  "fields": ["tipo", "bairro", "venda_ou_aluguel", "preco", "quartos", "m2", "vagas", "condominio", "iptu", "andar", "vista", "lazer", "perto_de", "descricao"],
  "min_photos": 3,
  "country_code": "55",
  "caption_line": {"pt": "Mais fotos e detalhes: {link}", "en": "More photos and details: {link}"}
}$json$::jsonb, true)
where key = 'imoveis_rio'
  and (config->'public_page') is null;

commit;
