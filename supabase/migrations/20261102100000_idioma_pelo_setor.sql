-- Idioma pelo setor (decisão do dono 2026-11-02).
-- Problema: o cadastro nasce em inglês (companies.language padrão 'en', decisão de 27/10), então um corretor do Rio
-- recebia legendas e ganchos em inglês. Agora a FICHA do setor diz o idioma padrão (config.default_language) e a
-- empresa herda esse idioma quando entra num setor pela primeira vez (cadastro/onboarding). Nada de setor no código:
-- o idioma vive na ficha (regra 6). Setor sem default_language segue como antes (inglês).
-- Não mexe em empresa existente nem em quem já tinha setor (a troca de setor depois não muda o idioma escolhido).
--
-- REVERTER:
--   create or replace function sync_company_vertical_key() ... (versão de 20260929120000_company_vertical_key_trigger.sql)
--   update vertical_playbooks set config = config - 'default_language' where key = 'imoveis_rio';

begin;

update vertical_playbooks
   set config = jsonb_set(config, '{default_language}', '"pt"')
 where key = 'imoveis_rio'
   and config->'default_language' is null;

create or replace function sync_company_vertical_key() returns trigger as $$
declare
  found_key text;
  setor_lang text;
begin
  select bt.vertical_key into found_key
  from business_types bt
  where bt.label = NEW.business_type
  limit 1;

  NEW.vertical_key := coalesce(found_key, 'generico');

  -- Primeira vez num setor de verdade (INSERT, ou saindo de 'generico'/sem setor): herda o idioma da ficha.
  if TG_OP = 'INSERT' or coalesce(OLD.vertical_key, 'generico') = 'generico' then
    select vp.config->>'default_language' into setor_lang
    from vertical_playbooks vp
    where vp.key = NEW.vertical_key;
    if setor_lang in ('pt', 'en') then
      NEW.language := setor_lang;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql;

commit;
