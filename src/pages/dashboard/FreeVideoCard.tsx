// Tour virtual grátis do acesso grátis (decisões do dono 2026-10-08, docs/DECISIONS.md):
// o cliente envia TOUR_PHOTOS fotos reais na ordem da visita → supabase/functions/
// trial-video gera um trecho de 5 s por foto (Kling via Higgsfield) e cola num Reel
// único de ~30 s (1 por conta, teto global de 30/mês). Todas as fotos passam pelo
// mesmo recorte 4:5 (processImageTo4x5) — os trechos precisam ter o mesmo tamanho
// pra serem colados sem recodificar. Quando fica pronto, abre o
// popup do cupom (1º mês R$1.449) com o que o plano oferece. A data em que o
// popup aparece conta os 7 dias do cupom (coupon_offer_shown_at, servidor).
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { processImageTo4x5 } from '../../lib/imageProcessing'
import { useLang } from '../../contexts/LanguageContext'
import { CARD, MUTED, ORANGE, D, SUPABASE_URL } from './marketingAi/shared'

type State = 'loading' | 'none' | 'uploading' | 'processing' | 'completed' | 'cap' | 'error'

const POLL_MS = 10_000
// Igual a TOUR_PHOTOS_TRIAL da função trial-video (padrão 6).
const TOUR_PHOTOS = 6

const TX = {
  pt: {
    title: '🎬 Seu tour virtual grátis',
    intro: `Escolha ${TOUR_PHOTOS} fotos reais do imóvel, na ordem da visita (ex.: entrada, sala, cozinha, quarto, banheiro, varanda). A gente transforma num vídeo-tour de ~30 segundos com movimento de câmera — sem inventar nada e sem texto por cima.`,
    tips: 'Dicas: fotos bem iluminadas, sem pessoas e sem texto escrito por cima. A ordem em que você escolhe é a ordem do vídeo.',
    pick: 'Escolher fotos →', addMore: 'Adicionar fotos', remove: 'Tirar', count: (n: number) => `${n} de ${TOUR_PHOTOS} fotos`,
    create: 'Criar meu tour →', uploading: 'Enviando suas fotos…',
    processing: 'Seu tour está sendo criado. Leva alguns minutos — pode continuar usando o painel, esta tela atualiza sozinha.',
    progress: (d: number, t: number) => `${d} de ${t} cômodos prontos`,
    ready: 'Seu vídeo está pronto!', download: 'Baixar vídeo', seeOffer: 'Ver o que o plano faz por você →',
    cap: 'Os vídeos grátis deste mês acabaram. O seu entra na fila do próximo mês — ou ative o plano e receba agora.',
    failed: 'Não deu certo com essas fotos. Tente de novo, com fotos bem iluminadas e sem texto por cima.',
    errGeneric: 'Não consegui iniciar seu vídeo agora. Tente de novo em alguns minutos.',
    activate: 'Ativar meu plano →',
    mTitle: 'Gostou? Imagine isso todo mês.',
    mSub: 'Com o plano, o Sales Boost cuida do seu marketing — e você só aprova.',
    b1: '🎬 12 vídeos por mês, feitos com as suas fotos reais',
    b2: '📈 Planejamento completo para alavancar a empresa: estratégia, calendário, público e metas',
    b3: '🖼️ Posts e criativos na quantidade que a estratégia pedir',
    b4: '💬 Respostas a comentários e mensagens, virando contato de cliente',
    b5: '✅ Nada vai ao ar sem a sua aprovação',
    priceFrom: 'R$2.449/mês', priceTo: 'R$1.449', priceNote: 'no 1º mês com o seu cupom', valid: 'Cupom válido por 7 dias.',
    later: 'Agora não', close: 'Fechar',
  },
  en: {
    title: '🎬 Your free virtual tour',
    intro: `Choose ${TOUR_PHOTOS} real photos of the property, in visiting order (e.g. entrance, living room, kitchen, bedroom, bathroom, balcony). We turn them into a ~30-second video tour with camera movement — nothing made up and no text on top.`,
    tips: 'Tips: well-lit photos, no people and no text written on them. The order you pick is the order of the video.',
    pick: 'Choose photos →', addMore: 'Add photos', remove: 'Remove', count: (n: number) => `${n} of ${TOUR_PHOTOS} photos`,
    create: 'Create my tour →', uploading: 'Uploading your photos…',
    processing: 'Your tour is being created. It takes a few minutes — keep using the dashboard, this card updates by itself.',
    progress: (d: number, t: number) => `${d} of ${t} rooms ready`,
    ready: 'Your video is ready!', download: 'Download video', seeOffer: 'See what the plan does for you →',
    cap: "This month's free videos are gone. Yours goes to next month's queue — or activate the plan and get it now.",
    failed: "Those photos didn't work. Try again with well-lit photos and no text on them.",
    errGeneric: "I couldn't start your video right now. Try again in a few minutes.",
    activate: 'Activate my plan →',
    mTitle: 'Like it? Imagine this every month.',
    mSub: 'With the plan, Sales Boost runs your marketing — you just approve.',
    b1: '🎬 12 videos a month, made from your real photos',
    b2: '📈 A complete plan to grow your business: strategy, calendar, audience and goals',
    b3: '🖼️ Posts and creatives in the amount the strategy calls for',
    b4: '💬 Replies to comments and messages, turning them into customer contacts',
    b5: '✅ Nothing goes live without your approval',
    priceFrom: 'R$2,449/month', priceTo: 'R$1,449', priceNote: 'in the 1st month with your coupon', valid: 'Coupon valid for 7 days.',
    later: 'Not now', close: 'Close',
  },
}

async function callFn(body: Record<string, unknown>): Promise<{ status: number; data: Record<string, unknown> }> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/trial-video`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

export default function FreeVideoCard({ companyId }: { companyId: string }) {
  const tx = TX[useLang().lang]
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>('loading')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [modal, setModal] = useState(false)
  // Fotos escolhidas, na ordem da visita (a ordem da escolha é a ordem do vídeo).
  const [picked, setPicked] = useState<{ file: File; preview: string }[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const pickedRef = useRef(picked)
  useEffect(() => { pickedRef.current = picked }, [picked])
  useEffect(() => () => pickedRef.current.forEach(p => URL.revokeObjectURL(p.preview)), [])

  const applyStatus = (d: Record<string, unknown>, openModal: boolean) => {
    if (d.status === 'completed' && typeof d.video_url === 'string') {
      setVideoUrl(d.video_url); setState('completed')
      if (openModal) setModal(true)
    } else if (d.status === 'processing') {
      if (typeof d.done === 'number' && typeof d.total === 'number') setProgress({ done: d.done, total: d.total })
      setState('processing')
    }
    else if (d.status === 'failed') { setMsg(tx.failed); setState('none') }
    else setState('none')
  }

  // Estado inicial (sem abrir o popup de novo pra quem já viu o vídeo antes).
  useEffect(() => {
    let alive = true
    callFn({ action: 'status' }).then(({ data }) => { if (alive) applyStatus(data, false) }).catch(() => { if (alive) setState('none') })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  // Enquanto processa, consulta a cada 10s; ao terminar, abre o popup do cupom.
  useEffect(() => {
    if (state !== 'processing') return
    const t = setTimeout(async () => {
      try { applyStatus((await callFn({ action: 'status' })).data, true) } catch { setState('processing') }
    }, POLL_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // Popup aberto = cupom "visto" (o servidor marca só na 1ª vez).
  useEffect(() => { if (modal) void callFn({ action: 'coupon_seen' }).catch(() => {}) }, [modal])

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return
    setMsg('')
    const room = TOUR_PHOTOS - picked.length
    setPicked([...picked, ...Array.from(files).slice(0, room).map(file => ({ file, preview: URL.createObjectURL(file) }))])
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeAt = (i: number) => {
    URL.revokeObjectURL(picked[i].preview)
    setPicked(picked.filter((_, j) => j !== i))
  }

  const onCreate = async () => {
    if (picked.length !== TOUR_PHOTOS) return
    setMsg(''); setState('uploading')
    try {
      const batch = crypto.randomUUID()
      const photo_urls = await Promise.all(picked.map(async ({ file }, i) => {
        const blob = await processImageTo4x5(file)
        const path = `renders/${companyId}/trial-tour-${batch}-${i + 1}.jpg`
        const { error } = await supabase.storage.from('post-images').upload(path, blob, { contentType: 'image/jpeg' })
        if (error) throw error
        return supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
      }))
      const { status, data } = await callFn({ action: 'start', photo_urls })
      if (status === 429 && data.status === 'cap_reached') { setState('cap'); return }
      if (status === 409) { applyStatus((await callFn({ action: 'status' })).data, false); return }
      if (status >= 400) { setMsg(typeof data.error === 'string' ? data.error : tx.errGeneric); setState('error'); return }
      setProgress({ done: 0, total: TOUR_PHOTOS }); setState('processing')
    } catch {
      setMsg(tx.errGeneric); setState('error')
    }
  }

  if (state === 'loading') return null
  const btn = { padding: '11px 18px', background: ORANGE, color: '#000', fontWeight: 800, fontSize: '13px', border: 'none', borderRadius: '11px', cursor: 'pointer', fontFamily: D } as const

  return (
    <div style={{ background: CARD, border: '1px solid rgba(255,109,41,0.35)', borderRadius: '16px', padding: '20px 22px', fontFamily: D }}>
      <div style={{ fontSize: '16px', fontWeight: 800, color: 'white', marginBottom: '6px' }}>{tx.title}</div>

      {(state === 'none' || state === 'error' || state === 'uploading') && (
        <>
          <p style={{ fontSize: '13px', color: MUTED, lineHeight: 1.6, margin: '0 0 6px' }}>{tx.intro}</p>
          <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, margin: '0 0 14px' }}>{tx.tips}</p>
          {msg && <p style={{ fontSize: '12.5px', color: '#f87171', margin: '0 0 12px' }}>{msg}</p>}
          <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={e => onFiles(e.target.files)} />
          {picked.length > 0 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: '8px', marginBottom: '8px', maxWidth: '520px' }}>
                {picked.map((p, i) => (
                  <div key={p.preview} style={{ position: 'relative', aspectRatio: '4 / 5', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                    <img src={p.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <span style={{ position: 'absolute', top: 4, left: 4, minWidth: 18, height: 18, borderRadius: 9, background: ORANGE, color: '#000', fontSize: '11px', fontWeight: 800, textAlign: 'center', lineHeight: '18px' }}>{i + 1}</span>
                    {state !== 'uploading' && (
                      <button onClick={() => removeAt(i)} aria-label={tx.remove}
                        style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '11px', cursor: 'pointer' }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '12px', color: MUTED, marginBottom: '12px' }}>{tx.count(picked.length)}</div>
            </>
          )}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {picked.length < TOUR_PHOTOS && (
              <button style={picked.length ? { ...btn, background: 'transparent', color: ORANGE, border: '1px solid rgba(255,109,41,0.4)' } : btn} onClick={() => fileRef.current?.click()}>
                {picked.length ? tx.addMore : tx.pick}
              </button>
            )}
            {picked.length === TOUR_PHOTOS && (
              <button style={{ ...btn, opacity: state === 'uploading' ? 0.6 : 1, cursor: state === 'uploading' ? 'wait' : 'pointer' }} disabled={state === 'uploading'} onClick={() => void onCreate()}>
                {state === 'uploading' ? tx.uploading : tx.create}
              </button>
            )}
          </div>
        </>
      )}

      {state === 'processing' && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 28, height: 28, flexShrink: 0, border: '3px solid rgba(255,109,41,0.15)', borderTopColor: ORANGE, borderRadius: '50%', animation: 'fvspin 1s linear infinite' }} />
          <style>{'@keyframes fvspin{to{transform:rotate(360deg)}}'}</style>
          <div>
            <p style={{ fontSize: '13px', color: MUTED, lineHeight: 1.6, margin: 0 }}>{tx.processing}</p>
            {progress && <p style={{ fontSize: '12px', color: ORANGE, fontWeight: 700, margin: '4px 0 0' }}>{tx.progress(progress.done, progress.total)}</p>}
          </div>
        </div>
      )}

      {state === 'cap' && (
        <>
          <p style={{ fontSize: '13px', color: MUTED, lineHeight: 1.6, margin: '0 0 14px' }}>{tx.cap}</p>
          <button style={btn} onClick={() => navigate('/dashboard/trial')}>{tx.activate}</button>
        </>
      )}

      {state === 'completed' && videoUrl && (
        <>
          <div style={{ fontSize: '13px', color: '#4ade80', fontWeight: 700, marginBottom: '10px' }}>{tx.ready}</div>
          <video src={videoUrl} controls playsInline style={{ width: '100%', maxWidth: '360px', borderRadius: '12px', background: '#000', display: 'block' }} />
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
            <a href={videoUrl} download style={{ ...btn, background: 'transparent', color: ORANGE, border: `1px solid rgba(255,109,41,0.4)`, textDecoration: 'none' }}>{tx.download}</a>
            <button style={btn} onClick={() => setModal(true)}>{tx.seeOffer}</button>
          </div>
        </>
      )}

      {modal && videoUrl && (
        <div role="dialog" aria-modal="true" onClick={() => setModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ position: 'relative', width: '100%', maxWidth: '460px', background: CARD, border: '1px solid rgba(255,109,41,0.35)', borderRadius: '18px', padding: '22px', fontFamily: D, boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>
            <button onClick={() => setModal(false)} aria-label={tx.close}
              style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.06)', color: MUTED, cursor: 'pointer' }}>✕</button>
            <video src={videoUrl} autoPlay muted loop playsInline style={{ width: '100%', maxHeight: '38vh', objectFit: 'cover', borderRadius: '12px', background: '#000', display: 'block', marginBottom: '14px' }} />
            <div style={{ fontSize: '19px', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{tx.mTitle}</div>
            <div style={{ fontSize: '12.5px', color: MUTED, marginBottom: '12px' }}>{tx.mSub}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[tx.b1, tx.b2, tx.b3, tx.b4, tx.b5].map(b => <li key={b} style={{ fontSize: '13px', color: 'white', lineHeight: 1.45 }}>{b}</li>)}
            </ul>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,109,41,0.07)', border: '1px solid rgba(255,109,41,0.25)', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', textDecoration: 'line-through' }}>{tx.priceFrom}</span>
              <span style={{ fontSize: '26px', fontWeight: 900, color: ORANGE }}>{tx.priceTo}</span>
              <span style={{ fontSize: '12px', color: MUTED }}>{tx.priceNote}</span>
            </div>
            <div style={{ fontSize: '11.5px', color: MUTED, marginBottom: '14px' }}>{tx.valid}</div>
            <button style={{ ...btn, width: '100%', padding: '14px' }} onClick={() => navigate('/dashboard/trial')}>{tx.activate}</button>
            <button onClick={() => setModal(false)} style={{ display: 'block', width: '100%', marginTop: '8px', padding: '10px', background: 'transparent', border: 'none', color: MUTED, fontSize: '12.5px', cursor: 'pointer', fontFamily: D }}>{tx.later}</button>
          </div>
        </div>
      )}
    </div>
  )
}
