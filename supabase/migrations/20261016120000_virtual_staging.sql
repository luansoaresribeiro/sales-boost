-- Mobiliar virtualmente (Higgsfield, Qwen Image 3 Edit) — pedido do dono,
-- 2026-10-14. A foto REAL de um cômodo vazio ganha móveis; a arquitetura
-- (paredes, piso, janelas, vista) não muda. Custa por foto → teto mensal por
-- empresa (VIRTUAL_STAGING_MONTHLY_CAP) e só com plano. O resultado nunca
-- substitui a foto real: o dono escolhe "usar no imóvel" e ela entra em
-- meta.staged_photos (lista separada — vídeos e tour continuam só com as
-- fotos reais), e todo post que usar uma delas leva o aviso da ficha na
-- legenda (regra 4: texto só na legenda).
create table if not exists public.virtual_staging (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  item_id uuid not null references public.marketing_ai_knowledge(id) on delete cascade,
  source_url text not null,
  style text not null,
  job_ref text,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  attempts int not null default 1,
  result_url text,
  created_at timestamptz not null default now()
);
create index if not exists virtual_staging_company_month on public.virtual_staging (company_id, created_at desc);

alter table public.virtual_staging enable row level security;
-- O dono só LÊ as próprias; criar/avançar é sempre pela function (service role).
drop policy if exists virtual_staging_owner_read on public.virtual_staging;
create policy virtual_staging_owner_read on public.virtual_staging for select
  using (company_id in (select id from public.companies where user_id = auth.uid()));

-- Instrução por estilo + aviso da legenda, na ficha (regra 6).
update public.vertical_playbooks
set config = jsonb_set(coalesce(config, '{}'::jsonb), '{virtual_staging}', $json${
  "base": "Virtual staging of this exact empty room in a real-estate photo. Add tasteful, realistic furniture and decor that fit the room's size and purpose. Keep the architecture 100% identical: same walls, floor, ceiling, windows, doors, view, light direction and camera angle. Keep every built-in element exactly as it is. Photorealistic, natural light. No text, no letters, no logos, no watermark, no people.",
  "negative": "changed walls, changed floor, changed windows, changed view, distorted perspective, extra doors, text, letters, logo, watermark, people, cartoon, render look",
  "styles": [
    { "key": "moderno", "label": { "pt": "Moderno", "en": "Modern" }, "prompt": "Modern contemporary style, neutral palette, clean lines, light wood and soft textiles." },
    { "key": "aconchegante", "label": { "pt": "Aconchegante", "en": "Cozy" }, "prompt": "Warm cozy style, earthy tones, natural materials, plants, soft rugs and warm lamps." },
    { "key": "classico", "label": { "pt": "Clássico", "en": "Classic" }, "prompt": "Elegant classic style, refined furniture, warm neutral colors, framed art and elegant lighting." }
  ],
  "disclosure": "📌 Imagem mobiliada virtualmente — os móveis são ilustrativos e não fazem parte do imóvel."
}$json$::jsonb)
where key = 'imoveis_rio';
