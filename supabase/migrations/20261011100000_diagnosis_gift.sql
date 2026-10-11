-- Presente do diagnóstico (decisão do dono 2026-10-11, docs/DECISIONS.md):
-- no cadastro a pessoa manda fotos reais do imóvel e, junto com o
-- diagnóstico, já começamos o kit grátis — 1 vídeo "drone" por cômodo (2) +
-- 1 criativo de design (foto real tratada pela Higgsfield + texto pelo nosso
-- modelo de arte). O kit nasce ANTES da conta existir, preso ao diagnóstico;
-- quando a conta é criada, o trial-video liga o kit à empresa.

-- 1) video_tours aceita kit sem empresa (ainda), preso ao diagnóstico.
alter table video_tours alter column company_id drop not null;
alter table video_tours add column if not exists diagnostic_id uuid references diagnostics(id) on delete set null;
-- Estado do criativo de design: {photo, job_ref, status, attempts, enhanced_path, final_url}
alter table video_tours add column if not exists creative jsonb;
create unique index if not exists video_tours_one_gift_per_diagnostic on video_tours (diagnostic_id) where diagnostic_id is not null;
-- Toda linha precisa de dono: a empresa OU o diagnóstico.
alter table video_tours drop constraint if exists video_tours_owner_check;
alter table video_tours add constraint video_tours_owner_check check (company_id is not null or diagnostic_id is not null);

-- 2) Instrução de câmera "drone" na ficha de imóveis (regra 6: nada de setor no código).
update vertical_playbooks
set config = jsonb_set(coalesce(config, '{}'::jsonb), '{clip_prompts}',
  coalesce(config->'clip_prompts', '{}'::jsonb) || jsonb_build_object('drone',
    'Smooth cinematic drone-style camera glide through this exact room, like a stabilized FPV drone: start slightly high and wide, then fly gently forward and arc around to reveal the whole space and its best features (windows, view, finishes), ending on the most beautiful angle. Natural light, premium real-estate film look, steady and slow. Keep the room exactly as it is: do not add, remove or change any furniture, object, wall, window or view. No people, no text.'))
where key = 'imoveis_rio';

-- 3) Texto do criativo de design (impresso pelo render-format, nunca pela IA —
-- regra 4). {cidade} vira a cidade do cadastro. Sem número nenhum (regra 5).
update vertical_playbooks
set config = coalesce(config, '{}'::jsonb) || jsonb_build_object('gift_creative', jsonb_build_object(
  'eyebrow', '{cidade}', 'headline', 'Seu próximo lar pode estar aqui', 'cta', 'Comente QUERO'))
where key = 'imoveis_rio';
