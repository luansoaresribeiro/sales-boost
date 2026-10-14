import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, D, SUPABASE_URL } from './shared'

// Agente de Dados → "Lugares perto" (etapa 1, pedido do dono 2026-10-14).
// O que tem em volta de cada imóvel, buscado de graça no OpenStreetMap pelo
// `nearby-places` e guardado no item (meta.nearby). A distância é calculada
// em linha reta — nunca escrita pela IA. O dono esconde o que não quer ver
// nos posts; o "3 coisas perto" do calendário usa só o que ficou visível.

const TX = {
  pt: {
    intro: 'O que tem perto de cada imóvel — praia, metrô, escola, mercado. Os posts "3 coisas perto" usam só os lugares daqui, com o nome e a distância de verdade.',
    pick: 'Imóvel', none: 'Cadastre um imóvel com bairro primeiro (aba ao lado).', loading: 'Buscando no mapa...',
    again: '🔄 Buscar de novo', hide: 'Esconder', show: 'Mostrar', hidden: 'escondido',
    precise: (r: string) => `Distância em linha reta a partir do endereço do imóvel (até ${r}).`,
    area: 'Sem endereço: busquei a partir do centro do bairro, então os posts não citam distância. Preencha "Endereço" no imóvel (botão Ver fotos e editar) pra ficar exato — o endereço nunca aparece nos posts.',
    empty: 'Nada encontrado nesse raio.', inBairro: 'no bairro', fetched: (d: string) => `Buscado em ${d}`,
    credit: 'Dados © colaboradores do OpenStreetMap', errSave: 'Não consegui salvar. Tente de novo.',
  },
  en: {
    intro: 'What is near each property — beach, subway, school, grocery. "3 things nearby" posts only use the places here, with real names and distances.',
    pick: 'Property', none: 'Add a property with a neighborhood first (tab beside).', loading: 'Searching the map...',
    again: '🔄 Search again', hide: 'Hide', show: 'Show', hidden: 'hidden',
    precise: (r: string) => `Straight-line distance from the property address (up to ${r}).`,
    area: 'No address: searched from the neighborhood center, so posts do not mention distance. Fill in "Address" on the property (See photos and edit) for exact results — the address never shows in posts.',
    empty: 'Nothing found in this radius.', inBairro: 'in the area', fetched: (d: string) => `Searched on ${d}`,
    credit: 'Data © OpenStreetMap contributors', errSave: "Couldn't save. Please try again.",
  },
} as const

interface Place { cat: string; name: string; distance_m: number; osm: string; hidden?: boolean }
interface Nearby { fetched_at: string; precision: 'endereco' | 'bairro'; places: Place[]; error?: string }
interface Category { key: string; label: string; emoji: string }
interface Item { id: string; title: string }

function fmt(m: number): string {
  return m < 1000 ? `${Math.max(50, Math.round(m / 50) * 50)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`
}

export default function NearbyPlaces({ companyId }: { companyId: string }) {
  const { lang } = useLang()
  const tx = TX[lang]
  const { session } = useAuth()
  const [items, setItems] = useState<Item[] | null>(null)
  const [itemId, setItemId] = useState('')
  const [data, setData] = useState<{ nearby: Nearby; categories: Category[]; radius_m: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('marketing_ai_knowledge').select('id, title').eq('company_id', companyId).eq('kind', 'product').order('created_at', { ascending: false })
      .then(({ data: rows }) => { const list = (rows ?? []) as Item[]; setItems(list); if (list[0]) setItemId(id => id || list[0].id) })
  }, [companyId])

  const load = useCallback(async (refresh = false) => {
    if (!session || !itemId) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/nearby-places`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, refresh }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) setData(body); else { setData(null); setErr(body.error ?? 'Erro') }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
    setBusy(false)
  }, [session, itemId])
  useEffect(() => { setData(null); load(false) }, [load])

  // Esconder/mostrar: relê a meta antes de gravar (não apaga edição feita no meio).
  const toggle = async (osm: string) => {
    if (!data) return
    const { data: row } = await supabase.from('marketing_ai_knowledge').select('meta').eq('id', itemId).maybeSingle()
    const meta = (row?.meta ?? {}) as { nearby?: Nearby }
    if (!meta.nearby) return
    const places = meta.nearby.places.map(p => p.osm === osm ? { ...p, hidden: !p.hidden } : p)
    const { error } = await supabase.from('marketing_ai_knowledge').update({ meta: { ...meta, nearby: { ...meta.nearby, places } } }).eq('id', itemId)
    if (error) { setErr(tx.errSave); return }
    setData({ ...data, nearby: { ...data.nearby, places } })
  }

  if (items === null) return null
  if (!items.length) return <div style={{ fontSize: '13px', color: MUTED }}>{tx.none}</div>
  const nb = data?.nearby
  const precise = nb?.precision === 'endereco'
  return (
    <div style={{ maxWidth: '760px' }}>
      <div style={{ fontSize: '12px', color: MUTED, marginBottom: '14px', lineHeight: 1.55 }}>{tx.intro}</div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
        <label style={{ fontSize: '12px', color: MUTED }}>{tx.pick}</label>
        <select value={itemId} onChange={e => setItemId(e.target.value)} style={{ flex: '1 1 220px', minWidth: 0, background: CARD, color: '#fff', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '8px 10px', fontSize: '13px' }}>
          {items.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
        </select>
        <button onClick={() => load(true)} disabled={busy} style={{ background: 'transparent', color: '#fff', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '8px 12px', fontSize: '12px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}>{tx.again}</button>
      </div>
      {busy && <div style={{ fontSize: '13px', color: MUTED }}>{tx.loading}</div>}
      {err && !busy && <div style={{ fontSize: '13px', color: '#ff8a65' }}>{err}</div>}
      {nb && !busy && (
        <>
          {nb.error ? <div style={{ fontSize: '13px', color: '#ff8a65', marginBottom: '10px' }}>{nb.error}</div> : (
            <div style={{ fontSize: '12px', color: precise ? MUTED : '#ffcc80', marginBottom: '12px', lineHeight: 1.5 }}>{precise ? tx.precise(fmt(data!.radius_m)) : tx.area}</div>
          )}
          {!nb.error && !nb.places.length && <div style={{ fontSize: '13px', color: MUTED }}>{tx.empty}</div>}
          <div style={{ display: 'grid', gap: '10px' }}>
            {data!.categories.map(c => {
              const list = nb.places.filter(p => p.cat === c.key)
              if (!list.length) return null
              return (
                <div key={c.key} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '12px 14px' }}>
                  <div style={{ fontFamily: D, fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>{c.emoji} {c.label}</div>
                  {list.map(p => (
                    <div key={p.osm} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0', borderTop: `1px solid ${BORDER}`, opacity: p.hidden ? 0.45 : 1 }}>
                      <div style={{ flex: 1, minWidth: 0, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}{p.hidden ? ` · ${tx.hidden}` : ''}</div>
                      <div style={{ fontSize: '12px', color: MUTED, whiteSpace: 'nowrap' }}>{precise ? fmt(p.distance_m) : tx.inBairro}</div>
                      <button onClick={() => toggle(p.osm)} style={{ background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}>{p.hidden ? tx.show : tx.hide}</button>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: '11px', color: MUTED, marginTop: '12px' }}>
            {tx.fetched(new Date(nb.fetched_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR'))} · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{ color: MUTED }}>{tx.credit}</a>
          </div>
        </>
      )}
    </div>
  )
}
