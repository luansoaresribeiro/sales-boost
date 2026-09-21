-- Fecha o loop Performance -> Biblioteca -> Testes -> Approvals -> Publicação:
-- dá a `posts` um jeito de guardar o media_id real do Instagram (pra saber
-- que aquele post já foi publicado de verdade, não só "status aprovado"), e
-- dá a `instagram_content_performance` um jeito de apontar de volta pro post
-- interno que a originou, quando dá pra casar os dois pelo media_id.
alter table posts add column if not exists instagram_media_id text;
alter table posts add column if not exists published_at timestamptz;
create index if not exists idx_posts_instagram_media_id on posts(instagram_media_id) where instagram_media_id is not null;

alter table instagram_content_performance add column if not exists source_post_id uuid references posts(id) on delete set null;
create index if not exists idx_icp_source_post on instagram_content_performance(source_post_id) where source_post_id is not null;
