// Item 1.3b / B (dono, 19–20/11): no topo do Tour virtual, dois exemplos para o cliente entender o que pode ser feito
// antes de escolher o imóvel — o tour completo e o mobiliado. O material vem da ficha (config.tour.examples, regra 6) e é
// sempre real: o tour da Tespon de 13/11 (autorizado pelo dono). Sem exemplo de mobiliado bom ainda, o cartão mostra só
// o que é e a regra (nunca inventa um exemplo). Compacto, para a lista de imóveis continuar à vista.
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../contexts/LanguageContext'
import { CARD, MUTED, BORDER } from './marketingAi/shared'

interface Examples { tour?: { video_url?: string; poster?: string } | null; staging?: { before?: string; after?: string } | null }

const TX = {
  pt: {
    title: 'O que dá para fazer',
    tour: '🎬 Tour completo', tourHelp: 'A câmera passa pelos cômodos na ordem certa, só com as fotos reais do imóvel. Exemplo real de um imóvel.',
    staging: '🛋️ Mobiliar cômodo vazio', stagingHelp: 'A partir da foto real de um cômodo vazio, a IA coloca móveis no estilo escolhido. Confira sempre o resultado: paredes, janelas, piso e vista precisam ficar como na foto. O post sai com o aviso "mobiliado virtualmente".',
    before: 'Antes (foto real)', after: 'Depois (mobiliado)', soon: 'Exemplo em breve.',
  },
  en: {
    title: 'What you can make',
    tour: '🎬 Full tour', tourHelp: 'The camera goes through the rooms in the right order, using only the property\'s real photos. A real example.',
    staging: '🛋️ Furnish an empty room', stagingHelp: 'From the real photo of an empty room, the AI adds furniture in the chosen style. Always check the result: walls, windows, floor and view must stay as in the photo. The post carries a "virtually furnished" notice.',
    before: 'Before (real photo)', after: 'After (furnished)', soon: 'Example coming soon.',
  },
} as const

export default function TourExamples({ verticalKey }: { verticalKey: string | null }) {
  const { lang } = useLang()
  const tx = TX[lang]
  const [ex, setEx] = useState<Examples | null>(null)

  useEffect(() => {
    if (!verticalKey) return
    let off = false
    void (async () => {
      try {
        const { data } = await supabase.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
        if (!off) setEx(((data?.config as { tour?: { examples?: Examples } } | null)?.tour?.examples) ?? {})
      } catch { if (!off) setEx({}) }
    })()
    return () => { off = true }
  }, [verticalKey])

  if (!ex || (!ex.tour?.video_url && !ex.staging)) return null
  const card = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '12px', minWidth: 0 }
  const media = { width: '100%', maxHeight: 220, objectFit: 'cover' as const, borderRadius: '10px', display: 'block', background: '#000' }

  return (
    <section aria-label={tx.title} style={{ marginBottom: '22px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '10px' }}>{tx.title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
        <div style={card}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>{tx.tour}</div>
          {ex.tour?.video_url
            ? <video src={ex.tour.video_url} poster={ex.tour.poster} controls muted playsInline preload="none" style={media} />
            : <div style={{ fontSize: '12px', color: MUTED }}>{tx.soon}</div>}
          <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.5, marginTop: '8px' }}>{tx.tourHelp}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>{tx.staging}</div>
          {ex.staging?.before && ex.staging?.after ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {[[ex.staging.before, tx.before], [ex.staging.after, tx.after]].map(([src, label]) => (
                <figure key={label} style={{ margin: 0 }}>
                  <img src={src} alt={label} loading="lazy" style={{ ...media, maxHeight: 160, aspectRatio: '4 / 3' }} />
                  <figcaption style={{ fontSize: '11px', color: MUTED, marginTop: '4px' }}>{label}</figcaption>
                </figure>
              ))}
            </div>
          ) : <div style={{ fontSize: '12px', color: MUTED, padding: '10px', border: `1px dashed ${BORDER}`, borderRadius: '10px' }}>{tx.soon}</div>}
          <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.5, marginTop: '8px' }}>{tx.stagingHelp}</div>
        </div>
      </div>
    </section>
  )
}
