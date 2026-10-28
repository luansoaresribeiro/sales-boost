-- Inteligência comercial para imobiliárias — Etapa 1 (Opportunity Engine).
-- Decisão do dono, 2026-10-28 (docs/DECISIONS.md). Duas tabelas novas:
--   market_signals       sinais de mercado (notícia, lançamento, obra, juros…)
--                        com fonte e data. Etapa 1: ainda vazia — a Etapa 2 deixa o
--                        cliente colar sinais à mão (por isso a policy de escrita já existe).
--   growth_opportunities oportunidades que o motor (marketing-ai → run_opportunities)
--                        sugere, SEMPRE com evidência rotulada (fato/dado/hipótese).
-- ATENÇÃO nomes: já existem `opportunities` (detect-opportunities / hermes-proxy /
-- monthly-report) e `campaigns` com outro significado — NÃO são tocadas nem reaproveitadas.
-- Sem cron, sem dado de cliente tocado. Aditiva: nada existente é alterado, exceto a
-- ficha do setor (vertical_playbooks) ganhar a chave opportunity_fields (regra 6).
--
-- COMO REVERTER (nada mais depende destas tabelas):
--   drop table if exists public.growth_opportunities;
--   drop table if exists public.market_signals;
--   update public.vertical_playbooks set config = (config - 'opportunity_fields') - 'opportunity_texts' where key = 'imoveis_rio';

begin;

create table if not exists public.market_signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in ('news','launch','infrastructure','economy','tourism','rental','listing_price','supply','other')),
  region text,
  title text not null,
  summary text,
  source_name text,
  source_url text,
  observed_at date,
  collected_by text not null default 'manual' check (collected_by in ('manual','system')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists market_signals_company_created on public.market_signals (company_id, created_at desc);

create table if not exists public.growth_opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text check (kind in ('content_gap','low_traction','unmet_demand','positioning','market_change','other')),
  title text not null,
  description text,
  commercial_problem text,
  -- lista de { type: 'fact'|'data'|'hypothesis', text, source, date }
  evidence jsonb not null default '[]'::jsonb,
  item_ids uuid[] not null default '{}',
  audience text,
  suggested_action text,
  how_to_measure text,
  confidence text not null check (confidence in ('high','medium','low','needs_validation')),
  needs_validation boolean not null default false,
  status text not null default 'suggested' check (status in ('suggested','approved','dismissed')),
  priority_rank int,
  priority_reasons jsonb not null default '[]'::jsonb,
  run_id uuid,
  decided_at timestamptz,
  decided_by uuid,
  strategy_id uuid,
  created_at timestamptz default now()
);
create index if not exists growth_opportunities_company_created on public.growth_opportunities (company_id, created_at desc);

alter table public.market_signals enable row level security;
alter table public.growth_opportunities enable row level security;

-- Mesmo padrão de marketing_ai_tool_interest / marketing_ai_strategies:
-- a empresa enxerga/mexe no que é dela; o Owner da plataforma só LÊ tudo.
drop policy if exists market_signals_select on public.market_signals;
create policy market_signals_select on public.market_signals
  for select to authenticated
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
    or exists (select 1 from public.user_roles where email = auth.jwt()->>'email' and role = 'owner')
  );
drop policy if exists market_signals_insert_own on public.market_signals;
create policy market_signals_insert_own on public.market_signals
  for insert to authenticated
  with check (company_id in (select id from public.companies where user_id = auth.uid()));
drop policy if exists market_signals_update_own on public.market_signals;
create policy market_signals_update_own on public.market_signals
  for update to authenticated
  using (company_id in (select id from public.companies where user_id = auth.uid()))
  with check (company_id in (select id from public.companies where user_id = auth.uid()));
drop policy if exists market_signals_delete_own on public.market_signals;
create policy market_signals_delete_own on public.market_signals
  for delete to authenticated
  using (company_id in (select id from public.companies where user_id = auth.uid()));

-- growth_opportunities: o cliente LÊ e só decide (status). Criar é sempre a function
-- (service role, que ignora RLS) — sem policy de insert/delete de propósito.
drop policy if exists growth_opportunities_select on public.growth_opportunities;
create policy growth_opportunities_select on public.growth_opportunities
  for select to authenticated
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
    or exists (select 1 from public.user_roles where email = auth.jwt()->>'email' and role = 'owner')
  );
drop policy if exists growth_opportunities_update_own on public.growth_opportunities;
create policy growth_opportunities_update_own on public.growth_opportunities
  for update to authenticated
  using (company_id in (select id from public.companies where user_id = auth.uid()))
  with check (company_id in (select id from public.companies where user_id = auth.uid()));
-- RLS não limita COLUNA: sem isto o cliente poderia reescrever título/evidência. Só estas 3 colunas.
revoke update on public.growth_opportunities from anon, authenticated;
grant update (status, decided_at, decided_by) on public.growth_opportunities to authenticated;

-- Ficha do setor (regra 6): (1) QUAIS campos do catálogo dizem região/preço/tipo/quartos/negócio — o motor só lê
-- estes papéis, os rótulos vêm de config.catalog_fields; (2) os textos de setor do motor, em pt/en (causas
-- possíveis de pouca reação, ressalva do prompt, exemplos de público). Sem estas chaves o motor usa textos
-- genéricos; setor sem opportunity_fields simplesmente não tem o motor (a function responde com aviso).
-- Aditivo: só acrescenta chaves à ficha de imoveis_rio (reverter: ver topo).
update public.vertical_playbooks
set config = jsonb_set(
      jsonb_set(coalesce(config, '{}'::jsonb), '{opportunity_fields}',
        '{"location":"bairro","price":"preco","type":"tipo","bedrooms":"quartos","deal":"venda_ou_aluguel"}'::jsonb, true),
      '{opportunity_texts}',
      $json${
        "low_traction_hypotheses": {
          "pt": [
            "Possível causa: o preço anunciado pode estar acima do que o público dessa região procura — precisa ser comparado com anúncios parecidos.",
            "Possível causa: as fotos podem não estar mostrando o melhor do imóvel (poucas, escuras ou sem o ambiente que mais vende).",
            "Possível causa: a comunicação pode estar genérica, sem dizer pra quem o imóvel serve nem por que olhar agora."
          ],
          "en": [
            "Possible cause: the listed price may be above what buyers in this area are looking for — it needs to be compared with similar listings.",
            "Possible cause: the photos may not show the best of the property (few, dark, or missing the room that sells most).",
            "Possible cause: the messaging may be generic, not saying who the property is for or why to look now."
          ]
        },
        "caveat": {
          "pt": "Preço anunciado não é preço de venda; interesse de busca não é comprador.",
          "en": "Listed price is not sale price; search interest is not a buyer."
        },
        "audience_hint": {
          "pt": "\"quem busca perto do trabalho\", \"quem quer trocar por algo maior\", \"investidores em aluguel por temporada\"",
          "en": "\"people looking close to work\", \"people trading up to more space\", \"short-term rental investors\""
        }
      }$json$::jsonb, true),
    updated_at = now()
where key = 'imoveis_rio';

commit;
