import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CARD, MUTED, BORDER, D, ORANGE } from './marketingAi/shared'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../contexts/LanguageContext'

const TX = {
  pt: {
    btnTitle: 'Subir fotos dos seus itens (Catálogo)',
    soon: 'EM BREVE', avatarTitle: 'Seu avatar apresentando o que você vende',
    avatarBody: 'Com algumas fotos e um vídeo curto seu, o Sales Boost vai criar vídeos com você apresentando cada item do seu catálogo — sem precisar gravar toda vez. Ainda não está disponível; quando estiver, você envia suas fotos por aqui e aprova antes de qualquer vídeo ir ao ar.',
    notified: '✓ Você será avisado', notify: 'Quero ser avisado',
  },
  en: {
    btnTitle: 'Upload photos of your items (Catalog)',
    soon: 'COMING SOON', avatarTitle: 'Your avatar presenting what you sell',
    avatarBody: "With a few photos and a short video of you, Sales Boost will create videos of you presenting each item in your catalog — no need to record every time. It's not available yet; when it is, you'll send your photos here and approve before any video goes live.",
    notified: "✓ You'll be notified", notify: 'Notify me',
  },
} as const

// Botão flutuante global (todo o dashboard) — atalho pro Catálogo do Agente
// de Dados (fotos reais dos itens). Antes abria um modal com Contexto do
// negócio / Catálogo / Avatar; o dono pediu (2026-10-14) que o "+" levasse
// pra MESMA tela do Agente de Dados, sem duas telas fazendo a mesma coisa.
// Contexto do negócio continua em Configurações; o Avatar ("em breve")
// mudou pra dentro do Agente de Dados.
// O sino de pendências dispara 'sb:open-add' com { itemId } pra cair direto
// no item certo (?item=<id>).
export default function BusinessContextButton() {
  const tx = TX[useLang().lang]
  const navigate = useNavigate()

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ itemId?: string }>).detail ?? {}
      navigate(`/dashboard/marketing-ai/dados${d.itemId ? `?item=${encodeURIComponent(d.itemId)}` : ''}`)
    }
    window.addEventListener('sb:open-add', onOpen)
    return () => window.removeEventListener('sb:open-add', onOpen)
  }, [navigate])

  return (
    <button onClick={() => navigate('/dashboard/marketing-ai/dados')} title={tx.btnTitle} aria-label={tx.btnTitle}
      style={{
        position: 'fixed', right: '24px', bottom: '24px', zIndex: 60, width: '52px', height: '52px', borderRadius: '50%',
        background: ORANGE, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(255,109,41,0.4)',
      }}>
      <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, fill: 'none', stroke: 'white', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  )
}

// Avatar "em breve" (integração HeyGen ainda não existe). Não recebe foto do
// rosto ainda — só registra interesse (marketing_ai_tool_interest). Mora no
// Agente de Dados.
export function AvatarSoon({ companyId, verticalKey }: { companyId: string; verticalKey: string }) {
  const tx = TX[useLang().lang]
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
      <div style={{ display: 'inline-block', fontSize: '10.5px', fontWeight: 800, color: ORANGE, background: 'rgba(255,109,41,0.12)', border: '1px solid rgba(255,109,41,0.35)', borderRadius: '99px', padding: '3px 10px', marginBottom: '10px' }}>{tx.soon}</div>
      <div style={{ fontFamily: D, fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '6px' }}>{tx.avatarTitle}</div>
      <div style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6, maxWidth: '440px', margin: '0 auto 16px' }}>
        {tx.avatarBody}
      </div>
      {toolId && (
        <button onClick={notify} disabled={interested}
          style={{ padding: '10px 18px', background: interested ? 'transparent' : ORANGE, color: interested ? '#4ade80' : '#000', border: interested ? '1px solid rgba(74,222,128,0.4)' : 'none', borderRadius: '9px', fontWeight: 700, fontSize: '12.5px', cursor: interested ? 'default' : 'pointer', fontFamily: D }}>
          {interested ? tx.notified : tx.notify}
        </button>
      )}
    </div>
  )
}
