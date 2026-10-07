import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { useLang } from '../../contexts/LanguageContext'
import { supabase } from '../../lib/supabase'
import { d } from '../../i18n-dash'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const BORDER = 'rgba(255,255,255,0.06)'

export type CardKey = 'posts' | 'trends' | 'campanhas' | 'avaliacoes' | 'opinioes' | 'concorrentes' | 'crescimento' | 'leads' | 'conversao' | 'followup' | 'fidelizacao' | 'performance' | 'audiencia' | 'diagnostico'
export type GroupKey = 'conteudo' | 'reputacao' | 'concorrentes' | 'crescimento' | 'atendimento' | 'dados'

export const CARD_ICONS: Record<CardKey, string> = {
  posts: '📝', trends: '🔥', campanhas: '📣',
  avaliacoes: '⭐', opinioes: '🌐',
  concorrentes: '🗺️', crescimento: '📈',
  leads: '🧲', conversao: '🔀', followup: '⏰', fidelizacao: '💛',
  performance: '⚡', audiencia: '👥', diagnostico: '🩺',
}

export const GROUP_ICONS: Record<GroupKey, string> = {
  conteudo: '📁', reputacao: '⭐', concorrentes: '🗺️', crescimento: '📈', atendimento: '💬', dados: '📊',
}

export const CARD_GROUPS: { group: GroupKey; keys: CardKey[] }[] = [
  { group: 'conteudo', keys: ['posts', 'trends', 'campanhas'] },
  { group: 'reputacao', keys: ['avaliacoes', 'opinioes'] },
  { group: 'concorrentes', keys: ['concorrentes'] },
  { group: 'crescimento', keys: ['crescimento'] },
  { group: 'atendimento', keys: ['leads', 'conversao', 'followup', 'fidelizacao'] },
  { group: 'dados', keys: ['performance', 'audiencia', 'diagnostico'] },
]

export const INSIGHT_KEYS: CardKey[] = ['avaliacoes', 'opinioes', 'concorrentes', 'crescimento', 'performance', 'audiencia', 'diagnostico']
export const COMING_SOON_KEYS = new Set<CardKey>(['leads', 'conversao', 'followup', 'fidelizacao'])

export function titleFor(T: typeof d['pt']['posts'], key: CardKey, group: GroupKey): string {
  if (group === 'concorrentes' || group === 'crescimento') {
    const i = T.tabIds.indexOf(group)
    return T.tabs[i] ?? key
  }
  const sub = T.subTabs[group as keyof typeof T.subTabs]
  if (sub) {
    const i = sub.tabIds.indexOf(key)
    if (i >= 0) return sub.tabs[i]
  }
  return key
}

export function groupTitle(T: typeof d['pt']['posts'], group: GroupKey): string {
  return T.cards.groupLabels[group]
}

export function groupOfKey(key: CardKey): GroupKey | undefined {
  return CARD_GROUPS.find(g => g.keys.includes(key))?.group
}

export function ModuleCard({ title, desc, preview, icon, soon, openLabel, soonLabel, onClick }: {
  title: string; desc: string; preview: string | null; icon: string; soon: boolean; openLabel: string; soonLabel: string; onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', boxSizing: 'border-box',
        background: CARD, border: `1px solid ${hover ? 'rgba(255,109,41,0.35)' : BORDER}`,
        borderRadius: '16px', padding: '20px 22px', cursor: 'pointer', fontFamily: D,
        transition: 'transform 0.18s, border-color 0.18s, box-shadow 0.18s',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? '0 8px 24px rgba(0,0,0,0.25)' : 'none',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span style={{ fontSize: '20px', flexShrink: 0 }}>{icon}</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        </div>
        {soon && (
          <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.25)', color: ORANGE, letterSpacing: '0.04em', flexShrink: 0 }}>
            {soonLabel}
          </span>
        )}
      </div>
      <p style={{ fontSize: '12px', color: MUTED, margin: 0, lineHeight: 1.5 }}>{desc}</p>
      {preview && (
        <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '9px', fontSize: '11.5px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {preview}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: hover ? ORANGE : 'rgba(255,255,255,0.25)', fontSize: '11.5px', fontWeight: 600, marginTop: 'auto', paddingTop: '4px' }}>
        {openLabel} <span style={{ transition: 'transform 0.18s', transform: hover ? 'translateX(3px)' : 'none' }}>→</span>
      </div>
    </button>
  )
}

// ── Dados reais compartilhados pelos cards (grid plano e páginas de categoria) ──

interface CardPreviewData {
  insightSummaries: Partial<Record<CardKey, string>>
  insightUpdatedAt: Partial<Record<CardKey, string>>
  postsCount: number | null
  draftsCount: number | null
  campaignsCount: number | null
}

export function useAgentCardPreviews(T: typeof d['pt']['posts']) {
  const { user } = useAuth()
  const { company } = useCompany()
  const { lang } = useLang()
  const [data, setData] = useState<CardPreviewData>({ insightSummaries: {}, insightUpdatedAt: {}, postsCount: null, draftsCount: null, campaignsCount: null })

  useEffect(() => {
    if (!user || !company) return
    supabase.from('insights_reports').select('tab_key, summary, created_at').eq('company_id', company.id).in('tab_key', INSIGHT_KEYS)
      .then(({ data: rows }) => {
        const summaries: Partial<Record<CardKey, string>> = {}
        const updatedAt: Partial<Record<CardKey, string>> = {}
        for (const row of (rows ?? []) as { tab_key: CardKey; summary: string; created_at: string }[]) {
          summaries[row.tab_key] = row.summary
          updatedAt[row.tab_key] = row.created_at
        }
        setData(d => ({ ...d, insightSummaries: summaries, insightUpdatedAt: updatedAt }))
      })
    supabase.from('posts').select('id, status', { count: 'exact' }).eq('company_id', company.id)
      .then(({ data: rows, count }) => {
        setData(d => ({ ...d, postsCount: count ?? 0, draftsCount: (rows ?? []).filter(p => p.status === 'rascunho').length }))
      })
    supabase.from('campaigns').select('id', { count: 'exact', head: true })
      .then(({ count }) => setData(d => ({ ...d, campaignsCount: count ?? 0 })))
  }, [user, company])

  const previewFor = (key: CardKey): string | null => {
    if (key === 'posts') {
      if (data.postsCount == null) return null
      if (data.draftsCount) return lang === 'en' ? `${data.draftsCount} draft${data.draftsCount === 1 ? '' : 's'} awaiting approval` : `${data.draftsCount} rascunho${data.draftsCount === 1 ? '' : 's'} aguardando aprovação`
      return data.postsCount > 0 ? (lang === 'en' ? `${data.postsCount} posts in total` : `${data.postsCount} posts no total`) : T.cards.noPreview
    }
    if (key === 'campanhas') {
      if (data.campaignsCount == null) return null
      return data.campaignsCount > 0 ? (lang === 'en' ? `${data.campaignsCount} campaign${data.campaignsCount === 1 ? '' : 's'}` : `${data.campaignsCount} campanha${data.campaignsCount === 1 ? '' : 's'}`) : T.cards.noPreview
    }
    if (INSIGHT_KEYS.includes(key)) {
      return data.insightSummaries[key] ?? T.cards.noPreview
    }
    return null
  }

  const groupPreview = (group: GroupKey, keys: CardKey[]): string | null => {
    if (group === 'atendimento') return null
    for (const key of keys) {
      const p = previewFor(key)
      if (p && p !== T.cards.noPreview) return p
    }
    return T.cards.noPreview
  }

  const groupUpdatedAt = (keys: CardKey[]): string | null => {
    const dates = keys.map(k => data.insightUpdatedAt[k]).filter((v): v is string => !!v)
    if (dates.length === 0) return null
    return dates.sort().reverse()[0]
  }

  return { previewFor, groupPreview, groupUpdatedAt }
}
