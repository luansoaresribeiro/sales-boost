// Tour completo de 1 imóvel (menu Tour virtual, 2026-11-10). O servidor sugere a ordem (item-videos plan_tour: cômodo
// de cada foto pela IA de visão + ordem da ficha); o dono confere, sobe/desce/tira/inclui e manda gerar
// (creative-generate tour_piece → legenda com as travas + item-videos, que confere o teto e paga). Imóvel inteiro num
// vídeo só, SEM cortes (dono, 2026-11-11): passagem que precisa de conferência fica em amarelo. O servidor recalcula tudo.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../contexts/LanguageContext'
import { tourSegments, tourSeconds, withOutsideFirst, type SegKind } from '../../lib/tourOrder'
import { CARD, MUTED, BORDER, ORANGE, SUPABASE_URL } from './marketingAi/shared'

const GREEN = '#4ade80'
const RED = '#f87171'
interface Plan {
  photos: string[]; all: { url: string; room: string | null; quality: number | null }[]
  room_labels: Record<string, string>; adjacent_rooms: [string, string][]; opening_rooms: string[]; opening_candidates?: string[]; max_photos: number
  seconds: Record<SegKind, number>; cost_per_second_usd: number; month_spent_usd: number; month_cap_usd: number
  studio_ready: boolean; blocked: string | null
}
interface Video { id: string; status: string; kind: string; created_at: string; video_url: string | null }

const TX = {
  pt: {
    build: 'Montar a ordem do tour', building: 'Analisando as fotos (cômodo e qualidade)…',
    order: 'Ordem do tour', help: 'Um vídeo só, sem cortes: a câmera passa por todos os cômodos, de uma foto até a seguinte, como um drone dentro da casa. Use ↑ ↓ para mudar a ordem e ✕ para tirar. Com foto de fora, a câmera começa lá e entra no imóvel. Em amarelo: passagem que precisa da sua conferência no vídeo antes de aprovar (a IA não pode inventar parede, porta ou cômodo).',
    start: 'começo', walk: '🚶 caminha até aqui', unconfirmed: '🚶 caminha até aqui · passagem não confirmada', walkIn: '🚁 a câmera entra no imóvel · confira no vídeo', opening: '🏙️ começa de fora',
    linkYes: '✅ ligação visível nas fotos', linkUnsure: '· ligação não confirmada — confira no vídeo', linkChecking: 'conferindo a ligação…',
    missStairs: 'falta foto da escada', missDoor: 'falta foto da porta de entrada', missOpening: 'falta foto da passagem entre os dois ambientes',
    unlinked: (n: number) => `${n} passagem(ns) sem foto de ligação: a IA teria que inventar o caminho (parede, porta ou escada). Inclua a foto que falta (+ incluir, abaixo) e coloque entre as duas.`,
    confirmUnlinked: 'Gerar mesmo assim (a IA pode inventar o caminho)',
    missing: (rooms: string) => `Cômodos fora do tour: ${rooms}. Inclua uma foto de cada para o tour mostrar o imóvel inteiro.`,
    hintOutside: 'Para começar de fora, suba (↑) para 1º lugar uma foto real da área externa ou da vista (ex.: varanda) e marque "Abrir de fora". A IA nunca cria o prédio nem a vista.',
    outsideFirst: '🏙️ Abrir de fora com a 1ª foto (movimento de drone, só o que a foto mostra) — use se ela mostrar a área externa ou a vista.',
    noOpening: 'Para começar de fora, o imóvel precisa de uma foto real da fachada ou da vista. Sem ela, o tour começa dentro — a IA nunca cria o prédio nem a vista.',
    unknown: 'cômodo não identificado',
    left: 'Fotos fora do tour', add: '+ incluir', full: (n: number) => `Máximo de ${n} fotos por tour.`,
    cost: (usd: number, s: number) => `Custo estimado: ≈ US$ ${usd.toFixed(2)} (${s} s de vídeo)`,
    month: (a: number, b: number) => `Gasto do mês (vídeos, fotos e imagens): US$ ${a.toFixed(2)} de US$ ${b.toFixed(0)}`,
    gen: 'Gerar tour completo →', genning: 'Preparando o tour…', min: 'Escolha pelo menos 2 fotos.',
    studioOff: 'O servidor de vídeo está fora do ar agora. Tente de novo em alguns minutos — nada é cobrado.',
    started: '✓ Tour pedido! Leva alguns minutos. Quando ficar pronto, aparece em Aprovações.',
    tours: 'Tours deste imóvel', making: 'Gerando…', failed: 'Não deu certo', ready: 'Pronto', goApprove: 'Ver em Aprovações →',
    err: 'Algo deu errado. Tente de novo em alguns minutos.',
  },
  en: {
    build: 'Build the tour order', building: 'Analyzing the photos (room and quality)…',
    order: 'Tour order', help: 'One video, no cuts: the camera moves through every room, from one photo to the next, like a drone inside the home. Use ↑ ↓ to reorder and ✕ to remove. With an outside photo, the camera starts there and flies in. In yellow: a passage to check in the video before approving (the AI may not invent walls, doors or rooms).',
    start: 'start', walk: '🚶 walks here', unconfirmed: '🚶 walks here · passage not confirmed', walkIn: '🚁 the camera flies into the home · check it in the video', opening: '🏙️ starts outside',
    linkYes: '✅ connection visible in the photos', linkUnsure: '· connection not confirmed — check it in the video', linkChecking: 'checking the connection…',
    missStairs: 'missing a photo of the stairs', missDoor: 'missing a photo of the entrance door', missOpening: 'missing a photo of the passage between the two spaces',
    unlinked: (n: number) => `${n} passage(s) without a connecting photo: the AI would have to invent the way (wall, door or stairs). Add the missing photo (+ add, below) and place it between the two.`,
    confirmUnlinked: 'Generate anyway (the AI may invent the way)',
    missing: (rooms: string) => `Rooms left out of the tour: ${rooms}. Add one photo of each so the tour shows the whole property.`,
    hintOutside: 'To start outside, move (↑) a real photo of the outdoor area or the view (e.g. balcony) to 1st place and tick "Open from outside". The AI never creates the building or the view.',
    outsideFirst: '🏙️ Open from outside with the 1st photo (drone-style move, only what the photo shows) — use it if it shows the outdoor area or the view.',
    noOpening: 'To start outside, the property needs a real photo of the facade or the view. Without it, the tour starts inside — the AI never creates the building or the view.',
    unknown: 'room not identified',
    left: 'Photos left out', add: '+ add', full: (n: number) => `At most ${n} photos per tour.`,
    cost: (usd: number, s: number) => `Estimated cost: ≈ US$ ${usd.toFixed(2)} (${s} s of video)`,
    month: (a: number, b: number) => `Spent this month (videos, photos and images): US$ ${a.toFixed(2)} of US$ ${b.toFixed(0)}`,
    gen: 'Generate full tour →', genning: 'Preparing the tour…', min: 'Pick at least 2 photos.',
    studioOff: 'The video server is down right now. Try again in a few minutes — nothing is charged.',
    started: '✓ Tour requested! It takes a few minutes. When ready, it shows up in Approvals.',
    tours: 'Tours of this property', making: 'Generating…', failed: "Didn't work", ready: 'Ready', goApprove: 'See in Approvals →',
    err: 'Something went wrong. Try again in a few minutes.',
  },
} as const

async function call(fn: string, body: Record<string, unknown>): Promise<{ status: number; data: Record<string, unknown> }> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST', headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

const btn = (bg: string, color: string, border?: string) => ({
  minHeight: 36, padding: '8px 14px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
  background: bg, color, border: border ? `1px solid ${border}` : 'none',
})
const mini = { ...btn('transparent', 'white', 'rgba(255,255,255,0.14)'), minHeight: 32, minWidth: 32, padding: '4px 8px' }

export default function TourBuilder({ itemId }: { itemId: string }) {
  const { lang } = useLang()
  const tx = TX[lang]
  const [plan, setPlan] = useState<Plan | null>(null)
  const [order, setOrder] = useState<string[]>([])
  // Corte pedido pelo dono, guardado pela foto que vem DEPOIS do corte (sobrevive a ↑ ↓).
  const [outsideFirst, setOutsideFirst] = useState(false)
  // Fotos de ligação (dono, 2026-11-11): o servidor diz, par a par, se a ligação entre as fotos aparece.
  const [links, setLinks] = useState<Record<string, { linked: 'yes' | 'no' | 'unsure'; missing: string | null }>>({})
  const [checking, setChecking] = useState(false)
  const [confirmUnlinked, setConfirmUnlinked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [videos, setVideos] = useState<Video[]>([])

  const loadVideos = useCallback(async () => {
    const r = await call('item-videos', { action: 'list', item_id: itemId })
    const list = ((r.data.videos ?? []) as Video[]).filter(v => v.kind === 'tour')
    setVideos(list)
    return list
  }, [itemId])
  useEffect(() => { void loadVideos() }, [loadVideos])
  // Andamento: enquanto houver tour sendo feito, consulta a cada 15 s (o status avança a geração).
  useEffect(() => {
    if (!videos.some(v => v.status === 'generating' || v.status === 'assembling')) return
    const t = setTimeout(async () => {
      for (const v of videos.filter(x => x.status === 'generating' || x.status === 'assembling')) await call('item-videos', { action: 'status', video_id: v.id })
      await loadVideos()
    }, 15_000)
    return () => clearTimeout(t)
  }, [videos, loadVideos])

  const build = async () => {
    setBusy(true); setMsg(null)
    const r = await call('item-videos', { action: 'plan_tour', item_id: itemId })
    setBusy(false)
    if (r.status !== 200) { setMsg({ ok: false, text: String(r.data.error ?? tx.err) }); return }
    const p = r.data as unknown as Plan
    setPlan(p); setOrder(p.photos)
  }

  const roomOf = useMemo(() => new Map((plan?.all ?? []).map(p => [p.url, p.room])), [plan])
  const baseRooms = useMemo(() => order.map(u => roomOf.get(u) ?? null), [order, roomOf])
  const candidates = useMemo(() => plan?.opening_candidates ?? [], [plan])
  // O dono pode abrir de fora com a 1ª foto se ela for de um ambiente que a ficha permite (ex.: varanda com vista).
  const canOutside = !!baseRooms[0] && candidates.includes(baseRooms[0]) && !(plan?.opening_rooms ?? []).includes(baseRooms[0])
  const rooms = useMemo(() => withOutsideFirst(baseRooms, plan?.opening_rooms ?? [], candidates, outsideFirst), [baseRooms, plan, candidates, outsideFirst])
  // Zero cortes (dono, 2026-11-11): a mesma regra do servidor, recalculada quando o dono muda a ordem.
  const { segments, passages } = useMemo(() => tourSegments(rooms, plan?.adjacent_rooms ?? [], plan?.opening_rooms ?? []), [rooms, plan])
  // Imóvel inteiro: cômodos que têm foto mas não estão na ordem atual.
  const missingRooms = useMemo(() => {
    const inOrder = new Set(baseRooms.filter(Boolean))
    const opening = plan?.opening_rooms ?? []
    return [...new Set((plan?.all ?? []).map(p => p.room).filter((r): r is string => !!r && !opening.includes(r)))].filter(r => !inOrder.has(r))
  }, [baseRooms, plan])
  const secs = plan ? tourSeconds(segments, plan.seconds) : 0
  const usd = plan ? secs * plan.cost_per_second_usd : 0
  const hasOpeningPhoto = !!plan?.all.some(p => p.room && plan.opening_rooms.includes(p.room))
  const hasCandidate = !!plan?.all.some(p => p.room && candidates.includes(p.room))
  const left = (plan?.all ?? []).filter(p => !order.includes(p.url))
  // Nome curto do cômodo (a ficha traz "quarto / suíte", "vista (janela, …)"): só a 1ª parte cabe no celular.
  const label = (room: string | null) => (room ? (plan?.room_labels[room] ?? room).split(/ \/ | \(/)[0] : tx.unknown)

  const move = (i: number, d: number) => setOrder(o => { const n = [...o]; const j = i + d; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n })
  const remove = (u: string) => setOrder(o => o.filter(x => x !== u))
  const add = (u: string) => setOrder(o => (plan && o.length < plan.max_photos ? [...o, u] : o))

  // Confere as ligações da ordem atual (só os pares que mudaram vão à IA; o servidor guarda o resto).
  const linkKey = (a: string, b: string) => `${a}>${b}`
  useEffect(() => {
    if (!plan || order.length < 2) return
    if (order.slice(0, -1).every((u, i) => links[linkKey(u, order[i + 1])])) return
    const t = setTimeout(async () => {
      setChecking(true)
      const r = await call('item-videos', { action: 'check_passages', item_id: itemId, photos: order })
      setChecking(false)
      const list = (r.data.passages ?? []) as { from: number; to: number; linked: 'yes' | 'no' | 'unsure'; missing: string | null }[]
      if (r.status === 200) setLinks(prev => ({ ...prev, ...Object.fromEntries(list.map(p => [linkKey(order[p.from], order[p.to]), { linked: p.linked, missing: p.missing }])) }))
    }, 700)
    return () => clearTimeout(t)
  }, [plan, order, links, itemId])
  const linkOf = (i: number) => (i > 0 ? links[linkKey(order[i - 1], order[i])] : undefined)
  const unlinkedCount = order.slice(1).filter((_, k) => linkOf(k + 1)?.linked === 'no').length
  const missingLabel = (m: string | null) => (m === 'escada' ? tx.missStairs : m === 'porta' ? tx.missDoor : tx.missOpening)

  const generate = async () => {
    if (order.length < 2) { setMsg({ ok: false, text: tx.min }); return }
    setBusy(true); setMsg({ ok: true, text: tx.genning })
    const r = await call('creative-generate', { action: 'tour_piece', item_id: itemId, photos: order, outside_first: canOutside && outsideFirst, confirm_unlinked: confirmUnlinked })
    setBusy(false)
    if (r.status === 200) { setMsg({ ok: true, text: tx.started }); void loadVideos() }
    else setMsg({ ok: false, text: String(r.data.error ?? tx.err) })
  }

  return (
    <div>
      {!plan && <button disabled={busy} onClick={() => void build()} style={btn(ORANGE, '#000')}>{busy ? tx.building : tx.build}</button>}

      {plan && (
        <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>{tx.order}</div>
          <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.55, marginBottom: '12px' }}>{tx.help}</div>
          {plan.blocked && <div style={{ fontSize: '12.5px', color: RED, marginBottom: '10px' }}>{plan.blocked}</div>}
          {canOutside && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'white', marginBottom: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={outsideFirst} onChange={e => setOutsideFirst(e.target.checked)} />
              {tx.outsideFirst}
            </label>
          )}
          {!hasOpeningPhoto && !canOutside && <div style={{ fontSize: '12px', color: ORANGE, lineHeight: 1.55, marginBottom: '10px' }}>{hasCandidate ? tx.hintOutside : tx.noOpening}</div>}
          {missingRooms.length > 0 && <div style={{ fontSize: '12px', color: '#FBBF24', lineHeight: 1.55, marginBottom: '10px' }}>{tx.missing(missingRooms.map(label).join(', '))}</div>}
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {order.map((u, i) => {
              const isOpening = segments.some(s => s.from === i && (s.kind === 'opening' || s.entry))
              const pass = isOpening ? tx.opening : passages[i] === 'walk' ? tx.walk : passages[i] === 'walk_unconfirmed' ? tx.unconfirmed : passages[i] === 'walk_in' ? tx.walkIn : tx.start
              return (
                <li key={u} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px', borderRadius: '10px', border: `1px solid ${BORDER}` }}>
                  <span style={{ width: 22, textAlign: 'center', fontSize: '12px', fontWeight: 800, color: ORANGE }}>{i + 1}</span>
                  <img src={u} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label(rooms[i])}</div>
                    <div style={{ fontSize: '11px', color: passages[i] === 'walk_unconfirmed' || passages[i] === 'walk_in' ? '#FBBF24' : MUTED }}>{pass}</div>
                    {i > 0 && (() => { const l = linkOf(i); return (
                      <div style={{ fontSize: '11px', fontWeight: 700, color: !l ? MUTED : l.linked === 'yes' ? '#4ade80' : l.linked === 'no' ? RED : '#FBBF24' }}>
                        {!l ? (checking ? tx.linkChecking : '') : l.linked === 'yes' ? tx.linkYes : l.linked === 'no' ? `⚠️ ${missingLabel(l.missing)}` : tx.linkUnsure}
                      </div>
                    ) })()}
                  </div>
                  <button aria-label="↑" disabled={i === 0} onClick={() => move(i, -1)} style={mini}>↑</button>
                  <button aria-label="↓" disabled={i === order.length - 1} onClick={() => move(i, 1)} style={mini}>↓</button>
                  <button aria-label="✕" onClick={() => remove(u)} style={{ ...mini, color: MUTED }}>✕</button>
                </li>
              )
            })}
          </ol>
          {left.length > 0 && (
            <div style={{ marginTop: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: MUTED, marginBottom: '6px' }}>{tx.left}{order.length >= plan.max_photos ? ` · ${tx.full(plan.max_photos)}` : ''}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {left.map(p => (
                  <div key={p.url} style={{ width: 92, fontSize: '10.5px', color: MUTED }}>
                    <img src={p.url} alt="" style={{ width: 92, height: 69, borderRadius: 8, objectFit: 'cover', display: 'block', opacity: 0.8 }} />
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '3px 0' }}>{label(p.room)}</div>
                    <button disabled={order.length >= plan.max_photos} onClick={() => add(p.url)} style={{ ...mini, width: '100%' }}>{tx.add}</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginTop: '14px', fontSize: '12px', color: 'white' }}>{tx.cost(usd, secs)}</div>
          <div style={{ fontSize: '11.5px', color: MUTED, marginBottom: '12px' }}>{tx.month(plan.month_spent_usd, plan.month_cap_usd)}</div>
          {!plan.studio_ready && <div style={{ fontSize: '12px', color: ORANGE, marginBottom: '10px' }}>{tx.studioOff}</div>}
          {unlinkedCount > 0 && (
            <div style={{ fontSize: '12px', color: RED, lineHeight: 1.55, marginBottom: '10px' }}>
              {tx.unlinked(unlinkedCount)}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', marginTop: '6px', cursor: 'pointer' }}>
                <input type="checkbox" checked={confirmUnlinked} onChange={e => setConfirmUnlinked(e.target.checked)} />{tx.confirmUnlinked}
              </label>
            </div>
          )}
          <button disabled={busy || order.length < 2 || !!plan.blocked || (unlinkedCount > 0 && !confirmUnlinked)} onClick={() => void generate()} style={{ ...btn(ORANGE, '#000'), width: '100%', opacity: busy || order.length < 2 || plan.blocked || (unlinkedCount > 0 && !confirmUnlinked) ? 0.6 : 1 }}>{tx.gen}</button>
        </section>
      )}

      {msg && <div role="status" style={{ marginTop: '10px', fontSize: '12.5px', color: msg.ok ? GREEN : RED, lineHeight: 1.55 }}>{msg.text}</div>}

      {videos.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>{tx.tours}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {videos.map(v => (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', border: `1px solid ${BORDER}`, background: CARD, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: MUTED }}>{new Date(v.created_at).toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: v.status === 'completed' ? GREEN : v.status === 'failed' ? RED : ORANGE }}>
                  {v.status === 'completed' ? tx.ready : v.status === 'failed' ? tx.failed : tx.making}
                </span>
                {v.video_url && <a href={v.video_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: ORANGE, fontWeight: 700 }}>▶</a>}
                {v.status === 'completed' && <Link to="/dashboard/aprovacoes" style={{ marginLeft: 'auto', fontSize: '12px', color: ORANGE, fontWeight: 700 }}>{tx.goApprove}</Link>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
