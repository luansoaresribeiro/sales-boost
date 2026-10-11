// Kit grátis do acesso grátis (decisões do dono 2026-10-09 e 2026-10-11,
// docs/DECISIONS.md): 2 fotos de cômodos → 1 vídeo "drone" de cada + 1 foto de
// destaque → 1 criativo de design (supabase/functions/trial-video; 1 kit por
// conta, teto global de 30/mês). Se a pessoa mandou as fotos no cadastro do
// diagnóstico, o kit já vem pronto (ou em andamento) aqui. É ISCA, não o imóvel
// inteiro: vai pro Instagram com "Comente QUERO". Todas as fotos passam pelo
// mesmo recorte 4:5 (processImageTo4x5). Quando ficam prontos, abre o popup do cupom (1º mês
// R$1.449) com o que o plano oferece. A data em que o popup aparece conta os 7
// dias do cupom (coupon_offer_shown_at, servidor).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { processImageTo4x5 } from '../../lib/imageProcessing'
import { KIT_PHOTOS, KIT_ROOMS } from '../../lib/giftKit'
import KitPhotoPicker from '../../components/KitPhotoPicker'
import { useLang } from '../../contexts/LanguageContext'
import { CARD, MUTED, ORANGE, D, SUPABASE_URL } from './marketingAi/shared'

export type State = 'loading' | 'none' | 'uploading' | 'processing' | 'completed' | 'cap' | 'error'

const POLL_MS = 10_000

const TX = {
  pt: {
    title: '🎁 Seu kit grátis',
    intro: `Escolha ${KIT_ROOMS} fotos reais dos cômodos mais bonitos (cada uma vira um vídeo com movimento de câmera tipo drone) e 1 foto de destaque (vira um criativo com acabamento profissional, pronto pra postar). Nada é inventado e a IA não escreve na foto.`,
    tips: 'Mostre só uma parte do imóvel pra gerar vontade: publique com "Comente QUERO" e o interessado pede o resto na DM. Dica: fotos bem iluminadas e sem pessoas.',
    count: (n: number) => `${n} de ${KIT_PHOTOS} fotos`,
    create: 'Criar meu kit →', uploading: 'Enviando suas fotos…',
    processing: 'Seus vídeos e seu criativo estão sendo criados. Leva alguns minutos — esta tela atualiza sozinha.',
    progress: (d: number, t: number) => `${d} de ${t} vídeos prontos`,
    ready: 'Seu kit está pronto!', download: 'Baixar', seeOffer: 'Ver o que o plano faz por você →',
    room: (n: number) => `Cômodo ${n}`, creative: 'Criativo de design', creativeWait: 'Seu criativo está ficando pronto…', creativeFail: 'O criativo não ficou bom desta vez — seus vídeos estão aí.',
    cap: 'Os vídeos grátis deste mês acabaram. O seu entra na fila do próximo mês — ou ative o plano e receba agora.',
    failed: 'Não deu certo com essas fotos. Tente de novo, com fotos bem iluminadas e sem texto por cima.',
    errGeneric: 'Não consegui iniciar seu vídeo agora. Tente de novo em alguns minutos.',
    activate: 'Ativar meu plano →',
    mTitle: 'Gostou? Imagine isso todo mês.',
    mSub: 'Com o plano, o Sales Boost cuida do seu marketing — e você só aprova.',
    b1: '🎬 Vídeos curtos dos seus imóveis toda semana, feitos com as suas fotos reais',
    b2: '📈 Planejamento completo para alavancar a empresa: estratégia, calendário, público e metas',
    b3: '🖼️ Posts e criativos na quantidade que a estratégia pedir',
    b4: '💬 Quem comentar QUERO recebe os dados do imóvel na DM na hora — e vira contato seu',
    b5: '✅ Nada vai ao ar sem a sua aprovação',
    priceFrom: 'R$2.449/mês', priceTo: 'R$1.449', priceNote: 'no 1º mês com o seu cupom', valid: 'Cupom válido por 7 dias.',
    later: 'Agora não', close: 'Fechar',
  },
  en: {
    title: '🎁 Your free kit',
    intro: `Choose ${KIT_ROOMS} real photos of the most beautiful rooms (each becomes a video with drone-like camera movement) and 1 highlight photo (becomes a creative with a professional finish, ready to post). Nothing is made up and the AI never writes on the photo.`,
    tips: 'Show only part of the property to spark interest: post it with "Comment QUERO" and interested people ask for the rest in DMs. Tip: well-lit photos with no people.',
    count: (n: number) => `${n} of ${KIT_PHOTOS} photos`,
    create: 'Create my kit →', uploading: 'Uploading your photos…',
    processing: 'Your videos and your creative are being created. It takes a few minutes — this card updates by itself.',
    progress: (d: number, t: number) => `${d} of ${t} videos ready`,
    ready: 'Your kit is ready!', download: 'Download', seeOffer: 'See what the plan does for you →',
    room: (n: number) => `Room ${n}`, creative: 'Design creative', creativeWait: 'Your creative is almost ready…', creativeFail: "The creative didn't turn out well this time — your videos are here.",
    cap: "This month's free videos are gone. Yours goes to next month's queue — or activate the plan and get it now.",
    failed: "Those photos didn't work. Try again with well-lit photos and no text on them.",
    errGeneric: "I couldn't start your video right now. Try again in a few minutes.",
    activate: 'Activate my plan →',
    mTitle: 'Like it? Imagine this every month.',
    mSub: 'With the plan, Sales Boost runs your marketing — you just approve.',
    b1: '🎬 Short videos of your properties every week, made from your real photos',
    b2: '📈 A complete plan to grow your business: strategy, calendar, audience and goals',
    b3: '🖼️ Posts and creatives in the amount the strategy calls for',
    b4: '💬 Whoever comments QUERO gets the property details in DMs right away — and becomes your lead',
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

// onActivate: o que "Ativar meu plano" faz (padrão: tela do plano do trial
// antigo). onState: avisa quem hospeda (ex.: /gratis) em que pé estão os vídeos
// e quando o popup do cupom abriu — pra mostrar a oferta do plano na hora certa.
export default function FreeVideoCard({ companyId, onActivate, onState }: {
  companyId: string; onActivate?: () => void; onState?: (s: { state: State; couponShown: boolean }) => void
}) {
  const tx = TX[useLang().lang]
  const navigate = useNavigate()
  const [state, setState] = useState<State>('loading')
  const [videoUrls, setVideoUrls] = useState<string[]>([])
  const videoUrl = videoUrls[0] ?? null
  const [msg, setMsg] = useState('')
  const [modal, setModal] = useState(false)
  // 2 cômodos + 1 foto de destaque, cada uma no seu lugar.
  const [files, setFiles] = useState<(File | null)[]>(() => Array(KIT_PHOTOS).fill(null))
  const picked = files.filter((f): f is File => !!f)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [creative, setCreative] = useState<{ status: string | null; url: string | null }>({ status: null, url: null })
  const creativePending = creative.status === 'processing' || (creative.status === 'completed' && !creative.url)

  const activate = () => { setModal(false); if (onActivate) onActivate(); else navigate('/dashboard/trial') }
  useEffect(() => { onState?.({ state, couponShown: modal }) }, [state, modal, onState])

  const applyStatus = (d: Record<string, unknown>, openModal: boolean) => {
    if ('creative_status' in d) setCreative({ status: typeof d.creative_status === 'string' ? d.creative_status : null, url: typeof d.creative_url === 'string' ? d.creative_url : null })
    if (d.status === 'completed' && Array.isArray(d.video_urls) && d.video_urls.length) {
      setVideoUrls(d.video_urls.map(String)); setState('completed')
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
  // Vídeos prontos com o criativo ainda finalizando: continua consultando (sem
  // reabrir o popup).
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (state !== 'processing' && !(state === 'completed' && creativePending)) return
    const t = setTimeout(async () => {
      try { applyStatus((await callFn({ action: 'status' })).data, state === 'processing') } catch { /* tenta na próxima */ }
      setTick(n => n + 1)
    }, POLL_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, creativePending, tick])

  // Popup aberto = cupom "visto" (o servidor marca só na 1ª vez).
  useEffect(() => { if (modal) void callFn({ action: 'coupon_seen' }).catch(() => {}) }, [modal])

  const onCreate = async () => {
    if (picked.length !== KIT_PHOTOS) return
    setMsg(''); setState('uploading')
    try {
      const batch = crypto.randomUUID()
      const photo_urls = await Promise.all(picked.map(async (file, i) => {
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
      setProgress({ done: 0, total: typeof data.total === 'number' ? data.total : KIT_ROOMS }); setState('processing')
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
          <KitPhotoPicker files={files} onChange={f => { setMsg(''); setFiles(f) }} disabled={state === 'uploading'} />
          <div style={{ fontSize: '12px', color: MUTED, margin: '10px 0 12px' }}>{tx.count(picked.length)}</div>
          <button style={{ ...btn, opacity: picked.length === KIT_PHOTOS && state !== 'uploading' ? 1 : 0.5, cursor: state === 'uploading' ? 'wait' : picked.length === KIT_PHOTOS ? 'pointer' : 'not-allowed' }}
            disabled={picked.length !== KIT_PHOTOS || state === 'uploading'} onClick={() => void onCreate()}>
            {state === 'uploading' ? tx.uploading : tx.create}
          </button>
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
          <button style={btn} onClick={activate}>{tx.activate}</button>
        </>
      )}

      {state === 'completed' && videoUrl && (
        <>
          <div style={{ fontSize: '13px', color: '#4ade80', fontWeight: 700, marginBottom: '10px' }}>{tx.ready}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', maxWidth: '560px' }}>
            {videoUrls.map((u, i) => (
              <div key={u}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: '5px' }}>{tx.room(i + 1)}</div>
                <video src={`${u}#t=0.1`} controls playsInline preload="metadata" style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', borderRadius: '12px', background: '#000', display: 'block' }} />
                <a href={u} download style={{ fontSize: '12px', color: ORANGE }}>{tx.download}</a>
              </div>
            ))}
            {creative.status && creative.status !== 'failed' && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: '5px' }}>{tx.creative}</div>
                {creative.url ? (
                  <>
                    <img src={creative.url} alt={tx.creative} style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', borderRadius: '12px', background: '#000', display: 'block' }} />
                    <a href={creative.url} download target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: ORANGE }}>{tx.download}</a>
                  </>
                ) : (
                  <div role="status" style={{ aspectRatio: '4 / 5', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ width: 24, height: 24, border: '3px solid rgba(255,109,41,0.15)', borderTopColor: ORANGE, borderRadius: '50%', animation: 'fvspin 1s linear infinite' }} />
                    <style>{'@keyframes fvspin{to{transform:rotate(360deg)}}'}</style>
                    <span style={{ fontSize: '12px', color: MUTED, lineHeight: 1.4 }}>{tx.creativeWait}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          {creative.status === 'failed' && <p style={{ fontSize: '12px', color: MUTED, margin: '8px 0 0' }}>{tx.creativeFail}</p>}
          <button style={{ ...btn, marginTop: '12px' }} onClick={() => setModal(true)}>{tx.seeOffer}</button>
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
            <button style={{ ...btn, width: '100%', padding: '14px' }} onClick={activate}>{tx.activate}</button>
            <button onClick={() => setModal(false)} style={{ display: 'block', width: '100%', marginTop: '8px', padding: '10px', background: 'transparent', border: 'none', color: MUTED, fontSize: '12.5px', cursor: 'pointer', fontFamily: D }}>{tx.later}</button>
          </div>
        </div>
      )}
    </div>
  )
}
