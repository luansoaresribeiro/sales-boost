-- Faixa de fluxo dos agentes (2026-11-01): leitura SÓ de agregados do livro-caixa `agent_performance` para a tela.
-- Não mexe em RLS de nenhuma tabela. Função nova, somente leitura, security definer: confere primeiro que quem chama é
-- dono da empresa (companies.user_id = auth.uid()) ou dono da plataforma (user_roles.role = 'owner', pelo e-mail, como nas
-- outras políticas); devolve só última execução, sucesso, erro curto (160 caracteres) e contagens/somas — nunca linhas cruas.
-- Dia e mês em UTC, iguais aos de marketNewsRun (dayStartIso/monthStartIso). O teto de notícias vem da ficha
-- (vertical_playbooks.config.market_intel: cap_usd, padrão 5; split, padrão 3/2) — o secret MARKET_INTEL_CAP_USD, se existir,
-- não é visível aqui (a tela diz "pela ficha").
--
-- Como reverter:
--   drop function if exists public.company_flow_status(uuid);

begin;

create or replace function public.company_flow_status(p_company uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_day timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_month timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  v_vertical text;
  v_intel jsonb;
  v_cap numeric := 5;
  v_si numeric := 0;
  v_sn numeric := 0;
  v_news_budget numeric;
  v_news jsonb;
  v_opp jsonb;
  v_last_run uuid;
begin
  if auth.uid() is null then return null; end if;
  select vertical_key into v_vertical from public.companies
   where id = p_company
     and (user_id = auth.uid()
          or exists (select 1 from public.user_roles ur join auth.users u on u.email = ur.email where u.id = auth.uid() and ur.role = 'owner'));
  if not found then return null; end if;

  select config -> 'market_intel' into v_intel from public.vertical_playbooks where key = coalesce(v_vertical, '') and enabled;
  if v_intel is not null then
    if (v_intel ->> 'cap_usd') ~ '^[0-9]+(\.[0-9]+)?$' and (v_intel ->> 'cap_usd')::numeric > 0 then v_cap := (v_intel ->> 'cap_usd')::numeric; end if;
    if (v_intel #>> '{split,instagram}') ~ '^[0-9]+(\.[0-9]+)?$' then v_si := (v_intel #>> '{split,instagram}')::numeric; end if;
    if (v_intel #>> '{split,news}') ~ '^[0-9]+(\.[0-9]+)?$' then v_sn := (v_intel #>> '{split,news}')::numeric; end if;
  end if;
  if v_si = 0 and v_sn = 0 then v_si := 3; v_sn := 2; end if;
  v_news_budget := v_sn * case when (v_si + v_sn) > v_cap then v_cap / (v_si + v_sn) else 1 end;

  select jsonb_build_object(
    'has_config', v_intel is not null,
    'last_at', (select max(created_at) from public.agent_performance where company_id = p_company and task_key = 'market_news_search'),
    'last_ok', (select success from public.agent_performance where company_id = p_company and task_key = 'market_news_search' order by created_at desc limit 1),
    'last_error', (select left(error_message, 160) from public.agent_performance where company_id = p_company and task_key = 'market_news_search' order by created_at desc limit 1),
    'searches_today', (select count(*) from public.agent_performance where company_id = p_company and task_key = 'market_news_search' and created_at >= v_day),
    'searches_month', (select count(*) from public.agent_performance where company_id = p_company and task_key = 'market_news_search' and created_at >= v_month),
    'cost_month', (select coalesce(sum(cost_usd), 0) from public.agent_performance where company_id = p_company and task_key = 'market_news_search' and created_at >= v_month),
    'news_budget', case when v_intel is null then null else v_news_budget end
  ) into v_news;

  select run_id into v_last_run from public.growth_opportunities where company_id = p_company and run_id is not null order by created_at desc limit 1;
  select jsonb_build_object(
    'last_ok_at', (select max(created_at) from public.agent_performance where company_id = p_company and task_key = 'run_opportunities' and success),
    'last_fail_at', (select max(created_at) from public.agent_performance where company_id = p_company and task_key = 'run_opportunities' and not success),
    'last_fail_error', (select left(error_message, 160) from public.agent_performance where company_id = p_company and task_key = 'run_opportunities' and not success order by created_at desc limit 1),
    'last_note', (select left(task_description, 160) from public.agent_performance where company_id = p_company and task_key = 'run_opportunities' and success order by created_at desc limit 1),
    'generated_last_run', case when v_last_run is null then null else (select count(*) from public.growth_opportunities where company_id = p_company and run_id = v_last_run) end,
    'plans_made', (select count(*) from public.agent_performance where company_id = p_company and task_key = 'create_opportunity_plan' and success),
    'plans_failed', (select count(*) from public.agent_performance where company_id = p_company and task_key = 'create_opportunity_plan' and not success),
    'plan_last_error', (select left(error_message, 160) from public.agent_performance where company_id = p_company and task_key = 'create_opportunity_plan' and not success order by created_at desc limit 1),
    'plan_last_at', (select max(created_at) from public.agent_performance where company_id = p_company and task_key = 'create_opportunity_plan' and success),
    'pieces_created', (select count(*) from public.agent_performance where company_id = p_company and task_key = 'opportunity_piece_created'),
    'pieces_last_at', (select max(created_at) from public.agent_performance where company_id = p_company and task_key = 'opportunity_piece_created')
  ) into v_opp;

  return jsonb_build_object('news', v_news, 'opportunities', v_opp);
end;
$$;

revoke all on function public.company_flow_status(uuid) from public, anon;
grant execute on function public.company_flow_status(uuid) to authenticated;

commit;
