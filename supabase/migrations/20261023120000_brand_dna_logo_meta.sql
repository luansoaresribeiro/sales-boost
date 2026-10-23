-- Logo em PNG transparente nos criativos (2026-10-23, PLANO-CRIATIVOS "Correções pós-fase 3").
-- Aditivo e idempotente: uma coluna nova, nula por padrão. Nenhuma linha existente muda;
-- quem não tem logo_meta continua renderizando exatamente como antes.
--
-- logo_meta = { src, png_url, kind: 'logo' | 'foto', luma, bg_removed, w?, h? }
--   src      = o logo_url PARA o qual o PNG foi feito. Quem lê só usa png_url se src = logo_url atual
--              (logo trocada depois → meta velha é ignorada).
--
-- DESFAZER (só some o PNG preparado; o logo original em logo_url não é tocado):
--   alter table public.brand_dna drop column if exists logo_meta;

alter table public.brand_dna add column if not exists logo_meta jsonb;
