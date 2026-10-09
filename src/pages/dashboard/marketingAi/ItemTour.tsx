// Tour completo em caminhada de um imóvel (plano pago — decisões do dono
// 2026-10-09, docs/DECISIONS.md). A IA analisa as fotos e propõe a ordem; o
// corretor vê cada passagem marcada como "confirmada" (a foto mostra a ligação)
// ou "não confirmada" (a IA vai imaginar o caminho), troca a ordem, tira ou
// devolve ambientes e só então gera. Backend: supabase/functions/tour-plan.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, ORANGE, D, SUPABASE_URL } from './shared'

interface Step { ambiente_id: string; nome: string; zona: string; photo: string }
interface Link { from: string; to: string; confirmado: boolean; evidencia: string }
interface Plan { steps: Step[]; links: Link[]; excluidos: { photo: string; motivo: string }[]; observacoes: string }
interface Tour { id: string; status: string; plan: Plan | null; error: string | null }
type Graph = Record<string, { ve: string[]; evidencia: string }>
interface GetResp { tour: Tour | null; available: Step[]; graph: Graph; month_spent_usd: number; month_cap_usd: number; cost_per_step_usd: number }

const POLL_MS = 8_000

const TX = {
  pt: {
    open: '🎬 Tour em vídeo', title: 'Tour em vídeo (caminhada)', close: 'Fechar',
    intro: 'A IA olha todas as fotos, junta as repetidas, escolhe a melhor de cada ambiente e monta a ordem da caminhada. Você confere e aprova antes de gerar.',
    analyze: 'Montar a ordem do tour →', analyzing: 'Analisando as fotos… leva 1 a 2 minutos. Pode fechar e voltar depois.',
    order: 'Ordem da caminhada', ok: (ev: string) => `✅ Ligação confirmada${ev ? ` — ${ev}` : ''}`,
    notOk: '⚠️ Não confirmado: nenhuma foto mostra a passagem entre esses dois ambientes. A IA vai imaginar o caminho (porta, corredor). Se não forem vizinhos, mude a ordem ou tire um deles.',
    up: 'Subir', down: 'Descer', remove: 'Tirar', addBack: 'Ambientes fora do tour (toque pra pôr no fim):',
    excluded: (n: number) => `${n} foto(s) não entraram (pessoa, foto escura ou só detalhe).`,
    cost: (steps: number, usd: number) => `${steps} ambientes · ${Math.max(0, steps - 1)} passagens de 6 s · cerca de US$ ${usd.toFixed(2)}`,
    month: (spent: number, cap: number) => `Usado no mês: US$ ${spent.toFixed(2)} de US$ ${cap.toFixed(0)}`,
    generate: 'Aprovar e gerar o tour →', saving: 'Salvando…',
    generating: (d: number, t: number) => `Gerando o tour… ${d} de ${t} passagens prontas. Leva alguns minutos — pode fechar e voltar.`,
    assembling: 'Juntando as passagens no vídeo final…',
    done: 'Tour pronto!', cuts: 'Recortes prontos pra Reels e Stories', download: 'Baixar',
    failed: 'Não deu certo desta vez.', retry: 'Tentar de novo', redo: 'Montar de novo (nova análise)',
    errGeneric: 'Algo deu errado. Tente de novo em alguns minutos.',
  },
  en: {
    open: '🎬 Video tour', title: 'Video tour (walkthrough)', close: 'Close',
    intro: 'The AI looks at every photo, groups repeated ones, picks the best of each room and builds the walking order. You review and approve before it generates.',
    analyze: 'Build the tour order →', analyzing: 'Analyzing the photos… takes 1 to 2 minutes. You can close and come back.',
    order: 'Walking order', ok: (ev: string) => `✅ Connection confirmed${ev ? ` — ${ev}` : ''}`,
    notOk: '⚠️ Not confirmed: no photo shows the passage between these two rooms. The AI will imagine the path (door, hallway). If they are not neighbors, change the order or remove one.',
    up: 'Up', down: 'Down', remove: 'Remove', addBack: 'Rooms left out (tap to add at the end):',
    excluded: (n: number) => `${n} photo(s) left out (person, dark photo or detail only).`,
    cost: (steps: number, usd: number) => `${steps} rooms · ${Math.max(0, steps - 1)} 6-second passages · about US$ ${usd.toFixed(2)}`,
    month: (spent: number, cap: number) => `Used this month: US$ ${spent.toFixed(2)} of US$ ${cap.toFixed(0)}`,
    generate: 'Approve and generate the tour →', saving: 'Saving…',
    generating: (d: number, t: number) => `Generating the tour… ${d} of ${t} passages ready. Takes a few minutes — you can close and come back.`,
    assembling: 'Joining the passages into the final video…',
    done: 'Tour ready!', cuts: 'Cuts ready for Reels and Stories', download: 'Download',
    failed: "It didn't work this time.", retry: 'Try again', redo: 'Build again (new analysis)',
    errGeneric: 'Something went wrong. Try again in a few minutes.',
  },
}

async function call(body: Record<string, unknown>): Promise<{ status: number; data: Record<string, unknown> }> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/tour-plan`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

// Mesma regra do servidor (_shared/tourPlan.ts linksFor): confirmada quando um
// dos dois ambientes aparece na foto do outro. Recalcula a cada troca de ordem.
function linkFor(graph: Graph, a: string, b: string): Link {
  const A = graph[a], B = graph[b]
  if (A?.ve.includes(b)) return { from: a, to: b, confirmado: true, evidencia: A.evidencia }
  if (B?.ve.includes(a)) return { from: a, to: b, confirmado: true, evidencia: B.evidencia }
  return { from: a, to: b, confirmado: false, evidencia: '' }
}

function Panel({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const tx = TX[useLang().lang]
  const [resp, setResp] = useState<GetResp | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [video, setVideo] = useState<{ url: string; cuts: { nome: string; video_url: string }[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const dirty = useRef(false)

  const load = useCallback(async () => {
    const { data } = await call({ action: 'get', item_id: itemId })
    const r = data as unknown as GetResp
    setResp(r)
    if (r.tour?.plan && !dirty.current) setSteps(r.tour.plan.steps)
    if (r.tour && ['generating', 'assembling', 'completed'].includes(r.tour.status)) {
      const { data: st } = await call({ action: 'status', tour_id: r.tour.id })
      if (st.status === 'completed') setVideo({ url: String(st.video_url), cuts: (st.cuts ?? []) as { nome: string; video_url: string }[] })
      else if (typeof st.done === 'number') setProgress({ done: st.done as number, total: st.total as number })
    }
  }, [itemId])

  useEffect(() => { void load() }, [load])
  const status = resp?.tour?.status
  useEffect(() => {
    if (status !== 'analyzing' && status !== 'generating' && status !== 'assembling') return
    const t = setTimeout(() => void load(), POLL_MS)
    return () => clearTimeout(t)
  }, [status, resp, load])

  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= steps.length) return
    const next = [...steps]; [next[i], next[j]] = [next[j], next[i]]
    dirty.current = true; setSteps(next)
  }
  const removeAt = (i: number) => { dirty.current = true; setSteps(steps.filter((_, k) => k !== i)) }
  const addBack = (s: Step) => { dirty.current = true; setSteps([...steps, s]) }

  const save = async (): Promise<boolean> => {
    if (!resp?.tour || !dirty.current) return true
    const { status: code, data } = await call({ action: 'save_order', tour_id: resp.tour.id, steps })
    if (code >= 400) { setMsg(String(data.error ?? tx.errGeneric)); return false }
    const plan = data.plan as Plan
    setSteps(plan.steps); dirty.current = false
    return true
  }

  const analyze = async () => {
    setBusy(true); setMsg('')
    const { status: code, data } = await call({ action: 'analyze', item_id: itemId })
    setBusy(false)
    if (code >= 400) { setMsg(String(data.error ?? tx.errGeneric)); return }
    dirty.current = false; await load()
  }

  const generate = async () => {
    if (!resp?.tour) return
    setBusy(true); setMsg('')
    if (!(await save())) { setBusy(false); return }
    const { status: code, data } = await call({ action: 'generate', tour_id: resp.tour.id })
    setBusy(false)
    if (code >= 400) { setMsg(String(data.error ?? tx.errGeneric)); return }
    setProgress({ done: 0, total: Number(data.total ?? steps.length - 1) }); await load()
  }

  const btn = { padding: '11px 16px', background: ORANGE, color: '#000', fontWeight: 800, fontSize: '13px', border: 'none', borderRadius: '10px', cursor: busy ? 'wait' : 'pointer', fontFamily: D, opacity: busy ? 0.6 : 1 } as const
  const small = { padding: '4px 8px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '6px', color: MUTED, fontSize: '11px', cursor: 'pointer', fontFamily: D } as const
  const inPlan = new Set(steps.map(s => s.ambiente_id))
  const available = [...(resp?.available ?? []), ...(resp?.tour?.plan?.steps ?? [])].filter((s, i, arr) => !inPlan.has(s.ambiente_id) && arr.findIndex(x => x.ambiente_id === s.ambiente_id) === i)
  const estimate = (resp?.cost_per_step_usd ?? 0.65) * Math.max(0, steps.length - 1)

  return (
    <div role="dialog" aria-modal="true" onClick={e => { e.stopPropagation(); onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: '560px', background: CARD, border: '1px solid rgba(255,109,41,0.35)', borderRadius: '16px', padding: '20px', fontFamily: D, margin: '24px 0' }}>
        <button onClick={onClose} aria-label={tx.close} style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.06)', color: MUTED, cursor: 'pointer' }}>✕</button>
        <div style={{ fontSize: '17px', fontWeight: 800, color: 'white', marginBottom: '6px', paddingRight: '36px' }}>{tx.title}</div>
        {msg && <p style={{ fontSize: '12.5px', color: '#f87171', margin: '6px 0 10px' }}>{msg}</p>}

        {!resp ? <div style={{ fontSize: '12px', color: MUTED }}>…</div> : (!resp.tour || (resp.tour.status === 'failed' && !resp.tour.plan?.steps?.length)) ? (
          <>
            <p style={{ fontSize: '13px', color: MUTED, lineHeight: 1.6, margin: '0 0 14px' }}>{resp.tour?.status === 'failed' ? tx.failed : tx.intro}</p>
            <button style={btn} disabled={busy} onClick={() => void analyze()}>{resp.tour ? tx.retry : tx.analyze}</button>
          </>
        ) : resp.tour.status === 'analyzing' ? (
          <p role="status" style={{ fontSize: '13px', color: MUTED, lineHeight: 1.6 }}>{tx.analyzing}</p>
        ) : resp.tour.status === 'awaiting_approval' ? (
          <>
            {resp.tour.plan?.observacoes && <p style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.55, margin: '0 0 12px' }}>{resp.tour.plan.observacoes}</p>}
            <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{tx.order}</div>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {steps.map((s, i) => {
                const next = steps[i + 1]
                const l = next ? linkFor(resp.graph ?? {}, s.ambiente_id, next.ambiente_id) : undefined
                return (
                  <li key={s.ambiente_id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                      <span style={{ minWidth: 22, height: 22, borderRadius: 11, background: ORANGE, color: '#000', fontSize: '11px', fontWeight: 800, textAlign: 'center', lineHeight: '22px' }}>{i + 1}</span>
                      <img src={s.photo} alt="" style={{ width: 52, height: 65, objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', color: 'white', fontWeight: 700 }}>{s.nome}</div>
                        <div style={{ fontSize: '11px', color: MUTED }}>{s.zona}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button style={small} aria-label={tx.up} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                        <button style={small} aria-label={tx.down} disabled={i === steps.length - 1} onClick={() => move(i, 1)}>↓</button>
                        <button style={small} aria-label={tx.remove} onClick={() => removeAt(i)}>✕</button>
                      </div>
                    </div>
                    {next && (
                      <div style={{ margin: '4px 0 4px 32px', padding: '6px 10px', borderLeft: `2px solid ${l?.confirmado ? '#4ade80' : '#FBBF24'}`, fontSize: '11.5px', lineHeight: 1.45, color: l?.confirmado ? '#86efac' : '#fcd34d' }}>
                        {l?.confirmado ? tx.ok(l.evidencia) : tx.notOk}
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
            {available.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '11.5px', color: MUTED, marginBottom: '6px' }}>{tx.addBack}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {available.map(s => <button key={s.ambiente_id} style={small} onClick={() => addBack(s)}>+ {s.nome}</button>)}
                </div>
              </div>
            )}
            {!!resp.tour.plan?.excluidos?.length && <p style={{ fontSize: '11.5px', color: MUTED, margin: '10px 0 0' }}>{tx.excluded(resp.tour.plan.excluidos.length)}</p>}
            <div style={{ margin: '14px 0 10px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,109,41,0.07)', border: '1px solid rgba(255,109,41,0.25)', fontSize: '12px', color: 'white', lineHeight: 1.6 }}>
              {tx.cost(steps.length, estimate)}<br /><span style={{ color: MUTED }}>{tx.month(resp.month_spent_usd, resp.month_cap_usd)}</span>
            </div>
            <button style={{ ...btn, width: '100%' }} disabled={busy || steps.length < 2} onClick={() => void generate()}>{busy ? tx.saving : tx.generate}</button>
          </>
        ) : resp.tour.status === 'generating' || resp.tour.status === 'assembling' ? (
          <p role="status" style={{ fontSize: '13px', color: MUTED, lineHeight: 1.6 }}>
            {progress && progress.done < progress.total ? tx.generating(progress.done, progress.total) : tx.assembling}
          </p>
        ) : resp.tour.status === 'completed' && video ? (
          <>
            <div style={{ fontSize: '13px', color: '#4ade80', fontWeight: 700, marginBottom: '10px' }}>{tx.done}</div>
            <video src={video.url} controls playsInline style={{ width: '100%', borderRadius: '12px', background: '#000', display: 'block' }} />
            <a href={video.url} download style={{ ...small, display: 'inline-block', marginTop: '8px', textDecoration: 'none', color: ORANGE }}>{tx.download}</a>
            {video.cuts.length > 0 && (
              <div style={{ marginTop: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{tx.cuts}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
                  {video.cuts.map(c => (
                    <div key={c.video_url}>
                      <video src={c.video_url} controls playsInline preload="metadata" style={{ width: '100%', borderRadius: '8px', background: '#000', display: 'block' }} />
                      <div style={{ fontSize: '11px', color: 'white', marginTop: '4px' }}>{c.nome}</div>
                      <a href={c.video_url} download style={{ fontSize: '11px', color: ORANGE }}>{tx.download}</a>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button style={{ ...small, marginTop: '14px' }} disabled={busy} onClick={() => void analyze()}>{tx.redo}</button>
          </>
        ) : resp.tour.status === 'failed' ? (
          <>
            <p style={{ fontSize: '13px', color: MUTED, margin: '0 0 12px' }}>{tx.failed}</p>
            <button style={btn} disabled={busy} onClick={() => void analyze()}>{tx.retry}</button>
          </>
        ) : <div style={{ fontSize: '12px', color: MUTED }}>…</div>}
      </div>
    </div>
  )
}

export default function ItemTour({ itemId }: { itemId: string }) {
  const tx = TX[useLang().lang]
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ width: '100%', padding: '7px 10px', marginTop: '6px', background: 'transparent', border: '1px solid rgba(255,109,41,0.4)', borderRadius: '7px', color: ORANGE, fontWeight: 700, fontSize: '11px', cursor: 'pointer', fontFamily: D }}>
        {tx.open}
      </button>
      {open && <Panel itemId={itemId} onClose={() => setOpen(false)} />}
    </>
  )
}
