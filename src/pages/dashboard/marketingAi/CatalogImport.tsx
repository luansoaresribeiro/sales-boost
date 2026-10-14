import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { useLang } from '../../../contexts/LanguageContext'
import { processImageTo4x5 } from '../../../lib/imageProcessing'
import { MAX_PHOTOS_PER_ITEM } from '../../../lib/setupRules'
import { sanitizeCatalogValues, titleFromFields, type CatalogSchema, type CatalogImportMap } from '../../../lib/verticalPlaybook'
import { CARD, MUTED, BORDER, D, inputStyle, SUPABASE_URL } from './shared'

const ORANGE = '#FF6D29'

// Mesmo formato que o portal-import devolve (campos neutros).
interface Listing {
  id: string; title: string; transaction: 'sale' | 'rent' | null; property_type: string
  price: number | null; area: number | null; bedrooms: number | null; bathrooms: number | null
  parking: number | null; hoa: number | null; tax: number | null
  neighborhood: string; city: string; description: string; photos: string[]
}

const TX = {
  pt: {
    open: '📥 Importar do portal (ZAP/VivaReal)',
    title: 'Importar seus anúncios do portal',
    help: 'O sistema de imóveis que você usa (o seu CRM) gera um link de XML que manda os anúncios pro ZAP/VivaReal. Cole esse link aqui — o Sales Boost lê os anúncios com as fotos reais. Não tem custo. Se não souber onde achar, peça ao suporte do seu CRM o "link do XML de integração com portais".',
    ph: 'https://…/seu-feed.xml', read: 'Ler anúncios', reading: 'Lendo...',
    found: (n: number) => `${n} anúncio(s) encontrados. Escolha quais trazer:`,
    already: 'já importado', photos: (n: number) => `${n} foto(s)`, all: 'Marcar todos', none: 'Desmarcar',
    import: (n: number) => `Importar ${n}`, importing: (a: number, b: number) => `Importando ${a} de ${b}...`,
    done: (n: number) => `✅ ${n} imóvel(is) importado(s). Confira os dados de cada um — o que o anúncio não trazia ficou em branco.`,
    close: 'Fechar', planRequired: 'Importar anúncios faz parte do plano. Escolha um plano pra usar.',
    errGeneric: 'Não consegui ler esse link.', noPhotos: 'sem foto — não dá pra importar', few: 'menos de 5 fotos — complete depois pra virar conteúdo',
  },
  en: {
    open: '📥 Import from listing portal',
    title: 'Import your listings from the portal',
    help: 'The real estate system you use (your CRM) creates an XML link that sends your listings to the portals (ZAP/VivaReal). Paste that link here — Sales Boost reads the listings with their real photos. No cost. If you don\'t know where to find it, ask your CRM support for the "portal integration XML link".',
    ph: 'https://…/your-feed.xml', read: 'Read listings', reading: 'Reading...',
    found: (n: number) => `${n} listing(s) found. Choose which to bring in:`,
    already: 'already imported', photos: (n: number) => `${n} photo(s)`, all: 'Select all', none: 'Clear',
    import: (n: number) => `Import ${n}`, importing: (a: number, b: number) => `Importing ${a} of ${b}...`,
    done: (n: number) => `✅ ${n} listing(s) imported. Check each one's details — anything the listing didn't have was left blank.`,
    close: 'Close', planRequired: 'Importing listings is part of the plan. Choose a plan to use it.',
    errGeneric: "Couldn't read that link.", noPhotos: 'no photos — cannot import', few: 'fewer than 5 photos — add more later to turn it into content',
  },
} as const

// Traduz o anúncio pros campos do catálogo usando SÓ o mapa da ficha
// (config.catalog_import) — nada de setor aqui. Campo sem valor no anúncio
// fica de fora (nunca inventa número).
function mapListing(l: Listing, map: CatalogImportMap, schema: CatalogSchema): Record<string, unknown> {
  const src = l as unknown as Record<string, unknown>
  const raw: Record<string, unknown> = {}
  for (const [field, from] of Object.entries(map.fields ?? {})) {
    const v = src[from]
    if (v !== null && v !== undefined && String(v).trim() !== '') raw[field] = v
  }
  for (const [field, rule] of Object.entries(map.select ?? {})) {
    const v = String(src[rule.from] ?? '').toLowerCase()
    if (!v) continue
    const hit = (rule.match ?? []).find(([needle]) => v.includes(String(needle).toLowerCase()))
    if (hit) raw[field] = hit[1]
  }
  return sanitizeCatalogValues(raw, schema)
}

export default function CatalogImport({ companyId, schema, onImported }: { companyId: string; schema: CatalogSchema; onImported: () => void }) {
  const tx = TX[useLang().lang]
  const { session } = useAuth()
  const token = session?.access_token ?? ''
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [reading, setReading] = useState(false)
  const [err, setErr] = useState('')
  const [listings, setListings] = useState<Listing[]>([])
  const [imported, setImported] = useState<Set<string>>(new Set())
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<{ a: number; b: number } | null>(null)
  const [doneN, setDoneN] = useState<number | null>(null)

  // Link salvo da última vez + quais anúncios já viraram item.
  useEffect(() => {
    if (!open) return
    let alive = true
    Promise.all([
      supabase.from('company_integrations').select('metadata').eq('company_id', companyId).eq('type', 'portal_feed').maybeSingle(),
      supabase.from('marketing_ai_knowledge').select('meta').eq('company_id', companyId).eq('kind', 'product'),
    ]).then(([{ data: integ }, { data: rows }]) => {
      if (!alive) return
      const saved = (integ?.metadata as { feed_url?: string } | null)?.feed_url
      if (saved) setUrl(u => u || saved)
      const ids = new Set<string>()
      for (const r of (rows ?? []) as { meta: { source?: { listing_id?: string } } | null }[]) if (r.meta?.source?.listing_id) ids.add(r.meta.source.listing_id)
      setImported(ids)
    })
    return () => { alive = false }
  }, [open, companyId])

  const call = async (body: Record<string, unknown>) => fetch(`${SUPABASE_URL}/functions/v1/portal-import`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  const read = async () => {
    setReading(true); setErr(''); setListings([]); setDoneN(null)
    try {
      const res = await call({ action: 'preview', feed_url: url.trim() })
      const r = await res.json().catch(() => ({})) as { error?: string; code?: string; listings?: Listing[] }
      if (res.status === 402 || r.code === 'plan_required') throw new Error(tx.planRequired)
      if (!res.ok) throw new Error(r.error ?? tx.errGeneric)
      const list = r.listings ?? []
      setListings(list)
      setPicked(new Set(list.filter(l => l.photos.length > 0 && !imported.has(l.id)).map(l => l.id)))
    } catch (e) { setErr(e instanceof Error ? e.message : tx.errGeneric) }
    setReading(false)
  }

  const importPicked = async () => {
    const chosen = listings.filter(l => picked.has(l.id) && l.photos.length > 0)
    if (!chosen.length || !schema.importMap) return
    setErr(''); let ok = 0
    for (const [i, l] of chosen.entries()) {
      setProgress({ a: i + 1, b: chosen.length })
      const photos: { url: string; path: string }[] = []
      for (const src of l.photos.slice(0, MAX_PHOTOS_PER_ITEM)) {
        try {
          const res = await call({ action: 'photo', url: src })
          if (!res.ok) continue
          const blob = await processImageTo4x5(new File([await res.blob()], 'foto.jpg'))
          const path = `renders/${companyId}/catalog-${crypto.randomUUID()}.jpg`
          const { error } = await supabase.storage.from('post-images').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
          if (!error) photos.push({ url: supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl, path })
        } catch { /* foto quebrada no anúncio: segue com as outras */ }
      }
      if (!photos.length) continue
      const fields = mapListing(l, schema.importMap, schema)
      const { error } = await supabase.from('marketing_ai_knowledge').insert({
        company_id: companyId, module: 'visual', kind: 'product',
        title: titleFromFields(fields, l.title || schema.itemLabel),
        image_url: photos[0].url,
        meta: { photos, fields, source: { portal: schema.importMap.source, listing_id: l.id, title: l.title, imported_at: new Date().toISOString() } },
      })
      if (!error) { ok++; setImported(s => new Set(s).add(l.id)) }
    }
    setProgress(null); setDoneN(ok); setPicked(new Set())
    onImported()
  }

  const toggle = (id: string) => setPicked(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const money = (n: number | null) => n ? `R$ ${n.toLocaleString('pt-BR')}` : ''

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ padding: '9px 16px', background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.4)', color: ORANGE, fontWeight: 700, fontSize: '12.5px', borderRadius: '9px', cursor: 'pointer', fontFamily: D }}>
        {tx.open}
      </button>
    )
  }

  return (
    <div style={{ width: '100%', padding: '16px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'white' }}>{tx.title}</div>
        <button onClick={() => setOpen(false)} disabled={!!progress} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: '12px', fontFamily: D }}>{tx.close}</button>
      </div>
      <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55, marginBottom: '10px', maxWidth: '720px' }}>{tx.help}</div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder={tx.ph} style={{ ...inputStyle, flex: '1 1 260px', minWidth: 0 }} />
        <button onClick={read} disabled={reading || !url.trim() || !!progress} style={{ padding: '9px 16px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontFamily: D, opacity: reading ? 0.7 : 1 }}>
          {reading ? tx.reading : tx.read}
        </button>
      </div>
      {err && <div style={{ color: '#f87171', fontSize: '11.5px', marginBottom: '10px' }}>{err}</div>}
      {doneN !== null && <div style={{ color: '#4ade80', fontSize: '11.5px', marginBottom: '10px' }}>{tx.done(doneN)}</div>}

      {listings.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span style={{ fontSize: '11.5px', color: 'white' }}>{tx.found(listings.length)}</span>
            <button onClick={() => setPicked(new Set(listings.filter(l => l.photos.length && !imported.has(l.id)).map(l => l.id)))} style={linkBtn}>{tx.all}</button>
            <button onClick={() => setPicked(new Set())} style={linkBtn}>{tx.none}</button>
          </div>
          <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            {listings.map(l => {
              const disabled = !l.photos.length || !!progress
              return (
                <label key={l.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: '9px', cursor: disabled ? 'default' : 'pointer', opacity: l.photos.length ? 1 : 0.5 }}>
                  <input type="checkbox" checked={picked.has(l.id)} disabled={disabled} onChange={() => toggle(l.id)} />
                  {l.photos[0] && <img src={l.photos[0]} alt="" style={{ width: '44px', height: '55px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title || l.id}</div>
                    <div style={{ fontSize: '10.5px', color: MUTED }}>
                      {[l.neighborhood, money(l.price), l.photos.length ? tx.photos(l.photos.length) : tx.noPhotos].filter(Boolean).join(' · ')}
                      {imported.has(l.id) && <span style={{ color: '#A78BFA', fontWeight: 700 }}> · {tx.already}</span>}
                      {l.photos.length > 0 && l.photos.length < 5 && <span style={{ color: '#FBBF24' }}> · {tx.few}</span>}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
          <button onClick={importPicked} disabled={!picked.size || !!progress} style={{ padding: '9px 18px', background: picked.size ? ORANGE : 'rgba(255,255,255,0.08)', color: picked.size ? '#000' : MUTED, fontWeight: 700, fontSize: '12.5px', borderRadius: '9px', border: 'none', cursor: picked.size ? 'pointer' : 'default', fontFamily: D }}>
            {progress ? tx.importing(progress.a, progress.b) : tx.import(picked.size)}
          </button>
        </>
      )}
    </div>
  )
}

const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: ORANGE, fontWeight: 700, fontSize: '11.5px', cursor: 'pointer', padding: 0, fontFamily: D }
