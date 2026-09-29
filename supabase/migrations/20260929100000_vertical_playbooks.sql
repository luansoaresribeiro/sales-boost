-- Fase 1 do sistema de "fichas de setor" (vertical playbooks). Só cria a
-- CAMADA DE DADO — nenhum código de produto ainda lê essas colunas/tabela
-- nesta fase, então nada muda no comportamento de nenhuma empresa hoje
-- (Liga dos Sonhos e as demais continuam exatamente como estão).
--
-- Regra de arquitetura (ver CLAUDE.md): tudo que é específico de setor vive
-- dentro da ficha (config jsonb), nunca em tabela/coluna/código próprio.
--
-- Tudo dentro de uma transação: se algo no meio falhar, nada fica pela
-- metade. E tudo é repetível sem erro (if not exists / drop+create de
-- policy / on conflict do nothing) — rodar duas vezes não quebra nem
-- duplica nada.

begin;

create table if not exists vertical_playbooks (
  key text primary key,
  name text not null,
  version int not null default 1,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table vertical_playbooks enable row level security;

-- Mesmo padrão já usado em business_types: leitura livre pra qualquer
-- usuário logado (empresas precisam ler a própria ficha), escrita só owner.
-- drop+create em vez de "if not exists" porque CREATE POLICY não suporta
-- essa cláusula — isso é o que torna repetir a migration seguro.
drop policy if exists vertical_playbooks_read on vertical_playbooks;
create policy vertical_playbooks_read on vertical_playbooks
  for select using (true);

drop policy if exists vertical_playbooks_owner_write on vertical_playbooks;
create policy vertical_playbooks_owner_write on vertical_playbooks
  for all using (
    exists (select 1 from user_roles ur where ur.email = (auth.jwt() ->> 'email') and ur.role = 'owner')
  ) with check (
    exists (select 1 from user_roles ur where ur.email = (auth.jwt() ->> 'email') and ur.role = 'owner')
  );

-- Qual ficha cada TIPO de negócio aponta por padrão (o dono edita isso no
-- painel de Tipos de Negócio). Default 'generico' preenche as 7 linhas que
-- já existem hoje sem precisar de UPDATE manual.
alter table business_types add column if not exists vertical_key text not null default 'generico';

-- Qual ficha CADA EMPRESA usa de fato (pode divergir do tipo, se um dia
-- precisar) + respostas das perguntas extras da ficha. Default 'generico'
-- e '{}' preenchem as empresas existentes automaticamente — nada muda pra
-- elas.
alter table companies add column if not exists vertical_key text not null default 'generico';
alter table companies add column if not exists playbook_answers jsonb not null default '{}'::jsonb;

-- Ficha genérica — representa o comportamento de HOJE (sem nenhuma
-- instrução extra de setor). Qualquer código futuro que ler uma ficha vazia
-- assim deve simplesmente não mudar nada do que já faz.
insert into vertical_playbooks (key, name, version, config, enabled) values (
  'generico',
  'Genérico',
  1,
  '{
    "vocabulary": { "item": "Produto", "catalog": "Meus produtos", "lead": "Lead", "conversion": "Conversão", "sale": "Venda" },
    "catalog_fields": { "required": ["fotos"], "optional": ["descricao", "preco"] },
    "onboarding_questions": [],
    "pillars": {},
    "adjustments": [],
    "item_package": [],
    "hooks_by_pillar": {},
    "ctas": {},
    "tone": "",
    "rules": [],
    "dm_qualification": { "questions": [], "goal": "" },
    "metrics": { "primary": "", "intent": [], "do_not_optimize": [] },
    "setup_checklist": []
  }'::jsonb,
  true
) on conflict (key) do nothing;

-- Ficha piloto: Imóveis · Rio de Janeiro · Instagram.
insert into vertical_playbooks (key, name, version, config, enabled) values (
  'imoveis_rio',
  'Imóveis · Rio de Janeiro',
  1,
  '{
    "vocabulary": { "item": "Imóvel", "catalog": "Meus imóveis", "lead": "Interessado", "conversion": "Visita agendada", "sale": "Negócio fechado" },
    "catalog_fields": {
      "required": ["fotos_min_5", "tipo", "bairro", "venda_ou_aluguel", "preco", "quartos", "m2"],
      "optional": ["vagas", "condominio", "iptu", "andar", "vista", "lazer", "perto_de", "video_tour", "detalhe_que_ninguem_percebe"]
    },
    "onboarding_questions": [
      { "key": "transacao", "label": "Você trabalha com venda, aluguel ou os dois?", "type": "select", "options": ["Venda", "Aluguel", "Os dois"] },
      { "key": "faixa_preco", "label": "Qual a faixa de preço que você mais trabalha?", "type": "select", "options": ["Até R$500 mil", "R$500 mil–R$1,5 mi", "Acima de R$1,5 mi"] },
      { "key": "bairros", "label": "Quais bairros você atende (até 5)?", "type": "multi_text", "max": 5 },
      { "key": "cliente_tipico", "label": "Qual seu cliente típico?", "type": "select", "options": ["Família", "Primeiro imóvel", "Investidor", "De fora do Rio", "Aposentado"] },
      { "key": "creci", "label": "Qual seu CRECI?", "type": "text" },
      { "key": "carteira", "label": "Quantos imóveis você tem na carteira hoje?", "type": "select", "options": ["1–5", "6–20", "20+"] }
    ],
    "pillars": { "imoveis": 30, "bairro_estilo_vida": 25, "mercado": 20, "educacao": 15, "marca_pessoal_prova_social": 10 },
    "adjustments": [
      { "when": "carteira == 1-5", "then": "aumenta o peso de bairro_estilo_vida e educacao" },
      { "when": "carteira == 20+", "then": "aumenta o peso de imoveis" },
      { "when": "faixa_preco", "then": "muda o tom e os exemplos de valor" }
    ],
    "item_package": [
      "carrossel_tour", "reels_tour_fotos_reais", "reels_o_que_compra_no_bairro",
      "post_detalhe_que_voce_nao_viu", "post_3_coisas_perto", "stories_enquete_pagaria",
      "stories_caixa_perguntas", "post_pov_pegou_a_chave"
    ],
    "hooks_by_pillar": {
      "mercado": ["comparação de preço entre bairros", "os preços no Rio estão caindo?"],
      "educacao": ["o que ninguém te conta sobre morar em...", "quanto preciso ganhar pra financiar R$X?"],
      "marca_pessoal_prova_social": ["bastidores / entrega de chaves"]
    },
    "ctas": { "imovel": "Comente VISITA", "educacao": "Comente SIMULAÇÃO", "bairro_mercado": "Salva / Manda pra quem tá procurando" },
    "tone": "Próximo, carioca, direto nos números; sem \"oportunidade imperdível\"",
    "rules": [
      "Foto sempre real, nunca gerada por IA",
      "Nunca inventar preço, m², condomínio ou dado de mercado",
      "Nunca prometer valorização",
      "CRECI sempre visível na bio e nos anúncios",
      "Nada publica sem aprovação do dono"
    ],
    "dm_qualification": { "questions": ["comprar ou alugar", "faixa de preço", "bairros", "prazo/financiamento"], "goal": "agendar visita" },
    "metrics": { "primary": "DMs + comentários-palavra-chave por item", "intent": ["salvamentos", "compartilhamentos", "respostas de stories"], "do_not_optimize": ["curtidas", "seguidores"] },
    "setup_checklist": ["Perfil profissional conectado", "Bio com bairros/CRECI/CTA", "Foto de perfil", "Destaques: Imóveis/Bairros/Clientes/Quem sou eu", "Link na bio", "Cadastrar os 3 primeiros imóveis"]
  }'::jsonb,
  true
) on conflict (key) do nothing;

-- Novo tipo de negócio selecionável no onboarding, já apontando pra ficha
-- piloto. Linha nova — não mexe em nenhum tipo existente.
insert into business_types (label, sort, enabled, vertical_key)
values ('Imobiliária / Corretor', 80, true, 'imoveis_rio')
on conflict (label) do nothing;

commit;
