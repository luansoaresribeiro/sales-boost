import { CARD, MUTED, BORDER, D } from './shared'
import type { DemoConnection } from './growthDemo'
import IntegrationsTab from '../settings/IntegrationsTab'
import { useLang } from '../../../contexts/LanguageContext'

const AMBER = '#FBBF24'

// Conexões que ainda não têm fluxo real (Meta Ads e WhatsApp dependem da
// verificação da Meta; CRM e e-commerce estão no roadmap). As conexões que
// já funcionam de verdade (Google Search Console, Instagram, Google Business
// Profile) são renderizadas pelo IntegrationsTab logo acima.
const COMING_SOON = new Set(['meta_ads', 'whatsapp', 'crm', 'shopify'])

const TX = {
  pt: {
    waitingMeta: 'Aguardando Meta', soon: 'Em breve', connectWhenVerified: 'Conectar quando verificado',
    intro: 'Este é o único lugar para conectar suas ferramentas ao Growth OS. Quanto mais fontes ligadas, mais preciso o agente fica.',
    noteA: 'Meta Ads e WhatsApp Business', noteB: ' ficam disponíveis assim que sua conta for verificada pela Meta. Quando a verificação sair, os dados reais entram sem mudar nada nas telas.',
    over: {} as Record<string, { name: string; detail: string }>,
  },
  en: {
    waitingMeta: 'Waiting for Meta', soon: 'Coming soon', connectWhenVerified: 'Connect once verified',
    intro: 'This is the only place to connect your tools to Growth OS. The more sources connected, the more accurate the agent gets.',
    noteA: 'Meta Ads and WhatsApp Business', noteB: ' become available as soon as your account is verified by Meta. Once verification is done, real data flows in without changing anything on the screens.',
    over: {
      meta_ads: { name: 'Meta Ads Manager', detail: 'Waiting for Meta verification' },
      whatsapp: { name: 'WhatsApp Business API', detail: 'Waiting for Meta verification' },
      crm: { name: 'CRM', detail: 'Sales Boost native pipeline (coming soon)' },
      shopify: { name: 'Shopify / E-commerce', detail: 'Connect your store to attribute revenue' },
    } as Record<string, { name: string; detail: string }>,
  },
} as const

function ComingSoonCard({ c }: { c: DemoConnection }) {
  const { lang } = useLang()
  const X = TX[lang]
  const name = X.over[c.key]?.name ?? c.name
  const detail = X.over[c.key]?.detail ?? c.detail
  const waiting = c.requiresVerification
  const statusColor = waiting ? AMBER : 'rgba(255,255,255,0.35)'
  const statusLabel = waiting ? X.waitingMeta : X.soon
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '13px', padding: '15px 16px', display: 'flex', flexDirection: 'column', gap: '10px', opacity: 0.9 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'white' }}>{c.icon} {name}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, color: statusColor, flexShrink: 0 }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '99px', background: statusColor }} />{statusLabel}
        </span>
      </div>
      <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5, minHeight: '32px' }}>{detail}</div>
      <button
        disabled
        style={{
          alignSelf: 'flex-start', padding: '6px 14px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, fontFamily: D,
          border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, cursor: 'default',
        }}>
        {waiting ? X.connectWhenVerified : X.soon}
      </button>
    </div>
  )
}

export default function ConnectionsTab({ connections }: { connections: DemoConnection[] }) {
  const { lang } = useLang()
  const X = TX[lang]
  const comingSoon = connections.filter(c => COMING_SOON.has(c.key))

  return (
    <div>
      <div style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6, maxWidth: '620px', marginBottom: '18px' }}>
        {X.intro}
      </div>

      {/* Conexões reais e funcionais (Google Search Console, Instagram + auto-post, Google Business Profile) */}
      <IntegrationsTab />

      {/* Em breve / aguardando verificação da Meta */}
      {comingSoon.length > 0 && (
        <div style={{ marginTop: '4px' }}>
          <div style={{ marginBottom: '14px', padding: '12px 16px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>
            ⏳ <strong>{X.noteA}</strong>{X.noteB}
          </div>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
            {X.soon}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
            {comingSoon.map(c => <ComingSoonCard key={c.key} c={c} />)}
          </div>
        </div>
      )}
    </div>
  )
}
