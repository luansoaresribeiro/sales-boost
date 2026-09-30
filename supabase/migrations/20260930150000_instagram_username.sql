-- Achado investigando uma conexão de Instagram de teste: o callback só
-- salvava instagram_user_id (um número), nunca o @usuario — não dava pra
-- saber, olhando a tela, QUAL conta real estava conectada em cada empresa.
-- Corrige junto com o botão de desconectar, que hoje só zera
-- instagram_user_id e deixa o token de acesso vivo no banco.

begin;

alter table companies add column if not exists instagram_username text;

commit;
