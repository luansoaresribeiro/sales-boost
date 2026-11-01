-- Etapa 4 (Parte A) da Inteligência comercial — plano da oportunidade aprovada.
-- Aditiva e idempotente: só acrescenta 3 colunas nuláveis. Sem cron, sem mudar RLS.
--
-- plan              = o mini-plano (público, objetivo, mensagem, formato sugerido, CTA, como medir…),
--                     escrito pela function marketing-ai (service role) depois de validado em código.
-- plan_generated_at = quando o plano foi gerado (refazer o plano atualiza e ZERA a aprovação).
-- plan_approved_at  = quando o dono aprovou o plano (null = ainda não aprovado). Aprovar só guarda a
--                     decisão: nada é publicado nem enviado (a geração das peças é a Parte B).
--
-- O grant de UPDATE do cliente NÃO muda (continua só status, decided_at, decided_by): o cliente não
-- consegue escrever nestas colunas; só a function, com a service role.
--
-- Como reverter (as colunas só guardam o plano; a oportunidade em si não é afetada):
--   alter table public.growth_opportunities
--     drop column if exists plan, drop column if exists plan_generated_at, drop column if exists plan_approved_at;

alter table public.growth_opportunities
  add column if not exists plan jsonb,
  add column if not exists plan_generated_at timestamptz,
  add column if not exists plan_approved_at timestamptz;
