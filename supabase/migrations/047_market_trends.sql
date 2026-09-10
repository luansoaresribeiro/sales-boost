-- Reaproveita a marketing_ai_trends já existente (hoje só raciocínio puro da
-- IA, sem grounding real — o próprio prompt dela já admite isso). Adiciona
-- "source" pra distinguir quando a entrada vem de posts reais escaneados
-- (Apify) vs só raciocínio — o Trend Agent prioriza mostrar as reais.
alter table marketing_ai_trends add column if not exists source text;
