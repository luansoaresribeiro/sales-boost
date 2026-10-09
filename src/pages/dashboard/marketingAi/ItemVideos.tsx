// Vídeos curtos de um imóvel + resposta do "Comente QUERO" (plano pago —
// decisões do dono 2026-10-09, docs/DECISIONS.md). O vídeo é ISCA: 1 cômodo,
// 2 cômodos vizinhos (caminhada) ou a abertura de fora mostrando a vista —
// nunca o imóvel inteiro. O corretor escolhe as fotos. A mensagem do QUERO vem
// pronta com os dados cadastrados; ele revisa e aprova UMA VEZ (opção B) e a
// partir daí quem comentar QUERO num post deste imóvel recebe na DM na hora.
// Backend: supabase/functions/item-videos.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, ORANGE, D, SUPABASE_URL } from './shared'

type Kind = 'room' | 'pair' | 'opening'
interface Video { id: string; status: string; kind: Kind; label: string; created_at: string; video_url: string | null }
interface Reply { keyword: string; message: string; active: boolean; saved: boolean }
interface ListResp { videos: Video[]; reply: Reply; month_spent_usd: number; month_cap_usd: number; cost_usd: Record<Kind, number> }

const POLL_MS = 10_000

const TX = {
  pt: {
    open: '🎬 Vídeos e resposta do QUERO', title: 'Vídeos curtos do imóvel', close: 'Fechar',
    intro: 'Mostre uma parte do imóvel pra gerar vontade — o resto a pessoa pede na DM. Cada vídeo vai pro Instagram com "Comente QUERO".',
    kinds: { room: '1 cômodo', pair: '2 cômodos vizinhos', opening: 'Abertura de fora (vista)' } as Record<Kind, string>,
    hints: {
      room: 'Escolha 1 foto. A câmera se move dentro do cômodo.',
      pair: 'Escolha 2 fotos de cômodos que ficam lado a lado, na ordem: de onde sai → aonde chega. Se não forem vizinhos, a IA inventa o caminho.',
      opening: 'Escolha 1 foto de fora — fachada, varanda ou a vista. A IA nunca cria o prédio nem a vista: sem foto real de fora, suba uma em "+ fotos".',
    } as Record<Kind, string>,
    label: 'Nome do vídeo (opcional, ex.: Suíte com closet)', create: (usd: number) => `Gerar vídeo (≈ US$ ${usd.toFixed(2)}) →`,
    month: (spent: number, cap: number) => `Usado no mês: US$ ${spent.toFixed(2)} de US$ ${cap.toFixed(0)}`,
    videos: 'Vídeos deste imóvel', none: 'Nenhum vídeo ainda.', making: 'Gerando… leva uns 3 minutos.', failed: 'Não deu certo — tente outra foto.', download: 'Baixar',
    replyTitle: (k: string) => `Resposta automática do "Comente ${k}"`,
    replyHelp: (k: string) => `Quem comentar ${k} em qualquer post deste imóvel recebe esta mensagem na DM, na hora. Ela vem pronta com os dados que você cadastrou — revise, edite se quiser e aprove.`,
    approve: 'Aprovar e ligar resposta automática', turnOff: 'Desligar', save: 'Salvar mudança',
    on: '✅ Ligada — enviando automaticamente', off: 'Desligada — ninguém recebe nada até você aprovar',
    needIg: 'Só funciona com o Instagram conectado e o app aprovado pela Meta pra mensagens.',
    errGeneric: 'Algo deu errado. Tente de novo em alguns minutos.',
  },
  en: {
    open: '🎬 Videos & QUERO reply', title: 'Short property videos', close: 'Close',
    intro: 'Show part of the property to spark interest — people ask for the rest in DMs. Each video goes to Instagram with "Comment QUERO".',
    kinds: { room: '1 room', pair: '2 neighboring rooms', opening: 'Opening from outside (view)' } as Record<Kind, string>,
    hints: {
      room: 'Pick 1 photo. The camera moves inside the room.',
      pair: "Pick 2 photos of rooms next to each other, in order: from → to. If they aren't neighbors, the AI invents the path.",
      opening: 'Pick 1 outside photo — facade, balcony or the view. The AI never creates the building or the view: without a real outside photo, upload one in "+ photos".',
    } as Record<Kind, string>,
    label: 'Video name (optional, e.g. Suite with closet)', create: (usd: number) => `Generate video (≈ US$ ${usd.toFixed(2)}) →`,
    month: (spent: number, cap: number) => `Used this month: US$ ${spent.toFixed(2)} of US$ ${cap.toFixed(0)}`,
    videos: 'Videos of this property', none: 'No videos yet.', making: 'Generating… takes about 3 minutes.', failed: "It didn't work — try another photo.", download: 'Download',
    replyTitle: (k: string) => `Automatic reply to "Comment ${k}"`,
    replyHelp: (k: string) => `Anyone who comments ${k} on any post of this property gets this message in DMs, right away. It comes ready with the data you registered — review, edit if you want and approve.`,
    approve: 'Approve and turn on automatic reply', turnOff: 'Turn off', save: 'Save change',
    on: '✅ On — sending automatically', off: "Off — nobody gets anything until you approve",
    needIg: 'Only works with Instagram connected and the app approved by Meta for messaging.',
    errGeneric: 'Something went wrong. Try again in a few minutes.',
  },
}

async function call(body: Record<string, unknown>): Promise<{ status: number; data: Record<string, unknown> }> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/item-videos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

function Panel({ itemId, photos, onClose }: { itemId: string; photos: string[]; onClose: () => void }) {
  const tx = TX[useLang().lang]
  const [resp, setResp] = useState<ListResp | null>(null)
  const [kind, setKind] = useState<Kind>('room')
  const [picked, setPicked] = useState<string[]>([])
  const [label, setLabel] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const { data } = await call({ action: 'list', item_id: itemId })
    const r = data as unknown as ListResp
    setResp(r)
    setMessage(m => m || r.reply?.message || '')
  }, [itemId])
  useEffect(() => { void load() }, [load])

  // Enquanto algum vídeo gera, avança cada um (o status também grava o vídeo pronto).
  const generatingIds = (resp?.videos ?? []).filter(v => v.status === 'generating' || v.status === 'assembling').map(v => v.id).join(',')
  useEffect(() => {
    if (!generatingIds) return
    const t = setTimeout(async () => {
      await Promise.all(generatingIds.split(',').map(id => call({ action: 'status', video_id: id })))
      void load()
    }, POLL_MS)
    return () => clearTimeout(t)
  }, [generatingIds, resp, load])

  const need = kind === 'pair' ? 2 : 1
  const toggle = (url: string) => setPicked(p => p.includes(url) ? p.filter(x => x !== url) : [...p, url].slice(-need))
  const pickKind = (k: Kind) => { setKind(k); setPicked([]) }

  const create = async () => {
    setBusy(true); setMsg('')
    const { status, data } = await call({ action: 'create', item_id: itemId, kind, photos: picked, label })
    setBusy(false)
    if (status >= 400) { setMsg(String(data.error ?? tx.errGeneric)); return }
    setPicked([]); setLabel(''); await load()
  }

  const saveReply = async (active: boolean) => {
    setBusy(true); setMsg('')
    const { status, data } = await call({ action: 'save_reply', item_id: itemId, message, active })
    setBusy(false)
    if (status >= 400) { setMsg(String(data.error ?? tx.errGeneric)); return }
    await load()
  }

  const btn = { padding: '11px 16px', background: ORANGE, color: '#000', fontWeight: 800, fontSize: '13px', border: 'none', borderRadius: '10px', cursor: busy ? 'wait' : 'pointer', fontFamily: D } as const
  const small = { padding: '6px 10px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '12px', cursor: 'pointer', fontFamily: D } as const
  const head = { fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '18px 0 8px' } as const
  const reply = resp?.reply
  const dirty = !!reply && message !== reply.message

  return (
    <div role="dialog" aria-modal="true" onClick={e => { e.stopPropagation(); onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: '600px', background: CARD, border: '1px solid rgba(255,109,41,0.35)', borderRadius: '16px', padding: '20px', fontFamily: D, margin: '24px 0' }}>
        <button onClick={onClose} aria-label={tx.close} style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.06)', color: MUTED, cursor: 'pointer' }}>✕</button>
        <div style={{ fontSize: '17px', fontWeight: 800, color: 'white', marginBottom: '6px', paddingRight: '36px' }}>{tx.title}</div>
        <p style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.55, margin: '0 0 12px' }}>{tx.intro}</p>
        {msg && <p style={{ fontSize: '12.5px', color: '#f87171', margin: '0 0 10px' }}>{msg}</p>}

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {(['room', 'pair', 'opening'] as Kind[]).map(k => (
            <button key={k} onClick={() => pickKind(k)} style={{ ...small, ...(kind === k ? { borderColor: ORANGE, color: ORANGE, fontWeight: 700 } : {}) }}>{tx.kinds[k]}</button>
          ))}
        </div>
        <p style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.5, margin: '0 0 10px' }}>{tx.hints[kind]}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: '6px', maxHeight: '220px', overflowY: 'auto', marginBottom: '10px' }}>
          {photos.map(url => {
            const n = picked.indexOf(url)
            return (
              <button key={url} onClick={() => toggle(url)} style={{ position: 'relative', padding: 0, border: `2px solid ${n >= 0 ? ORANGE : 'transparent'}`, borderRadius: '8px', overflow: 'hidden', aspectRatio: '4 / 5', cursor: 'pointer', background: '#000' }}>
                <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {n >= 0 && <span style={{ position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: 9, background: ORANGE, color: '#000', fontSize: '11px', fontWeight: 800, lineHeight: '18px' }}>{n + 1}</span>}
              </button>
            )
          })}
        </div>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder={tx.label} maxLength={80}
          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '12.5px', marginBottom: '10px', fontFamily: D }} />
        <button style={{ ...btn, width: '100%', opacity: busy || picked.length !== need ? 0.5 : 1 }} disabled={busy || picked.length !== need} onClick={() => void create()}>
          {tx.create(resp?.cost_usd?.[kind] ?? 0.54)}
        </button>
        {resp && <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '6px' }}>{tx.month(resp.month_spent_usd, resp.month_cap_usd)}</div>}

        <div style={head}>{tx.videos}</div>
        {!resp?.videos.length ? <div style={{ fontSize: '12px', color: MUTED }}>{tx.none}</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
            {resp.videos.map(v => (
              <div key={v.id}>
                {v.video_url
                  ? <video src={v.video_url} controls playsInline preload="metadata" style={{ width: '100%', borderRadius: '8px', background: '#000', display: 'block' }} />
                  : <div style={{ aspectRatio: '4 / 5', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', fontSize: '11px', color: v.status === 'failed' ? '#f87171' : MUTED, textAlign: 'center' }}>{v.status === 'failed' ? tx.failed : tx.making}</div>}
                <div style={{ fontSize: '11px', color: 'white', marginTop: '4px' }}>{v.label || tx.kinds[v.kind]}</div>
                {v.video_url && <a href={v.video_url} download style={{ fontSize: '11px', color: ORANGE }}>{tx.download}</a>}
              </div>
            ))}
          </div>
        )}

        {reply && (
          <>
            <div style={head}>{tx.replyTitle(reply.keyword)}</div>
            <p style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.5, margin: '0 0 8px' }}>{tx.replyHelp(reply.keyword)}</p>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={9} maxLength={1000}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '12.5px', lineHeight: 1.5, fontFamily: D, resize: 'vertical' }} />
            <div style={{ fontSize: '11.5px', margin: '6px 0 10px', color: reply.active ? '#86efac' : MUTED }}>{reply.active ? tx.on : tx.off}</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {!reply.active && <button style={btn} disabled={busy || !message.trim()} onClick={() => void saveReply(true)}>{tx.approve}</button>}
              {reply.active && dirty && <button style={btn} disabled={busy || !message.trim()} onClick={() => void saveReply(true)}>{tx.save}</button>}
              {reply.active && <button style={small} disabled={busy} onClick={() => void saveReply(false)}>{tx.turnOff}</button>}
            </div>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '8px 0 0' }}>{tx.needIg}</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function ItemVideos({ itemId, photos }: { itemId: string; photos: string[] }) {
  const tx = TX[useLang().lang]
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ width: '100%', padding: '7px 10px', marginTop: '6px', background: 'transparent', border: '1px solid rgba(255,109,41,0.4)', borderRadius: '7px', color: ORANGE, fontWeight: 700, fontSize: '11px', cursor: 'pointer', fontFamily: D }}>
        {tx.open}
      </button>
      {open && <Panel itemId={itemId} photos={photos} onClose={() => setOpen(false)} />}
    </>
  )
}
