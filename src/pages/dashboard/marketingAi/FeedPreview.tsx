import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER } from './shared'

const GOOD = 70

interface Row { id: string; image_url: string | null; planned_for: string | null; created_at: string; status: string; scores: { feed_fit?: { score: number; comment: string } } | null }

const TX = {
  pt: {
    title: '🔲 Prévia do feed', desc: 'Como o seu perfil vai ficar com as próximas peças (as mais novas em cima, como no Instagram). Cada peça ganha uma nota de "encaixe no padrão" — cores, fontes e clima do seu Kit da marca.',
    avg: (n: number, a: number) => `${n} de ${a} peças seguem o padrão`, none: 'Ainda não há peças com imagem no Vault ou no calendário.',
    noKit: 'Preencha o Kit da marca (aba Marca) pra o Sales Boost conseguir medir o padrão.', pending: 'sem nota ainda',
  },
  en: {
    title: '🔲 Feed preview', desc: 'How your profile will look with the next pieces (newest on top, like Instagram). Each piece gets a "fits the pattern" score — colors, fonts and mood from your Brand Kit.',
    avg: (n: number, a: number) => `${n} of ${a} pieces follow the pattern`, none: 'No pieces with an image in the Vault or calendar yet.',
    noKit: 'Fill in the Brand Kit (Brand tab) so Sales Boost can measure the pattern.', pending: 'no score yet',
  },
} as const

// Grade 3×3 com as próximas peças (Vault + calendário). A nota feed_fit vem
// do analista visual do content-test (mesma chamada que já checa a imagem).
export default function FeedPreview({ companyId }: { companyId: string }) {
  const tx = TX[useLang().lang]
  const [rows, setRows] = useState<Row[] | null>(null)
  const [hasKit, setHasKit] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('marketing_ai_test_content').select('id, image_url, planned_for, created_at, status, scores')
        .eq('company_id', companyId).in('status', ['vault', 'draft']).not('image_url', 'is', null)
        .order('planned_for', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }).limit(9),
      supabase.from('brand_dna').select('colors, design_notes').eq('company_id', companyId).maybeSingle(),
    ]).then(([{ data }, { data: kit }]) => {
      if (!alive) return
      // Instagram mostra o mais novo em cima: a peça que sai por último fica no topo.
      setRows(((data ?? []) as Row[]).reverse())
      setHasKit(!!kit && ((Array.isArray(kit.colors) && kit.colors.length > 0) || !!kit.design_notes))
    })
    return () => { alive = false }
  }, [companyId])

  if (!rows) return null
  const scored = rows.filter(r => typeof r.scores?.feed_fit?.score === 'number')
  const good = scored.filter(r => (r.scores!.feed_fit!.score) >= GOOD).length

  return (
    <div>
      <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>{tx.title}</div>
      <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55, maxWidth: '720px', marginBottom: '10px' }}>{tx.desc}</div>
      {!hasKit && <div style={{ fontSize: '11.5px', color: '#FBBF24', marginBottom: '10px' }}>{tx.noKit}</div>}
      {rows.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: MUTED, fontSize: '12px', background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '12px' }}>{tx.none}</div>
      ) : (
        <>
          {scored.length > 0 && <div style={{ fontSize: '12px', fontWeight: 700, color: good / scored.length >= 0.7 ? '#4ade80' : '#FBBF24', marginBottom: '10px' }}>{tx.avg(good, scored.length)}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px', maxWidth: '420px' }}>
            {rows.map(r => {
              const fit = r.scores?.feed_fit
              const bad = fit && fit.score < GOOD
              return (
                <div key={r.id} title={fit?.comment ?? tx.pending} style={{ position: 'relative', aspectRatio: '4 / 5', background: '#111', outline: bad ? '2px solid #FBBF24' : 'none', outlineOffset: '-2px' }}>
                  {r.image_url && <img src={r.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                  <span style={{ position: 'absolute', bottom: '4px', right: '4px', fontSize: '9.5px', fontWeight: 800, padding: '1px 5px', borderRadius: '99px', background: 'rgba(0,0,0,0.7)', color: !fit ? MUTED : bad ? '#FBBF24' : '#4ade80' }}>
                    {fit ? fit.score : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
