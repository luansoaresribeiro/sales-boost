import type { JSX } from 'react'

// Motor de formatos — cada template é um layout HTML/CSS real (não foto de IA).
// O FormatStudio renderiza um destes em tamanho cheio e exporta como PNG.
// Adicionar um formato novo = adicionar um item aqui (campos + função render).

export interface Brand { primary: string; name: string; primary2?: string; accent?: string; accent2?: string; text?: string; bg?: string; logoUrl?: string; heading?: string; body?: string }
export interface FieldDef { key: string; label: string; type?: 'text' | 'textarea'; placeholder?: string }
export interface Template {
  key: string
  label: string
  icon: string
  w: number
  h: number
  fields: FieldDef[]
  sample: Record<string, string>
  render: (f: Record<string, string>, brand: Brand) => JSX.Element
}

const FONT = "'Bricolage Grotesque', system-ui, sans-serif"
const initials = (name: string) => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
// Fonte da marca (título) quando definida no Kit, com fallback.
const bfont = (b: Brand) => b.heading ? `'${b.heading}', ${FONT}` : FONT
// Logo da marca no canto (quando existe no Kit).
function Logo({ b, dark }: { b: Brand; dark?: boolean }) {
  if (!b.logoUrl) return null
  return <img src={b.logoUrl} crossOrigin="anonymous" alt="" style={{ position: 'absolute', bottom: '54px', right: '64px', height: '58px', maxWidth: '220px', objectFit: 'contain', opacity: dark ? 0.9 : 1 }} />
}

// ── Print de Tweet ──────────────────────────────────────────────────────────
function tweet(f: Record<string, string>, brand: Brand): JSX.Element {
  const dark = (f.theme || 'dark') === 'dark'
  const bg = dark ? '#15202b' : '#ffffff'
  const fg = dark ? '#e7e9ea' : '#0f1419'
  const muted = dark ? '#8b98a5' : '#536471'
  const line = dark ? '#38444d' : '#eff3f4'
  return (
    <div style={{ width: '100%', height: '100%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: bfont(brand) }}>
      <div style={{ width: '84%', background: bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
          {brand.logoUrl ? (
            <img src={brand.logoUrl} crossOrigin="anonymous" alt="" style={{ width: '92px', height: '92px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#fff' }} />
          ) : (
            <div style={{ width: '92px', height: '92px', borderRadius: '50%', background: brand.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '38px', fontWeight: 800, flexShrink: 0 }}>{initials(f.name)}</div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '34px', fontWeight: 800, color: fg }}>{f.name || 'Nome'}</span>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="#1d9bf0"><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"/></svg>
              <span style={{ fontSize: '30px', color: muted }}>@{f.handle || 'usuario'}</span>
            </div>
          </div>
        </div>
        <div style={{ fontSize: '44px', lineHeight: 1.35, color: fg, fontWeight: 500, marginBottom: '30px', whiteSpace: 'pre-wrap' }}>{f.text || 'O texto do tweet aparece aqui.'}</div>
        <div style={{ fontSize: '26px', color: muted, marginBottom: '24px' }}>{f.time || '14:22'} · {f.date || 'hoje'}</div>
        <div style={{ height: '1px', background: line, marginBottom: '24px' }} />
        <div style={{ display: 'flex', gap: '46px', fontSize: '28px', color: muted }}>
          <span><b style={{ color: fg }}>{f.retweets || '128'}</b> Retuítes</span>
          <span><b style={{ color: fg }}>{f.likes || '1.204'}</b> Curtidas</span>
        </div>
      </div>
    </div>
  )
}

// ── Foco no Produto ──────────────────────────────────────────────────────────
// Pôster: produto centralizado, sombra de "estúdio" atrás dele, nome/preço/
// chamada embaixo. Usa as fotos reais da aba Produtos (Estilos e Visuais).
function product(f: Record<string, string>, brand: Brand): JSX.Element {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: brand.bg || '#0E0B0A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 70px', boxSizing: 'border-box', fontFamily: bfont(brand), color: '#fff', textAlign: 'center' }}>
      <div style={{ position: 'relative', width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <div style={{ position: 'absolute', bottom: '6%', width: '58%', height: '48px', borderRadius: '50%', background: 'rgba(0,0,0,0.55)', filter: 'blur(24px)' }} />
        {f.productImage ? (
          <img src={f.productImage} crossOrigin="anonymous" alt="" style={{ position: 'relative', maxWidth: '78%', maxHeight: '100%', objectFit: 'contain', filter: 'drop-shadow(0 30px 34px rgba(0,0,0,0.5))' }} />
        ) : (
          <div style={{ position: 'relative', width: '60%', height: '70%', borderRadius: '18px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px' }}>📦</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>
        {f.name && <div style={{ fontSize: '52px', fontWeight: 800 }}>{f.name}</div>}
        {f.price && <div style={{ fontSize: '40px', fontWeight: 800, color: brand.primary, marginTop: '10px' }}>{f.price}</div>}
        {f.cta && <div style={{ display: 'inline-block', marginTop: '22px', background: brand.primary, color: '#000', fontSize: '30px', fontWeight: 800, padding: '14px 32px', borderRadius: '999px' }}>{f.cta} →</div>}
      </div>
      <Logo b={brand} />
    </div>
  )
}

// ── Post com Foto ───────────────────────────────────────────────────────────
// Camadas: fundo (asset/IA) + escurecimento + marca (texto/selo/logo).
function photo(f: Record<string, string>, brand: Brand): JSX.Element {
  const bg = f.background
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: brand.bg || '#0E0B0A', overflow: 'hidden', fontFamily: bfont(brand), color: '#fff' }}>
      {bg && <img src={bg} crossOrigin="anonymous" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.88))' }} />
      {brand.logoUrl && <img src={brand.logoUrl} crossOrigin="anonymous" alt="" style={{ position: 'absolute', top: '70px', right: '70px', height: '80px', maxWidth: '180px', objectFit: 'contain' }} />}
      <div style={{ position: 'absolute', left: '90px', right: '90px', bottom: '110px' }}>
        {f.eyebrow && <div style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: brand.primary, marginBottom: '16px' }}>{f.eyebrow}</div>}
        <div style={{ fontSize: '84px', lineHeight: 1.05, fontWeight: 800, marginBottom: '24px' }}>{f.headline || 'Sua chamada principal'}</div>
        {f.offer && <div style={{ display: 'inline-block', background: brand.accent || brand.primary, color: '#000', fontSize: '46px', fontWeight: 800, padding: '14px 34px', borderRadius: '18px', marginBottom: '20px' }}>{f.offer}</div>}
        {f.cta && <div style={{ fontSize: '32px', fontWeight: 800, background: '#fff', color: '#000', display: 'inline-block', padding: '14px 30px', borderRadius: '36px', marginTop: '6px' }}>{f.cta} →</div>}
      </div>
    </div>
  )
}


// REGRA (pedido do dono, 2026-09): "Gerar imagem de formato" só deve listar
// formato que o SELECIONADOR do gerador automático de post também conhece —
// nunca um formato "órfão" que só existe aqui manualmente. O outro lado
// dessa regra é creative-generate's TEMPLATE_DESC (chaves livre/tweet/
// product hoje — "livre" é o equivalente conceitual de "photo" aqui, ver
// FORMAT_CLASS em shared.ts). Tirando ou adicionando um formato aqui,
// espelhar lá também (e vice-versa) — não deixar os dois divergirem de novo
// (foi assim que "Estatística" ficou órfão por um tempo, e "Anúncio"/
// "Antes-Depois" foram descontinuados nos dois lugares).
export const TEMPLATES: Template[] = [
  {
    key: 'tweet', label: 'Print de Tweet', icon: '🐦', w: 1080, h: 1080,
    fields: [
      { key: 'name', label: 'Nome' }, { key: 'handle', label: 'Usuário (@)' },
      { key: 'text', label: 'Texto do tweet', type: 'textarea' },
      { key: 'likes', label: 'Curtidas' }, { key: 'retweets', label: 'Retuítes' },
      { key: 'time', label: 'Hora' }, { key: 'date', label: 'Data' }, { key: 'theme', label: 'Tema (dark/light)' },
    ],
    sample: { name: '', handle: '', text: '', likes: '1.204', retweets: '128', time: '14:22', date: 'hoje', theme: 'dark' },
    render: tweet,
  },
  {
    key: 'product', label: 'Foco no Produto', icon: '📦', w: 1080, h: 1350,
    fields: [
      { key: 'productImage', label: 'Foto do produto' }, { key: 'name', label: 'Nome' },
      { key: 'price', label: 'Preço' }, { key: 'cta', label: 'Chamada pra ação' },
    ],
    sample: { productImage: '', name: '', price: '', cta: '' },
    render: product,
  },
  {
    key: 'photo', label: 'Post com Foto', icon: '🖼️', w: 1080, h: 1350,
    fields: [
      { key: 'eyebrow', label: 'Etiqueta (topo)' }, { key: 'headline', label: 'Chamada principal', type: 'textarea' },
      { key: 'offer', label: 'Oferta (destaque)' }, { key: 'cta', label: 'Chamada pra ação' },
    ],
    sample: { eyebrow: '', headline: '', offer: '', cta: '' },
    render: photo,
  },
]

export const templateByKey = (k: string) => TEMPLATES.find(t => t.key === k)
