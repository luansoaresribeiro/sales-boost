-- Liga business_type -> vertical_key automaticamente. Quando o business_type
-- de uma empresa é definido/alterado, busca o vertical_key correspondente em
-- business_types; se não achar (ou business_type for null), cai em
-- 'generico'. Dispara em todo INSERT e em UPDATE só quando business_type
-- muda (não em qualquer update da empresa).
--
-- Não roda pras 2 empresas já existentes (nenhuma tem business_type
-- "Imobiliária / Corretor") a menos que o business_type delas mude depois —
-- comportamento intencional, sem backfill retroativo.

begin;

create or replace function sync_company_vertical_key() returns trigger as $$
declare
  found_key text;
begin
  select bt.vertical_key into found_key
  from business_types bt
  where bt.label = NEW.business_type
  limit 1;

  NEW.vertical_key := coalesce(found_key, 'generico');
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_company_vertical_key on companies;
create trigger trg_sync_company_vertical_key
  before insert or update of business_type on companies
  for each row execute function sync_company_vertical_key();

commit;
