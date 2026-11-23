-- Sair da VPS (dono, 23/11): interruptor do modo fila do estúdio de vídeo. Ligado = o tour entra na fila e o estúdio
-- do GitHub Actions (a cada ~10 min) monta; desligado = como antes (VPS online). Só acrescenta; nasce desligado.
insert into public.feature_flags (key, label, enabled)
values ('studio_queue', 'Estúdio de vídeo em modo fila (GitHub Actions no lugar da VPS)', false)
on conflict (key) do nothing;
-- Desfazer: update public.feature_flags set enabled = false where key = 'studio_queue';
