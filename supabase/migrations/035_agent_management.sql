-- Agent Management: perfil completo por agente (nome/descrição já existiam;
-- adiciona aba do dashboard, modelo de IA e horário de funcionamento),
-- catálogo de ferramentas expandido, e registro de bots do Telegram —
-- tudo dinâmico via banco, sem precisar mexer em código pra reconfigurar.

alter table agent_roles add column if not exists dashboard_tab text;
alter table agent_roles add column if not exists ai_model text not null default 'claude-sonnet-4-6';
alter table agent_roles add column if not exists schedule jsonb not null default '{"always_on": true, "start_hour": null, "end_hour": null}'::jsonb;

update agent_roles set dashboard_tab = 'agente' where role = 'marketing' and dashboard_tab is null;
update agent_roles set dashboard_tab = 'marketing-ai' where role = 'marketing_ai' and dashboard_tab is null;

-- Ferramentas que apareciam só na lista do pedido do dono mas ainda não
-- tinham linha no catálogo — igual às outras "planned", sem fingir que já
-- fazem alguma coisa. access_customer_database é a exceção: o contexto da
-- empresa (nome, tipo, histórico) já é injetado em toda chamada ao Hermes,
-- então é 'live' de verdade, só não é um toggle porque não dá pra desligar
-- sem quebrar o agente.
insert into capability_registry (id, name, description, category, used_by, requires_approval, hermes_callable, toggleable, enabled, status, notes, requires)
values
  ('search_internet', 'Buscar na internet', 'Pesquisar informações atualizadas na web antes de responder ou decidir.', 'outros', array['marketing'], false, false, false, true, 'planned', 'Não existe implementação nenhuma ainda — precisaria de uma API de busca (ex: Brave Search, Serper).', array['API de busca externa']),
  ('access_financial_data', 'Acessar dados financeiros', 'Ler receita, faturamento ou métricas financeiras do negócio.', 'analytics', array['marketing'], true, false, false, true, 'planned', 'O Sales Boost hoje não tem nenhuma fonte de dado financeiro conectada (nem Stripe do próprio cliente, nem planilha).', array['Integração financeira (ex: Stripe Connect)']),
  ('create_task', 'Criar tarefas', 'Criar uma tarefa/lembrete pro dono ou pra equipe.', 'outros', array['marketing'], false, false, false, true, 'planned', 'Não existe sistema de tarefas no produto ainda.', array[]::text[]),
  ('execute_automation', 'Executar automações', 'Rodar uma sequência de ações encadeadas sem intervenção manual em cada passo.', 'outros', array['marketing'], true, false, false, true, 'planned', 'Não existe motor de automação — cada ação hoje é executada e reportada individualmente, sempre com aprovação humana.', array[]::text[]),
  ('call_other_agent', 'Chamar outro agente', 'Pedir para outro agente (ex: Marketing AI) executar uma tarefa.', 'outros', array['marketing'], false, false, false, true, 'planned', 'Cada agente roda isolado hoje (Agente Geral via hermes-proxy, Marketing AI via marketing-ai) — não existe ponte entre os dois.', array[]::text[]),
  ('access_customer_database', 'Acessar base de clientes', 'Ler nome, tipo de negócio, cidade, objetivo e histórico da empresa.', 'crm', array['marketing'], false, true, false, true, 'live', 'Núcleo — o contexto da empresa já é injetado em toda chamada ao Hermes, não é uma ferramenta que se chama à parte.', array[]::text[])
on conflict (id) do nothing;

-- Registro dos bots de Telegram — hoje existe só o hermesBot (compartilhado
-- por todas as empresas), mas fica numa tabela pra o dono poder desligar
-- (kill switch real) e pra já ficar pronto pra quando existir mais de um bot.
create table if not exists telegram_bots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table telegram_bots enable row level security;
create policy "owner_all_telegram_bots" on telegram_bots for all
  using (exists (select 1 from user_roles ur where ur.email = auth.jwt() ->> 'email' and ur.role = 'owner'))
  with check (exists (select 1 from user_roles ur where ur.email = auth.jwt() ->> 'email' and ur.role = 'owner'));

insert into telegram_bots (name, description, active)
select 'hermesBot', '@luansoaresribeirobot — bot principal, atende todas as empresas conectadas.', true
where not exists (select 1 from telegram_bots);

-- Qual agente responde as mensagens de Telegram desta empresa — antes era
-- fixo no código do hermes-proxy (sempre 'marketing'); agora é configurável
-- por empresa. Só 'marketing' sabe conversar por Telegram hoje (é o único
-- papel com prompt/ferramentas de chat implementados), mas o campo já fica
-- pronto pra quando existir um segundo agente conversacional.
alter table companies add column if not exists telegram_agent_role text not null default 'marketing';
