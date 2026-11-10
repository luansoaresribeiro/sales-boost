-- Pesquisa de mercado compartilhada por bairro (economia de custos, passo 2 — aprovado pelo dono em 10/11).
-- Guarda o resultado de UMA busca de notícias (Tavily) por dia. As buscas são montadas só com tema × bairro × cidade da ficha
-- e o resultado é notícia pública: outra imobiliária que faça a mesma busca no mesmo dia reaproveita, sem gastar crédito.
-- SEM company_id: nenhuma informação de uma imobiliária fica aqui. Cada imobiliária continua com os próprios sinais
-- (market_signals). Só o servidor (service role) lê e grava: RLS ligado e nenhuma política para usuários.
-- Tabela nova: não mexe em nenhum dado existente.
--
-- ROLLBACK:
--   drop table if exists public.market_search_cache;
create table if not exists public.market_search_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null,
  day date not null,
  query text not null,
  hits jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (cache_key, day)
);
alter table public.market_search_cache enable row level security;
comment on table public.market_search_cache is 'Pesquisa de mercado compartilhada (Tavily, notícia pública) por busca e dia. Sem dado de empresa. Só service role.';
