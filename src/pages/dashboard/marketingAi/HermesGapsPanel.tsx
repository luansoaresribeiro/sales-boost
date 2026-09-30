import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { useLang } from '../../../contexts/LanguageContext'
import { d } from '../../../i18n-dash'
import { supabase } from '../../../lib/supabase'
import { CARD, MUTED, BORDER, ORANGE, D } from './shared'
import { fetchCatalogSchema, fetchOnboardingQuestions } from '../../../lib/verticalPlaybook'

interface GapItem {
  key: string
  label: string
  why: string
  status: 'ok' | 'gap' | 'unavailable'
  actionLabel?: string
  actionHref?: string
}

// "O que o Hermes ainda não sabe" — cada item vem do ESTADO REAL (conexão
// existe? tabela tem linha? ficha define catálogo?), nunca de texto
// inventado pela IA. 'unavailable' = gap estrutural do produto hoje (não
// tem como o dono resolver clicando em nada — falta a fonte de dado em si).
export default function HermesGapsPanel({ company }: { company: CompanyData }) {
  const navigate = useNavigate()
  const { lang } = useLang()
  const t = d[lang].hermesGaps
  const [items, setItems] = useState<GapItem[] | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      const verticalKey = company.vertical_key ?? 'generico'
      const [{ count: competitorsCount }, { count: catalogCount }, catalogSchema, onboarding] = await Promise.all([
        supabase.from('competitors').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('marketing_ai_knowledge').select('id', { count: 'exact', head: true }).eq('company_id', company.id).eq('module', 'visual').eq('kind', 'product'),
        fetchCatalogSchema(verticalKey),
        verticalKey === 'generico' ? Promise.resolve({ name: '', questions: [] }) : fetchOnboardingQuestions(verticalKey),
      ])
      if (!alive) return

      const list: GapItem[] = []

      list.push({
        key: 'competitors', label: t.competitorsLabel, why: t.competitorsWhy,
        status: (competitorsCount ?? 0) > 0 ? 'ok' : 'gap',
        actionLabel: t.competitorsAction, actionHref: '/dashboard/marketing-ai/dados',
      })

      list.push({
        key: 'instagram', label: t.instagramLabel, why: t.instagramWhy,
        status: company.instagram_user_id ? 'ok' : 'gap',
        actionLabel: t.instagramAction, actionHref: '/dashboard/settings?tab=conexoes',
      })

      if (catalogSchema) {
        const itemName = catalogSchema.itemLabel.toLowerCase()
        list.push({
          key: 'catalog', label: `${catalogSchema.catalogLabel}`, why: t.catalogWhy.replace('{item}', itemName),
          status: (catalogCount ?? 0) > 0 ? 'ok' : 'gap',
          actionLabel: t.catalogAction.replace('{item}', itemName), actionHref: '/dashboard/marketing-ai/dados',
        })
      }

      if (onboarding.questions.length > 0) {
        const answered = Object.keys(company.playbook_answers ?? {}).length
        list.push({
          key: 'onboarding', label: t.onboardingLabel, why: t.onboardingWhy,
          status: answered >= onboarding.questions.length ? 'ok' : 'gap',
          actionLabel: t.onboardingAction, actionHref: '/dashboard/settings',
        })
      }

      list.push({ key: 'trends', label: t.trendsLabel, why: t.trendsWhy, status: 'unavailable' })
      list.push({ key: 'market_data', label: t.marketLabel, why: t.marketWhy, status: 'unavailable' })

      setItems(list)
    }
    load()
    return () => { alive = false }
  }, [company.id, company.vertical_key, company.instagram_user_id, company.instagram_url, company.playbook_answers, t])

  if (!items) return null
  const openGaps = items.filter(i => i.status !== 'ok')
  if (!openGaps.length) return null

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '18px 20px', marginBottom: '18px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>{t.title}</div>
      <div style={{ fontSize: '11.5px', color: MUTED, marginBottom: '14px', lineHeight: 1.5 }}>{t.subtitle}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {openGaps.map(item => (
          <div key={item.key} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', padding: '11px 13px', borderRadius: '9px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>{item.label}</div>
              <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>{item.why}</div>
            </div>
            {item.status === 'unavailable' ? (
              <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', border: `1px solid ${BORDER}`, borderRadius: '99px', padding: '4px 10px' }}>{t.soon}</span>
            ) : (
              <button onClick={() => item.actionHref && navigate(item.actionHref)} style={{ flexShrink: 0, fontSize: '11px', fontWeight: 700, color: ORANGE, background: 'transparent', textDecoration: 'none', border: '1px solid rgba(255,109,41,0.4)', borderRadius: '8px', padding: '6px 12px', fontFamily: D, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                {item.actionLabel} →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
