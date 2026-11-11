// Menu "Tour virtual" (decisão do dono, 2026-11-10): escolher o imóvel e gerar o TOUR COMPLETO — a câmera começa de
// fora (só com foto real de fachada/vista) e passa pelos cômodos na ordem certa. O tour pronto vira um post em
// Aprovações (nada sai sem o dono). Mobiliar cômodo vazio chega na próxima etapa. O plano da semana não faz mais tour.
import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LanguageContext'
import { supabase } from '../../lib/supabase'
import TourBuilder from './TourBuilder'
import { CARD, MUTED, BORDER, ORANGE, D } from './marketingAi/shared'

interface Item { id: string; title: string; cover: string | null; photos: number }
type Mode = 'tour' | 'staging'

const TX = {
  pt: {
    title: 'Tour virtual',
    sub: 'Escolha o imóvel e gere um tour completo: a câmera começa de fora e passa pelos cômodos na ordem certa. Tudo a partir das fotos reais do imóvel. O tour pronto vai pra Aprovações — nada sai sem você.',
    pick: '1. Escolha o imóvel', none: 'Nenhum imóvel com fotos ainda. Cadastre em Meus imóveis.', photos: (n: number) => `${n} foto${n === 1 ? '' : 's'}`,
    mode: '2. O que você quer gerar?', tour: '🎬 Tour completo', staging: '🛋️ Mobiliar cômodo vazio',
    stagingSoon: 'Mobiliar cômodo vazio chega na próxima etapa — com o aviso "Imagem ilustrativa – mobiliado virtualmente" e a foto original junto, como manda a regra.',
    loading: 'Carregando…',
  },
  en: {
    title: 'Virtual tour',
    sub: 'Pick the property and generate a full tour: the camera starts outside and goes through the rooms in the right order. All from the property\'s real photos. The finished tour goes to Approvals — nothing goes out without you.',
    pick: '1. Pick the property', none: 'No property with photos yet. Add one in My properties.', photos: (n: number) => `${n} photo${n === 1 ? '' : 's'}`,
    mode: '2. What do you want to generate?', tour: '🎬 Full tour', staging: '🛋️ Furnish an empty room',
    stagingSoon: 'Furnishing an empty room comes in the next step — with the notice "Illustrative image – virtually furnished" and the original photo alongside, as the rule requires.',
    loading: 'Loading…',
  },
} as const

export default function TourVirtualPage() {
  const { user } = useAuth()
  const { lang } = useLang()
  const tx = TX[lang]
  const [items, setItems] = useState<Item[] | null>(null)
  const [itemId, setItemId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('tour')

  useEffect(() => {
    if (!user) return
    let off = false
    void (async () => {
      const { data: company } = await supabase.from('companies').select('id').eq('user_id', user.id).maybeSingle()
      if (!company) { if (!off) setItems([]); return }
      const { data } = await supabase.from('marketing_ai_knowledge').select('id, title, meta').eq('company_id', company.id).eq('kind', 'product').order('created_at', { ascending: false }).limit(100)
      const list = ((data ?? []) as { id: string; title: string | null; meta: { photos?: { url: string }[] } | null }[])
        .map(r => ({ id: r.id, title: r.title || 'Imóvel', cover: r.meta?.photos?.[0]?.url ?? null, photos: r.meta?.photos?.length ?? 0 }))
        .filter(r => r.photos >= 2)
      if (!off) setItems(list)
    })()
    return () => { off = true }
  }, [user])

  const chip = (on: boolean) => ({
    minHeight: 40, padding: '9px 16px', borderRadius: '99px', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
    background: on ? 'rgba(255,109,41,0.14)' : 'rgba(255,255,255,0.03)', border: `1px solid ${on ? 'rgba(255,109,41,0.55)' : BORDER}`, color: on ? ORANGE : 'white',
  })

  return (
    <div>
      <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${BORDER}` }}>
        <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{tx.title}</h1>
        <p style={{ color: MUTED, fontSize: '13px', lineHeight: 1.55, maxWidth: 720 }}>{tx.sub}</p>
      </div>
      <div style={{ padding: '24px 32px', maxWidth: 900 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '10px' }}>{tx.pick}</div>
        {items === null ? <div style={{ color: MUTED, fontSize: '13px' }}>{tx.loading}</div>
          : items.length === 0 ? <div style={{ color: MUTED, fontSize: '13px', padding: '14px', border: `1px dashed ${BORDER}`, borderRadius: '12px' }}>{tx.none}</div>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginBottom: '24px' }}>
                {items.map(it => {
                  const on = it.id === itemId
                  return (
                    <button key={it.id} onClick={() => setItemId(it.id)} aria-pressed={on}
                      style={{ textAlign: 'left', padding: 0, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', fontFamily: 'inherit', background: CARD, border: `1px solid ${on ? ORANGE : BORDER}` }}>
                      {it.cover ? <img src={it.cover} alt="" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block' }} />
                        : <div style={{ width: '100%', aspectRatio: '4 / 3', background: 'rgba(255,255,255,0.04)' }} />}
                      <div style={{ padding: '8px 10px' }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: on ? ORANGE : 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{on ? '✓ ' : ''}{it.title}</div>
                        <div style={{ fontSize: '11px', color: MUTED }}>{tx.photos(it.photos)}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

        {itemId && (
          <>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '10px' }}>{tx.mode}</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
              <button onClick={() => setMode('tour')} aria-pressed={mode === 'tour'} style={chip(mode === 'tour')}>{tx.tour}</button>
              <button onClick={() => setMode('staging')} aria-pressed={mode === 'staging'} style={chip(mode === 'staging')}>{tx.staging}</button>
            </div>
            {mode === 'tour'
              ? <TourBuilder key={itemId} itemId={itemId} />
              : <div style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.55, padding: '14px', border: `1px dashed ${BORDER}`, borderRadius: '12px' }}>{tx.stagingSoon}</div>}
          </>
        )}
      </div>
    </div>
  )
}
