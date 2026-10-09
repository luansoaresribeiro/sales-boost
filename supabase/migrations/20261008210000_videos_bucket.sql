-- Vídeo grátis (trial-video): o bucket post-images só aceita imagem (png/jpeg/webp,
-- 5 MB). Vídeo vai pra um bucket PÚBLICO separado, só mp4, até 50 MB.
-- Sem policy de escrita: só o service role (edge function) grava. Leitura
-- pública pela URL (igual post-images). Aditiva e idempotente.
-- DESFAZER: delete from storage.buckets where id = 'videos'; (com o bucket vazio)
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('videos', 'videos', true, array['video/mp4'], 52428800)
on conflict (id) do nothing;
