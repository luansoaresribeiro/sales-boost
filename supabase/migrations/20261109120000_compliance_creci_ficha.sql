-- Etapa 1 · PR 1A (2026-11-09, autorizada pelo dono em 07/11): CRECI obrigatório para publicar + rodapé automático.
-- Vive na FICHA (regra 6): o código só lê config.compliance.license (supabase/functions/_shared/compliance.ts e
-- src/lib/license.ts). Sem este bloco, nada muda.
--   answer_key  = pergunta onde a resposta já fica (companies.playbook_answers.creci — a pergunta já existe).
--   pattern     = formato aceito (resposta em maiúsculas, sem pontos): "CRECI-RJ 12345-F", "12345-J", "CRECI 12345", "1234 PJ".
--   types       = F (pessoa física, corretor) e J (pessoa jurídica, imobiliária). O tipo fica como sufixo: "12345-F".
--   footer      = linha acrescentada na legenda na hora de publicar (uma vez só).
--   verify_url  = site do CRECI-RJ, para o dono conferir a inscrição (o link de busca exata não foi confirmado).
--   block_publish_without = publicação comercial sem CRECI válido é recusada. Geração e testes internos não.
-- Aditivo e idempotente (só preenche se ainda não existir). NÃO apaga dados, NÃO mexe em RLS.
--
-- ROLLBACK:
--   update public.vertical_playbooks set config = config #- '{compliance,license}' where key = 'imoveis_rio';
begin;

update public.vertical_playbooks
set config = jsonb_set(
  case when jsonb_typeof(config->'compliance') = 'object' then config else jsonb_set(config, '{compliance}', '{}'::jsonb, true) end,
  '{compliance,license}', $json${
    "answer_key": "creci",
    "name": { "pt": "CRECI", "en": "CRECI (real estate license)" },
    "pattern": "^(?:CRECI)?[^0-9A-Z]*(?:RJ)?[^0-9A-Z]*(?:N[ºO°]?)?[^0-9A-Z]*(?<number>\\d{3,7})[^0-9A-Z]*P?(?<type>[A-Z])?$",
    "types": {
      "F": { "pt": "pessoa física (corretor)", "en": "individual (broker)" },
      "J": { "pt": "pessoa jurídica (imobiliária)", "en": "company (brokerage)" }
    },
    "footer": { "pt": "CRECI-RJ {license}", "en": "CRECI-RJ {license}" },
    "verify_url": "https://www.creci-rj.gov.br/",
    "block_publish_without": true
  }$json$::jsonb, true)
where key = 'imoveis_rio'
  and (config->'compliance'->'license') is null;

commit;
