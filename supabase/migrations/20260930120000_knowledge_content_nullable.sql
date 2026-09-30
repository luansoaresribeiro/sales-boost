-- Bug pré-existente achado testando o catálogo novo (Fase 3+4 Etapa A):
-- marketing_ai_knowledge.content é NOT NULL desde a migration original
-- (043_knowledge_library.sql), mas ProductPhotos.tsx (kind='product', já em
-- produção) NUNCA preenche content — só title/image_url/meta. Ou seja,
-- "Produtos" já estava quebrado em produção antes desta migration (insert
-- sempre retornava 23502). O novo Catálogo (CatalogItems.tsx) bateu no
-- mesmo erro. Corrige a causa raiz: content vira opcional (kind='product'/
-- 'layout' são registros só-imagem, nunca tiveram texto de verdade pra
-- guardar ali).

begin;

alter table marketing_ai_knowledge alter column content drop not null;

commit;
