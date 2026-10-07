-- Growth Score (etapa 2b, fatia 1): dados do Instagram coletados pelo scraper no diagnóstico.
-- Aditiva e opcional (nullable); não muda RLS. Diagnósticos antigos ficam com NULL.
alter table public.diagnostics add column if not exists instagram_data jsonb;
