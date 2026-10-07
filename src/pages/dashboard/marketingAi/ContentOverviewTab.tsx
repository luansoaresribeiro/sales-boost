import { useEffect, useState, useCallback } from 'react'
import { useLang } from '../../../contexts/LanguageContext'
import { supabase } from '../../../lib/supabase'
import { CARD, MUTED, BORDER, D, FORMAT_CLASS, FUNNEL_LABEL, type FunnelStage } from './shared'
import { TEMPLATE_LABEL, type TestPost } from './TestingArea'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'

const FUNNEL_LABEL_EN: Record<FunnelStage, string> = { topo: 'Top', meio: 'Middle', fundo: 'Bottom' }
const TX = {
  pt: {
    loading: 'Carregando...', title: '🏠 Overview',
    introA: 'O resumo de onde o fluxo de conteúdo chegou: o que já está ', introB: 'agendado pra publicar', introC: ', o que está ', introD: 'pronto no Vault esperando agendar', introE: ', e se o ', introF: 'funil está equilibrado', introG: ' (Topo/Meio/Fundo) ou concentrado demais numa etapa só.',
    scheduledTitle: '📅 Agendados pra publicar', noneA: 'Nada agendado ainda. Agende publicações pelo ', vault: 'Vault',
    waitingTitle: '⭐ No Vault, esperando agendar', inVault: 'no Vault →', balance: '⚖️ Equilíbrio do funil', noClassified: 'Sem posts classificados por formato ainda no Vault/agendados.',
    balanced: '✓ Funil equilibrado entre as 3 etapas.', lowA: '⚠️ Pouco conteúdo de ', lowB: ' — considere gerar mais posts nessa etapa.',
  },
  en: {
    loading: 'Loading...', title: '🏠 Overview',
    introA: 'A summary of where the content flow has got to: what is already ', introB: 'scheduled to publish', introC: ', what is ', introD: 'ready in the Vault waiting to be scheduled', introE: ', and whether the ', introF: 'funnel is balanced', introG: ' (Top/Middle/Bottom) or too concentrated in a single stage.',
    scheduledTitle: '📅 Scheduled to publish', noneA: 'Nothing scheduled yet. Schedule posts from the ', vault: 'Vault',
    waitingTitle: '⭐ In the Vault, waiting to be scheduled', inVault: 'in the Vault →', balance: '⚖️ Funnel balance', noClassified: 'No posts classified by format yet in the Vault/scheduled.',
    balanced: '✓ Funnel balanced across the 3 stages.', lowA: '⚠️ Little ', lowB: ' content — consider generating more posts at this stage.',
  },
} as const

interface ScheduledRow { action_id: string; scheduled_at: string; post: TestPost }

const fmtWhen = (iso: string, lang: 'pt' | 'en') => new Date(iso).toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

// Overview vem DEPOIS do conteúdo acontecer no fluxo (o agente já gerou,
// avaliou e — quando a nota é boa — já mandou pro Vault sozinho, ver
// content-test/creative-generate), mas como ABA fica primeiro (mais à
// esquerda) dentro de Agente de Conteúdo: é o resumo de "o que já está
// pronto/agendado" antes de entrar em Biblioteca/Campanhas/Calendário.
export default function ContentOverviewTab({ companyId, onOpenVault }: { companyId: string; onOpenVault: () => void }) {
  const { lang } = useLang()
  const t = TX[lang]
  const funnelLabel = (s: FunnelStage) => (lang === 'en' ? FUNNEL_LABEL_EN[s] : FUNNEL_LABEL[s])
  const [scheduled, setScheduled] = useState<ScheduledRow[]>([])
  const [waiting, setWaiting] = useState<TestPost[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [{ data: vault }, { data: actions }] = await Promise.all([
      supabase.from('marketing_ai_test_content').select('*').eq('company_id', companyId).eq('status', 'vault').order('created_at', { ascending: false }),
      supabase.from('agent_actions').select('id, ref_id, scheduled_at').eq('company_id', companyId).eq('ref_type', 'marketing_ai_test_content').eq('execution_status', 'QUEUED').not('scheduled_at', 'is', null),
    ])
    const vaultPosts = (vault ?? []) as TestPost[]
    const byId = new Map(vaultPosts.map(p => [p.id, p]))
    const sched: ScheduledRow[] = ((actions ?? []) as { id: string; ref_id: string; scheduled_at: string }[])
      .flatMap(a => { const post = byId.get(a.ref_id); return post ? [{ action_id: a.id, scheduled_at: a.scheduled_at, post }] : [] })
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    const scheduledIds = new Set(sched.map(s => s.post.id))
    setScheduled(sched)
    setWaiting(vaultPosts.filter(p => !scheduledIds.has(p.id)))
    setLoading(false)
  }, [companyId])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ fontSize: '12px', color: MUTED }}>{t.loading}</div>

  // Equilíbrio do funil: cada template classificado (ver shared.ts) conta pra
  // uma ou mais etapas (ex: Foco no Produto é Meio+Fundo) — soma no Vault +
  // agendados, que é o que representa o que está prestes a ir pro ar.
  const all = [...scheduled.map(s => s.post), ...waiting]
  const tally: Record<FunnelStage, number> = { topo: 0, meio: 0, fundo: 0 }
  let classified = 0
  for (const p of all) {
    const key = p.format === 'foto' ? (p.brief?.template ?? 'livre') : null
    const cls = key ? FORMAT_CLASS[key] : null
    if (!cls) continue
    classified++
    for (const f of cls.funnel) tally[f]++
  }
  const maxTally = Math.max(1, tally.topo, tally.meio, tally.fundo)

  return (
    <div>
      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>{t.title}</div>
        <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55, maxWidth: '760px' }}>
          {t.introA}<strong style={{ color: 'white' }}>{t.introB}</strong>{t.introC}<strong style={{ color: 'white' }}>{t.introD}</strong>{t.introE}<strong style={{ color: 'white' }}>{t.introF}</strong>{t.introG}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '18px', alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'white', marginBottom: '10px' }}>{t.scheduledTitle} {scheduled.length > 0 && <span style={{ color: MUTED, fontWeight: 600 }}>({scheduled.length})</span>}</div>
          {scheduled.length === 0 ? (
            <div style={{ padding: '18px', textAlign: 'center', color: MUTED, fontSize: '12px', background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '11px' }}>
              {t.noneA}<button onClick={onOpenVault} style={{ background: 'none', border: 'none', color: ORANGE, fontWeight: 700, cursor: 'pointer', fontSize: '12px', padding: 0, fontFamily: D }}>{t.vault}</button>.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {scheduled.map(s => (
                <div key={s.action_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
                  {s.post.image_url && <img src={s.post.image_url} alt="" style={{ width: '38px', height: '38px', borderRadius: '7px', objectFit: 'cover', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.post.idea ?? 'Post'}</div>
                    <div style={{ fontSize: '10px', color: MUTED }}>
                      {s.post.format}{s.post.brief?.template ? ` · ${TEMPLATE_LABEL[s.post.brief.template] ?? s.post.brief.template}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#60a5fa', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '99px', padding: '4px 10px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    🕐 {fmtWhen(s.scheduled_at, lang)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {waiting.length > 0 && (
            <div style={{ marginTop: '18px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'white', marginBottom: '10px' }}>{t.waitingTitle} ({waiting.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {waiting.slice(0, 6).map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
                    {p.image_url && <img src={p.image_url} alt="" style={{ width: '32px', height: '32px', borderRadius: '7px', objectFit: 'cover', flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0, fontSize: '11.5px', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.idea ?? 'Post'}</div>
                  </div>
                ))}
                {waiting.length > 6 && <button onClick={onOpenVault} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: ORANGE, fontWeight: 700, cursor: 'pointer', fontSize: '11.5px', padding: '4px 0', fontFamily: D }}>+{waiting.length - 6} {t.inVault}</button>}
              </div>
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'white', marginBottom: '10px' }}>{t.balance}</div>
          {classified === 0 ? (
            <div style={{ padding: '18px', textAlign: 'center', color: MUTED, fontSize: '12px', background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '11px' }}>
              {t.noClassified}
            </div>
          ) : (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '15px' }}>
              {(['topo', 'meio', 'fundo'] as FunnelStage[]).map(stage => (
                <div key={stage} style={{ marginBottom: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                    <span style={{ color: 'white', fontWeight: 700 }}>{funnelLabel(stage)}</span>
                    <span style={{ color: MUTED }}>{tally[stage]}</span>
                  </div>
                  <div style={{ height: '7px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: `${(tally[stage] / maxTally) * 100}%`, height: '100%', background: tally[stage] === 0 ? 'rgba(255,255,255,0.15)' : ORANGE, borderRadius: '99px' }} />
                  </div>
                </div>
              ))}
              {(() => {
                const min = Math.min(tally.topo, tally.meio, tally.fundo)
                const weakest = (['topo', 'meio', 'fundo'] as FunnelStage[]).find(s => tally[s] === min)
                if (!weakest || min === maxTally) return (
                  <div style={{ fontSize: '11px', color: GREEN, marginTop: '4px' }}>{t.balanced}</div>
                )
                return (
                  <div style={{ fontSize: '11px', color: '#FBBF24', marginTop: '4px', lineHeight: 1.5 }}>
                    {t.lowA}<strong>{funnelLabel(weakest)}</strong>{t.lowB}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
