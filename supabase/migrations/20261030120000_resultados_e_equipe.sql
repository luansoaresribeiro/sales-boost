-- Etapas 6 e 7 (versão mínima) da Inteligência comercial — resultados por oportunidade + corretor como CONTATO de encaminhamento.
-- Decisão (docs/DECISIONS.md, 2026-10-30): corretor NÃO tem login. É um nome + WhatsApp que o dono cadastra; o lead que entra pela
-- página pública é distribuído em rodízio e o dono encaminha por WhatsApp (nada é enviado por nós). Login por papel = projeto futuro.
-- Números só com origem rastreável: a oportunidade só "ganha" visita/clique/lead pelo link /p/<código> dela; nada é atribuído por palpite.
-- Aditiva e idempotente. Sem cron, sem mudar RLS de tabela existente, sem apagar nada.
--
-- leads         ganha visit_at / proposal_at / proposal_value / closed_at / closed_value (o dono carimba ao mover o lead no funil;
--               valor é opcional — vazio = "valor não informado") e assigned_broker_id (corretor da vez).
-- brokers       um contato por linha (nome, WhatsApp, e-mail opcional, ativo). RLS: CRUD só da dona da empresa; o owner da plataforma lê.
-- link_events   ganha broker_id (qual corretor foi usado no clique de WhatsApp da página, quando houve).
-- assign_next_broker(company)  rodízio: escolhe o corretor ATIVO com last_assigned_at mais antigo (nulos primeiro), `for update skip
--               locked` (dois leads simultâneos não pegam o mesmo), e carimba last_assigned_at. SÓ a service role executa.
-- opportunity_results(company) security INVOKER (a RLS de quem chama vale): por oportunidade — links, peças aprovadas, visitas
--               (visitantes distintos por dia), cliques, leads, visitas agendadas, propostas, vendas, soma só dos valores informados
--               e quantas vendas têm valor. Depende de posts.opportunity_id / tracked_links / link_events (migrations anteriores).
--
-- Como reverter (os leads continuam; só perdem corretor/datas/valores):
--   drop function if exists public.opportunity_results(uuid);
--   drop function if exists public.assign_next_broker(uuid);
--   alter table public.link_events drop column if exists broker_id;
--   alter table public.leads drop column if exists assigned_broker_id, drop column if exists visit_at, drop column if exists proposal_at,
--     drop column if exists proposal_value, drop column if exists closed_at, drop column if exists closed_value;
--   drop table if exists public.brokers;

begin;

create table if not exists public.brokers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  active boolean not null default true,
  last_assigned_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists brokers_company_active on public.brokers (company_id, active, last_assigned_at);

alter table public.leads add column if not exists visit_at timestamptz;
alter table public.leads add column if not exists proposal_at timestamptz;
alter table public.leads add column if not exists proposal_value numeric(14,2);
alter table public.leads add column if not exists closed_at timestamptz;
alter table public.leads add column if not exists closed_value numeric(14,2);
alter table public.leads add column if not exists assigned_broker_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_assigned_broker_id_fkey' and conrelid = 'public.leads'::regclass) then
    alter table public.leads add constraint leads_assigned_broker_id_fkey
      foreign key (assigned_broker_id) references public.brokers(id) on delete set null;
  end if;
end $$;
create index if not exists leads_assigned_broker on public.leads (assigned_broker_id) where assigned_broker_id is not null;

alter table public.link_events add column if not exists broker_id uuid;

alter table public.brokers enable row level security;
drop policy if exists brokers_owner_all on public.brokers;
create policy brokers_owner_all on public.brokers
  for all to authenticated
  using (company_id in (select id from public.companies where user_id = auth.uid()))
  with check (company_id in (select id from public.companies where user_id = auth.uid()));
drop policy if exists brokers_platform_select on public.brokers;
create policy brokers_platform_select on public.brokers
  for select to authenticated
  using (exists (select 1 from public.user_roles where email = auth.jwt()->>'email' and role = 'owner'));

revoke all on public.brokers from anon, authenticated;
grant select, insert, update, delete on public.brokers to authenticated;

create or replace function public.assign_next_broker(p_company uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select b.id into v_id
  from public.brokers b
  where b.company_id = p_company and b.active
  order by b.last_assigned_at asc nulls first, b.created_at asc, b.id asc
  limit 1
  for update skip locked;
  if v_id is null then return null; end if;
  update public.brokers set last_assigned_at = now() where id = v_id;
  return v_id;
end;
$$;
revoke execute on function public.assign_next_broker(uuid) from public, anon, authenticated;
grant execute on function public.assign_next_broker(uuid) to service_role;

create or replace function public.opportunity_results(p_company uuid)
returns table (
  opportunity_id uuid, links integer, pecas_aprovadas integer, visitas integer, cliques integer, leads integer,
  visitas_agendadas integer, propostas integer, vendas integer, valor_vendas numeric, vendas_com_valor integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    o.id,
    (select count(*) from public.tracked_links tl where tl.opportunity_id = o.id)::integer,
    (select count(*) from public.posts p where p.company_id = p_company and p.opportunity_id = o.id)::integer,
    (select count(distinct (e.visitor_hash, e.created_at::date)) from public.link_events e
       join public.tracked_links tl on tl.id = e.link_id
      where tl.opportunity_id = o.id and e.event = 'view' and e.visitor_hash is not null)::integer,
    (select count(*) from public.link_events e
       join public.tracked_links tl on tl.id = e.link_id
      where tl.opportunity_id = o.id and e.event in ('click_whatsapp', 'click_dm'))::integer,
    (select count(*) from public.leads ld where ld.company_id = p_company and ld.opportunity_id = o.id)::integer,
    (select count(*) from public.leads ld where ld.company_id = p_company and ld.opportunity_id = o.id and ld.visit_at is not null)::integer,
    (select count(*) from public.leads ld where ld.company_id = p_company and ld.opportunity_id = o.id and ld.proposal_at is not null)::integer,
    (select count(*) from public.leads ld where ld.company_id = p_company and ld.opportunity_id = o.id and ld.closed_at is not null)::integer,
    coalesce((select sum(ld.closed_value) from public.leads ld where ld.company_id = p_company and ld.opportunity_id = o.id and ld.closed_at is not null and ld.closed_value is not null), 0),
    (select count(*) from public.leads ld where ld.company_id = p_company and ld.opportunity_id = o.id and ld.closed_at is not null and ld.closed_value is not null)::integer
  from public.growth_opportunities o
  where o.company_id = p_company;
$$;
revoke execute on function public.opportunity_results(uuid) from public, anon;
grant execute on function public.opportunity_results(uuid) to authenticated, service_role;

commit;
