-- Pacote B2 item 9: "ignorar tendência" (marketing_ai_trends). Aditiva; a evidência nunca é apagada.
-- COMO REVERTER (comentado; NÃO colar no MCP):
--   revoke update (status, ignored_at) on public.marketing_ai_trends from authenticated;
--   grant update on public.marketing_ai_trends to authenticated;
--   drop policy if exists "users update own company marketing_ai_trends" on public.marketing_ai_trends;
--   alter table public.marketing_ai_trends drop column if exists ignored_at;
--   alter table public.marketing_ai_trends drop column if exists status;
begin;
alter table public.marketing_ai_trends add column if not exists status text not null default 'active';
alter table public.marketing_ai_trends add column if not exists ignored_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'marketing_ai_trends_status_check' and conrelid = 'public.marketing_ai_trends'::regclass) then
    alter table public.marketing_ai_trends add constraint marketing_ai_trends_status_check check (status in ('active','ignored'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='marketing_ai_trends' and policyname='users update own company marketing_ai_trends') then
    create policy "users update own company marketing_ai_trends" on public.marketing_ai_trends for update to authenticated
      using (company_id in (select id from public.companies where user_id = auth.uid()))
      with check (company_id in (select id from public.companies where user_id = auth.uid()));
  end if;
end $$;
revoke update on public.marketing_ai_trends from authenticated;
grant update (status, ignored_at) on public.marketing_ai_trends to authenticated;
commit;
