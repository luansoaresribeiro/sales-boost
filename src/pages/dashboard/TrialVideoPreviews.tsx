// Prévias de vídeo do trial (passo 3, parte A). Só leitura: mostra o "vídeo
// grátis em breve" e até 3 prévias travadas feitas com foto REAL do cliente
// (borrada). Nunca chama API de vídeo, nunca mostra preço nem número estimado.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { CARD, MUTED, BORDER, ORANGE, D } from './marketingAi/shared'

interface Props { companyId: string; verticalKey: string | null }
interface Preview { id: string; title: string; photo: string; format: string | null }
interface Loaded { previews: Preview[]; hasPhotos: boolean; objective: string | null; hasIdeasOrStrategy: boolean }

const humanize = (s: string) => s.replace(/[_-]+/g, ' ').trim()

export default function TrialVideoPreviews({ companyId, verticalKey }: Props) {
  const navigate = useNavigate()
  const [data, setData] = useState<Loaded | null>(null)
  const [notice, setNotice] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [{ data: items }, { data: ideas }, { data: strat }, { data: ficha }] = await Promise.all([
        supabase.from('marketing_ai_knowledge').select('id, title, image_url, meta').eq('company_id', companyId).eq('module', 'visual').eq('kind', 'product').order('created_at', { ascending: false }).limit(20),
        supabase.from('marketing_ai_ideas').select('id, title, format').eq('company_id', companyId).neq('status', 'dismissed').order('created_at', { ascending: false }).limit(10),
        supabase.from('marketing_ai_strategies').select('strategic_opportunity, thesis').eq('company_id', companyId).eq('kind', 'main').eq('status', 'active').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        verticalKey ? supabase.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle() : Promise.resolve({ data: null }),
      ])
      if (!alive) return
      const photos: string[] = []
      for (const it of (items ?? []) as { image_url: string | null; meta: { photos?: { url?: string }[] } | null }[]) {
        const u = it.meta?.photos?.[0]?.url || it.image_url
        if (u) photos.push(u)
      }
      // Receita da ficha (genérica): primeira receita de etapa_b de qualquer pilar.
      let recipe: string | null = null
      const recipes = (ficha?.config as { production_recipes?: Record<string, { etapa_b?: { recipes?: string[] } }> } | null)?.production_recipes
      for (const k of Object.keys(recipes ?? {})) {
        const r = recipes?.[k]?.etapa_b?.recipes?.[0]
        if (r) { recipe = humanize(r); break }
      }
      const objective = (strat?.strategic_opportunity as string | null) || (strat?.thesis as string | null) || null
      const list = (ideas ?? []) as { id: string; title: string; format: string | null }[]
      // Ideias não têm foto própria: cada prévia usa uma foto real do catálogo (em rodízio).
      const previews: Preview[] = photos.length
        ? list.slice(0, 3).map((i, n) => ({ id: i.id, title: i.title, photo: photos[n % photos.length], format: i.format || recipe }))
        : []
      setData({ previews, hasPhotos: photos.length > 0, objective, hasIdeasOrStrategy: list.length > 0 || !!objective })
    })()
    return () => { alive = false }
  }, [companyId, verticalKey])

  if (!data) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: D }}>
      <div style={{ background: CARD, border: '1px solid rgba(255,109,41,0.3)', borderRadius: '14px', padding: '18px 20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', marginBottom: '6px' }}>🎬 Seu vídeo grátis — em breve</div>
        <div style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>
          Seu teste inclui 1 vídeo real, feito com as fotos do seu imóvel. Ele ainda não está disponível — avisamos quando estiver liberado.
        </div>
      </div>

      {!data.hasPhotos ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '18px 20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '10px' }}>Suba as fotos do seu imóvel pra ver suas prévias de vídeo</div>
          <button onClick={() => navigate('/dashboard/marketing-ai/dados')}
            style={{ padding: '10px 16px', background: ORANGE, color: '#000', fontWeight: 800, fontSize: '12.5px', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
            Subir fotos →
          </button>
        </div>
      ) : !data.hasIdeasOrStrategy || data.previews.length === 0 ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '18px 20px', fontSize: '13px', color: MUTED }}>
          Hermes ainda está analisando
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
            {data.previews.map(p => (
              <div key={p.id} onClick={() => setNotice(true)} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', minWidth: 0 }}>
                <div style={{ position: 'relative', aspectRatio: '4 / 3', overflow: 'hidden', background: '#000' }}>
                  <img src={p.photo} alt="" draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(14px)', transform: 'scale(1.2)', pointerEvents: 'none', userSelect: 'none' }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px' }}>🔒</div>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'white', lineHeight: 1.35, wordBreak: 'break-word' }}>{p.title}</div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: ORANGE, marginTop: '6px' }}>Recomendado pelo Hermes · pronto pra gerar</div>
                  {data.objective && <div style={{ fontSize: '10.5px', color: MUTED, marginTop: '6px', lineHeight: 1.4, wordBreak: 'break-word' }}>Objetivo: {data.objective}</div>}
                  {p.format && <div style={{ fontSize: '10.5px', color: MUTED, marginTop: '4px' }}>Formato: {p.format}</div>}
                </div>
              </div>
            ))}
          </div>
          {notice && <div style={{ fontSize: '12px', color: ORANGE, fontWeight: 700 }}>Disponível no plano completo.</div>}
        </>
      )}
    </div>
  )
}
