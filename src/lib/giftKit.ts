// Kit grátis (decisão do dono 2026-10-11, docs/DECISIONS.md): 2 fotos de
// cômodos → 1 vídeo "drone" de cada + 1 foto de destaque → 1 criativo de
// design (foto real tratada + texto do nosso modelo de arte). Pode nascer no
// cadastro do diagnóstico (diagnosis-gift, antes da conta) ou no painel
// (trial-video). Mesmo número de fotos que _shared/freeKit.ts.
import { supabase } from './supabase'
import { processImageTo4x5 } from './imageProcessing'

export const KIT_ROOMS = 2
export const KIT_PHOTOS = KIT_ROOMS + 1 // + 1 foto de destaque (criativo)

const FN = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/diagnosis-gift`

// O presente só existe pro setor que tem o texto do criativo na ficha
// (config.gift_creative — regra 6: nada de setor no código).
export async function giftEnabled(verticalKey: string): Promise<boolean> {
  if (!verticalKey || verticalKey === 'generico') return false
  try {
    const { data } = await supabase.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
    return !!(data?.config as { gift_creative?: { headline?: string } } | undefined)?.gift_creative?.headline
  } catch { return false }
}

async function callGift(body: Record<string, unknown>): Promise<{ status: number; data: Record<string, unknown> }> {
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anon}`, apikey: anon },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

export type GiftStart = 'started' | 'already_used' | 'cap_reached' | 'error'

// Envia as 3 fotos (já recortadas em 4:5, JPEG) por links temporários e começa
// o kit. Nunca lança erro: quem chama segue pro resultado do diagnóstico.
export async function sendDiagnosisGift(diagnosticId: string, files: File[]): Promise<GiftStart> {
  if (files.length !== KIT_PHOTOS) return 'error'
  try {
    const up = await callGift({ action: 'upload_urls', diagnostic_id: diagnosticId })
    const { bucket, paths, tokens } = up.data as { bucket?: string; paths?: string[]; tokens?: string[] }
    if (up.status !== 200 || !bucket || paths?.length !== KIT_PHOTOS || tokens?.length !== KIT_PHOTOS) return 'error'
    await Promise.all(files.map(async (file, i) => {
      const blob = await processImageTo4x5(file)
      const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(paths[i], tokens[i], blob, { contentType: 'image/jpeg' })
      if (error) throw error
    }))
    const st = await callGift({ action: 'start', diagnostic_id: diagnosticId })
    if (st.data.status === 'already_used') return 'already_used'
    if (st.data.status === 'cap_reached') return 'cap_reached'
    return st.status === 200 ? 'started' : 'error'
  } catch { return 'error' }
}

export interface GiftView { status: 'none' | 'processing' | 'completed' | 'failed'; done: number; total: number }

// Andamento do kit do diagnóstico (cada consulta também faz a geração andar).
export async function diagnosisGiftStatus(diagnosticId: string): Promise<GiftView> {
  const { data } = await callGift({ action: 'status', diagnostic_id: diagnosticId })
  const status = (['processing', 'completed', 'failed'].includes(String(data.status)) ? data.status : 'none') as GiftView['status']
  return { status, done: Number(data.done ?? 0), total: Number(data.total ?? KIT_ROOMS) }
}
