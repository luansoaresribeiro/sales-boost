import { useEffect, useState } from 'react'
import { CARD, MUTED, BORDER, D, ORANGE } from './marketingAi/shared'
import BusinessContextTab from './marketingAi/BusinessContextTab'
import CatalogItems from './marketingAi/CatalogItems'
import { useCompany } from '../../contexts/CompanyContext'
import { supabase } from '../../lib/supabase'
import { fetchCatalogSchema, type CatalogSchema } from '../../lib/verticalPlaybook'

// Botão flutuante global (todo o dashboard) — a entrada rápida do dono pra
// alimentar o Sales Boost de qualquer tela, sem navegar. Abas:
// - Contexto do negócio: mudança/novidade pro Agente de Dados (tabela
//   business_context, ver BusinessContextTab.tsx).
// - Catálogo (ex.: imóveis): fotos reais dos itens — mesma tela de
//   "Estilos e Visuais → Arquivo", só que a 1 clique. Só aparece pra quem tem
//   ficha com catalog_fields (nome da aba vem da ficha, nada de setor no código).
// - Avatar: "em breve" (integração HeyGen ainda não existe). Não recebe foto
//   do rosto ainda — só registra interesse (marketing_ai_tool_interest).
type Tab = 'contexto' | 'catalogo' | 'avatar'

export default function BusinessContextButton({ companyId }: { companyId: string }) {
  const { company } = useCompany()
  const verticalKey = company?.vertical_key ?? 'generico'
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('contexto')
  const [catalogSchema, setCatalogSchema] = useState<CatalogSchema | null>(null)

  useEffect(() => {
    let alive = true
    fetchCatalogSchema(verticalKey).then(s => { if (alive) setCatalogSchema(s) })
    return () => { alive = false }
  }, [verticalKey])

  const tabs: [Tab, string][] = [
    ['contexto', '🧠 Contexto do negócio'],
    ...(catalogSchema ? [['catalogo', `📸 Fotos · ${catalogSchema.catalogLabel}`] as [Tab, string]] : []),
    ['avatar', '🙂 Meu avatar'],
  ]

  const subtitle = tab === 'contexto'
    ? 'Avise o Agente de Dados de qualquer mudança ou novidade — ele passa a considerar isso nas próximas decisões.'
    : tab === 'catalogo'
      ? 'Suba as fotos reais de cada item. São elas que viram carrosséis e vídeos — nunca imagem inventada.'
      : 'Um avatar seu apresentando o que você vende. Em breve.'

  return (
    <>
      <button onClick={() => setOpen(true)} title="Contexto, fotos e avatar — alimente o Sales Boost"
        style={{
          position: 'fixed', right: '24px', bottom: '24px', zIndex: 60, width: '52px', height: '52px', borderRadius: '50%',
          background: ORANGE, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(255,109,41,0.4)',
        }}>
        <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, fill: 'none', stroke: 'white', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => setOpen(false)}>
          <div style={{ background: '#0E0B0A', border: `1px solid ${BORDER}`, borderRadius: '18px', width: '100%', maxWidth: '760px', maxHeight: '88vh', overflowY: 'auto', padding: '22px 20px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', marginBottom: '14px' }}>
              <div>
                <div style={{ fontFamily: D, fontSize: '17px', fontWeight: 800, color: 'white' }}>Alimentar o Sales Boost</div>
                <div style={{ fontSize: '12px', color: MUTED, marginTop: '3px' }}>{subtitle}</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, cursor: 'pointer', fontSize: '15px', padding: '6px 10px', flexShrink: 0, fontFamily: D }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
              {tabs.map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} style={{ padding: '7px 12px', background: tab === k ? 'rgba(255,109,41,0.14)' : 'transparent', border: `1px solid ${tab === k ? 'rgba(255,109,41,0.4)' : 'transparent'}`, borderRadius: '7px', color: tab === k ? ORANGE : 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>{label}</button>
              ))}
            </div>

            {tab === 'contexto' && <BusinessContextTab company={{ id: companyId }} />}
            {tab === 'catalogo' && catalogSchema && <CatalogItems companyId={companyId} schema={catalogSchema} verticalKey={verticalKey} />}
            {tab === 'avatar' && <AvatarSoon companyId={companyId} verticalKey={verticalKey} />}
          </div>
        </div>
      )}
    </>
  )
}

function AvatarSoon({ companyId, verticalKey }: { companyId: string; verticalKey: string }) {
  const [toolId, setToolId] = useState<string | null>(null)
  const [interested, setInterested] = useState(false)

  useEffect(() => {
    let alive = true
    supabase.from('marketing_ai_tool_registry').select('id').eq('vertical_key', verticalKey).eq('requires_integration', 'heygen').ilike('id', '%avatar%').limit(1).maybeSingle()
      .then(async ({ data }) => {
        if (!alive || !data?.id) return
        setToolId(data.id as string)
        const { data: mine } = await supabase.from('marketing_ai_tool_interest').select('tool_id').eq('company_id', companyId).eq('tool_id', data.id).maybeSingle()
        if (alive) setInterested(!!mine)
      })
    return () => { alive = false }
  }, [companyId, verticalKey])

  const notify = async () => {
    if (!toolId) return
    await supabase.from('marketing_ai_tool_interest').upsert({ tool_id: toolId, company_id: companyId }, { onConflict: 'tool_id,company_id' })
    setInterested(true)
  }

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '22px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '34px', marginBottom: '8px' }}>🙂</div>
      <div style={{ display: 'inline-block', fontSize: '10.5px', fontWeight: 800, color: ORANGE, background: 'rgba(255,109,41,0.12)', border: '1px solid rgba(255,109,41,0.35)', borderRadius: '99px', padding: '3px 10px', marginBottom: '10px' }}>EM BREVE</div>
      <div style={{ fontFamily: D, fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '6px' }}>Seu avatar apresentando o que você vende</div>
      <div style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6, maxWidth: '440px', margin: '0 auto 16px' }}>
        Com algumas fotos e um vídeo curto seu, o Sales Boost vai criar vídeos com você apresentando cada item do seu catálogo — sem precisar gravar toda vez.
        Ainda não está disponível; quando estiver, você envia suas fotos por aqui e aprova antes de qualquer vídeo ir ao ar.
      </div>
      {toolId && (
        <button onClick={notify} disabled={interested}
          style={{ padding: '10px 18px', background: interested ? 'transparent' : ORANGE, color: interested ? '#4ade80' : '#000', border: interested ? '1px solid rgba(74,222,128,0.4)' : 'none', borderRadius: '9px', fontWeight: 700, fontSize: '12.5px', cursor: interested ? 'default' : 'pointer', fontFamily: D }}>
          {interested ? '✓ Você será avisado' : 'Quero ser avisado'}
        </button>
      )}
    </div>
  )
}
