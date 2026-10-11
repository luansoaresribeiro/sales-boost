// Aviso discreto do presente no fim do resultado do diagnóstico (decisão do
// dono 2026-10-11): os vídeos e o criativo ficam prontos NO PAINEL — aqui só
// mostra o andamento e reforça o botão de entrar. Cada consulta também faz a
// geração andar (diagnosis-gift → status).
import { useEffect, useState } from 'react'
import { diagnosisGiftStatus, type GiftStart, type GiftView } from '../../lib/giftKit'

const ORANGE = '#FF6D29'
const MUTED = '#BABABA'
const POLL_MS = 15_000

const TX = {
  pt: {
    title: '🎁 Seu presente está sendo preparado',
    titleDone: '🎁 Seu presente está pronto',
    body: '2 vídeos com movimento de câmera tipo drone + 1 criativo com acabamento profissional, feitos com as suas fotos. Eles vão estar no seu painel.',
    bodyDone: '2 vídeos + 1 criativo feitos com as suas fotos. Entre no painel pra ver e baixar.',
    progress: (d: number, t: number) => `${d} de ${t} vídeos prontos`,
    used: 'Este e-mail ou Instagram já recebeu o presente antes. No painel você vê o que o plano faz por você.',
    cap: 'Os presentes deste mês acabaram. Entre no painel pra ver o que o plano faz por você.',
    error: 'Não conseguimos receber suas fotos agora. Sem problema: no painel você envia de novo e cria seus vídeos grátis.',
  },
  en: {
    title: '🎁 Your gift is being prepared',
    titleDone: '🎁 Your gift is ready',
    body: '2 videos with drone-like camera movement + 1 creative with a professional finish, made from your photos. They will be in your dashboard.',
    bodyDone: '2 videos + 1 creative made from your photos. Enter the dashboard to see and download them.',
    progress: (d: number, t: number) => `${d} of ${t} videos ready`,
    used: 'This email or Instagram has already received the gift. In the dashboard you can see what the plan does for you.',
    cap: "This month's gifts are gone. Enter the dashboard to see what the plan does for you.",
    error: "We couldn't receive your photos right now. No problem: in the dashboard you can send them again and create your free videos.",
  },
}

// Como foi o envio das fotos (guardado pelo cadastro) + andamento do kit.
export function useGift(diagnosticId: string): { sent: GiftStart | null; view: GiftView | null } {
  const [sent] = useState<GiftStart | null>(() => {
    try { return (sessionStorage.getItem(`gift:${diagnosticId}`) as GiftStart | null) } catch { return null }
  })
  const [view, setView] = useState<GiftView | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    diagnosisGiftStatus(diagnosticId).then(v => { if (alive) setView(v) }).catch(() => {})
    return () => { alive = false }
  }, [diagnosticId, tick])
  const running = view?.status === 'processing'
  useEffect(() => {
    if (!running) return
    const h = setTimeout(() => setTick(n => n + 1), POLL_MS)
    return () => clearTimeout(h)
  }, [running, tick])
  return { sent, view }
}

export default function GiftNotice({ sent, view, lang }: { sent: GiftStart | null; view: GiftView | null; lang: 'pt' | 'en' }) {
  const t = TX[lang]
  const box = { borderRadius: 16, padding: '14px 16px', marginBottom: 16, fontSize: 13, lineHeight: 1.55 } as const
  if (view && view.status !== 'none' && view.status !== 'failed') {
    const done = view.status === 'completed'
    return (
      <div role="status" style={{ ...box, background: done ? 'rgba(74,222,128,0.08)' : 'rgba(255,109,41,0.07)', border: `1px solid ${done ? 'rgba(74,222,128,0.35)' : 'rgba(255,109,41,0.3)'}` }}>
        <div style={{ fontWeight: 800, color: 'white', marginBottom: 4 }}>{done ? t.titleDone : t.title}</div>
        <div style={{ color: MUTED }}>{done ? t.bodyDone : t.body}</div>
        {!done && <div style={{ color: ORANGE, fontWeight: 700, fontSize: 12, marginTop: 6 }}>{t.progress(view.done, view.total)}</div>}
      </div>
    )
  }
  const msg = sent === 'already_used' ? t.used : sent === 'cap_reached' ? t.cap : sent === 'error' || view?.status === 'failed' ? t.error : null
  if (!msg) return null
  return <div style={{ ...box, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: MUTED }}>{msg}</div>
}
