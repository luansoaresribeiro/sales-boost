// Frente 1, item 1.3 (20/11): quanto do imóvel o tour consegue cobrir SEM inventar passagem, e quais fotos faltam
// (com o ângulo), para mandar ao fotógrafo. Os dados vêm do servidor (item-videos coverage: ambientes do 1.1 + mapa de
// ligações do 1.2). Mostrar é grátis; identificar ambientes e mapear ligações usa IA de visão, então cada botão mostra a
// estimativa antes e só roda com a confirmação do dono. Só ligação CONFIRMADA conta como coberta.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, ORANGE, SUPABASE_URL } from './marketingAi/shared'

const GREEN = '#4ade80', AMBER = '#FBBF24'
type Status = 'linked' | 'probable' | 'none'
interface Space { key: string; label: string; area: string; status: Status; confirmed: string[]; probable: string[] }
interface Todo { kind: 'probable' | 'isolated' | 'stairs'; area: string; spaces: string[]; text: string }
interface Cov { total: number; linked: number; spaces: Space[]; todo: Todo[]; provisional?: boolean; needs?: 'spaces' | 'links'; error?: string }

const TX = {
  pt: {
    title: 'Cobertura do imóvel',
    help: 'Quantos ambientes o tour consegue mostrar sem inventar passagem. Uma passagem só conta quando uma foto mostra o outro ambiente pela porta.',
    bar: (a: number, b: number) => `${a} de ${b} ambientes com passagem comprovada por foto`,
    provisional: 'Provisório: alguns ambientes ainda estão em dúvida.',
    area: { externa: 'Área externa', social: 'Área social', intima: 'Área íntima', lazer: 'Lazer', servico: 'Serviço' } as Record<string, string>,
    st: { linked: '✓ comprovado', probable: '◐ confira (porta aparece, destino não)', none: '○ sem foto de passagem' },
    todo: (n: number) => `Fotos que faltam (${n})`, todoHelp: 'Lista para o fotógrafo. Cada foto mostra por onde se vai de um ambiente ao outro.',
    copy: 'Copiar lista', copied: '✓ Copiada',
    needsSpaces: 'Primeiro, a IA precisa separar as fotos por ambiente.', needsLinks: 'Agora, a IA precisa mapear quais ambientes se ligam (só com foto que prova).',
    runSpaces: 'Identificar ambientes', runLinks: 'Mapear passagens', estimate: (v: number) => `Custo estimado: US$ ${v.toFixed(2)}. Confirmar?`,
    yes: 'Sim, rodar', no: 'Cancelar', running: 'Analisando as fotos… (até 2 min)', err: 'Não deu certo agora. Tente de novo em alguns minutos.', loading: 'Carregando a cobertura…',
  },
  en: {
    title: 'Property coverage',
    help: 'How many spaces the tour can show without inventing a passage. A passage only counts when a photo shows the other space through the door.',
    bar: (a: number, b: number) => `${a} of ${b} spaces with a passage proven by a photo`,
    provisional: 'Provisional: some spaces are still uncertain.',
    area: { externa: 'Outside', social: 'Living area', intima: 'Bedrooms', lazer: 'Leisure', servico: 'Service' } as Record<string, string>,
    st: { linked: '✓ proven', probable: '◐ check (door shows, destination does not)', none: '○ no passage photo' },
    todo: (n: number) => `Missing photos (${n})`, todoHelp: 'A list for the photographer. Each photo shows how you get from one space to the next.',
    copy: 'Copy list', copied: '✓ Copied',
    needsSpaces: 'First, the AI needs to group the photos by space.', needsLinks: 'Now the AI needs to map which spaces connect (only with a photo that proves it).',
    runSpaces: 'Identify spaces', runLinks: 'Map passages', estimate: (v: number) => `Estimated cost: US$ ${v.toFixed(2)}. Confirm?`,
    yes: 'Yes, run it', no: 'Cancel', running: 'Analysing the photos… (up to 2 min)', err: 'That did not work now. Try again in a few minutes.', loading: 'Loading coverage…',
  },
} as const

async function call(body: Record<string, unknown>): Promise<{ status: number; data: Record<string, unknown> }> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/item-videos`, {
    method: 'POST', headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

const btn = (primary: boolean) => ({
  minHeight: 36, padding: '8px 14px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
  background: primary ? ORANGE : 'transparent', color: primary ? '#0E0B0A' : 'white', border: primary ? 'none' : '1px solid rgba(255,255,255,0.14)',
})

export default function TourCoverage({ itemId }: { itemId: string }) {
  const { lang } = useLang()
  const tx = TX[lang]
  const [cov, setCov] = useState<Cov | null>(null)
  const [ask, setAsk] = useState<{ action: 'group_spaces' | 'map_links'; usd: number } | null>(null)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const r = await call({ action: 'coverage', item_id: itemId, lang })
    setCov(r.status === 200 ? r.data as unknown as Cov : { total: 0, linked: 0, spaces: [], todo: [], error: String(r.data.error ?? tx.err) })
  }, [itemId, lang, tx.err])
  useEffect(() => { void load() }, [load])

  // Antes de gastar: estimativa (mapa: dry_run do servidor; ambientes: medido em 18/11, ~US$ 0,32 para 50 fotos).
  const prepare = async (action: 'group_spaces' | 'map_links') => {
    setMsg(null)
    if (action === 'group_spaces') { setAsk({ action, usd: 0.35 }); return }
    const r = await call({ action: 'map_links', item_id: itemId, dry_run: true })
    const est = (r.data.estimate as { total?: number } | undefined)?.total
    if (r.status !== 200 || typeof est !== 'number') { setMsg(String(r.data.error ?? tx.err)); return }
    setAsk({ action, usd: est })
  }
  const run = async () => {
    if (!ask) return
    setRunning(true); setMsg(null)
    const r = await call({ action: ask.action, item_id: itemId })
    setRunning(false); setAsk(null)
    if (r.status !== 200) { setMsg(String(r.data.error ?? tx.err)); return }
    await load()
  }
  const copy = async () => {
    if (!cov) return
    try { await navigator.clipboard.writeText(cov.todo.map((t, i) => `${i + 1}. ${t.text}`).join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* sem permissão */ }
  }

  const box = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px', marginBottom: '18px' }
  if (!cov) return <section style={box}><div style={{ color: MUTED, fontSize: '13px' }}>{tx.loading}</div></section>
  const pct = cov.total ? Math.round((cov.linked / cov.total) * 100) : 0
  const areas = [...new Set(cov.spaces.map(s => s.area))]
  const color = (s: Status) => (s === 'linked' ? GREEN : s === 'probable' ? AMBER : MUTED)

  return (
    <section style={box} aria-label={tx.title}>
      <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>{tx.title}</div>
      <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.55, marginBottom: '12px' }}>{tx.help}</div>

      {cov.error && <div style={{ fontSize: '12.5px', color: '#F87171' }}>{cov.error}</div>}
      {cov.needs && !ask && !running && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12.5px', color: 'white' }}>{cov.needs === 'spaces' ? tx.needsSpaces : tx.needsLinks}</span>
          <button style={btn(true)} onClick={() => void prepare(cov.needs === 'spaces' ? 'group_spaces' : 'map_links')}>{cov.needs === 'spaces' ? tx.runSpaces : tx.runLinks}</button>
        </div>
      )}
      {ask && !running && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
          <span style={{ fontSize: '12.5px', color: 'white' }}>{tx.estimate(ask.usd)}</span>
          <button style={btn(true)} onClick={() => void run()}>{tx.yes}</button>
          <button style={btn(false)} onClick={() => setAsk(null)}>{tx.no}</button>
        </div>
      )}
      {running && <div style={{ fontSize: '12.5px', color: MUTED }}>{tx.running}</div>}
      {msg && <div style={{ fontSize: '12.5px', color: '#F87171', marginTop: '8px' }}>{msg}</div>}

      {!cov.needs && !cov.error && cov.total > 0 && (
        <>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '6px' }}>{tx.bar(cov.linked, cov.total)}</div>
          <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: '6px' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: GREEN }} />
          </div>
          {cov.provisional && <div style={{ fontSize: '11.5px', color: AMBER, marginBottom: '8px' }}>{tx.provisional}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', margin: '12px 0' }}>
            {areas.map(a => (
              <div key={a}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>{tx.area[a] ?? a}</div>
                {cov.spaces.filter(s => s.area === a).map(s => (
                  <div key={s.key} style={{ fontSize: '12.5px', lineHeight: 1.5, color: 'white', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
                    <span style={{ color: color(s.status), whiteSpace: 'nowrap', fontSize: '11.5px' }}>{tx.st[s.status].split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ fontSize: '11px', color: MUTED, marginBottom: '12px' }}>{tx.st.linked} · {tx.st.probable} · {tx.st.none}</div>

          {cov.todo.length > 0 && (
            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{tx.todo(cov.todo.length)}</div>
                <button style={btn(false)} onClick={() => void copy()}>{copied ? tx.copied : tx.copy}</button>
              </div>
              <div style={{ fontSize: '11.5px', color: MUTED, marginBottom: '8px' }}>{tx.todoHelp}</div>
              <ol style={{ margin: 0, paddingLeft: '18px' }}>
                {cov.todo.map((t, i) => <li key={i} style={{ fontSize: '12.5px', color: 'white', lineHeight: 1.55, marginBottom: '6px' }}>{t.text}</li>)}
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  )
}
