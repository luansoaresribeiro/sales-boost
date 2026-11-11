-- Etapa 3 do Tour virtual (2026-11-11): abertura de fora com movimento de DRONE, mas só dentro do que a foto real
-- mostra (regra 4: a IA nunca cria prédio, andar, vista ou paisagem além da borda da foto). Só a ficha imoveis_rio.
-- O corte automático de fora pra dentro é código genérico (_shared/tourOrder.ts, passagem 'enter').
update vertical_playbooks
set config = jsonb_set(config, '{clip_prompts,opening}', to_jsonb(
  'Cinematic aerial drone shot of this exact real place: stabilized, a slow gentle rise with a slow push-in, golden natural light, premium real-estate film look. '
  || 'Stay strictly inside what the photo already shows — never reveal anything beyond the edges of the frame: no new buildings, floors, rooms, people, vehicles, signs or scenery. '
  || 'Keep the building, the landscape and the view exactly as in the photo — do not add, remove or change anything. No people, no text, no logos.'::text), true)
where key = 'imoveis_rio';

-- Rollback (instrução anterior, guardada em 2026-11-11):
-- update vertical_playbooks set config = jsonb_set(config, '{clip_prompts,opening}', to_jsonb(
--   'Cinematic establishing shot from outside, slow smooth camera movement (a gentle push-in or slight pan) that stays inside what the photo already shows, golden natural light. Do not reveal, invent or add anything that is not in the frame: no new buildings, floors, rooms, people, vehicles, signs or scenery beyond the edges. Keep the building, the landscape and the view exactly as in the photo — do not add, remove or change anything. No people, no text, no logos.'::text), true)
-- where key = 'imoveis_rio';
