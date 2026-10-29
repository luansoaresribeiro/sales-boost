// Botão "Página pública" no card do imóvel (Etapa 5). Abre a prévia EXATA do que a página vai mostrar (campos da lista
// branca da ficha, fotos reais, WhatsApp/Instagram da empresa) e deixa o dono APROVAR e publicar — ou despublicar. A página
// é só destino de link (sem listagem, sem busca, noindex). Backend: marketing-ai → get_public_page / set_public_page.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useLang } from '../../../contexts/LanguageContext'
import { useShowcase } from '../../../contexts/ShowcaseContext'
import { CARD, MUTED, BORDER, ORANGE, D, SUPABASE_URL } from './shared'

interface State {
  enabled: boolean; link: string | null; title: string; min_photos: number; photos_count: number; photos: string[]
  fields: { key: string; label: string; value: string }[]; contact: { phone: string | null; ig: string | null }
}

const TX = {
  pt: {
    open: '🌐 Página pública', lock: '🔒 Página pública', title: 'Página pública do imóvel', close: 'Fechar',
    intro: 'Uma página simples para o link que você põe no post, na DM ou na bio: fotos, dados e botões de contato. Ela não aparece em buscas nem em lista — só quem recebe o link chega nela.',
    preview: 'O que vai aparecer na página', noFields: 'Nenhum dado cadastrado para mostrar.', photos: (n: number) => `${n} foto${n === 1 ? '' : 's'} real${n === 1 ? '' : 'is'} (até 10 aparecem)`,
    contacts: 'Contatos que vão aparecer', whatsapp: 'WhatsApp', ig: 'Instagram (mensagem direta)', none: 'não cadastrado — o botão não aparece',
    contactsHelp: 'Vêm do cadastro da empresa em Configurações. A cópia é feita na hora de aprovar.',
    warn: 'Ao publicar, qualquer pessoa com o link vê estas informações. Quem preencher o formulário vira lead no seu funil, com a origem deste imóvel — nada é enviado a essa pessoa automaticamente.',
    needPhotos: (min: number, n: number) => `Precisa de pelo menos ${min} fotos reais para publicar (tem ${n}).`,
    approve: 'Aprovar e publicar', unpublish: 'Despublicar', working: 'Aguarde…', live: '✅ No ar', off: 'Fora do ar',
    link: 'Link da página', copy: 'Copiar', copied: 'Copiado!', err: 'Algo deu errado. Tente de novo em alguns minutos.', loading: 'Carregando…',
  },
  en: {
    open: '🌐 Public page', lock: '🔒 Public page', title: 'Public property page', close: 'Close',
    intro: 'A simple page for the link you put in a post, a DM or your bio: photos, details and contact buttons. It does not show up in searches or lists — only people who get the link reach it.',
    preview: 'What will appear on the page', noFields: 'No registered details to show.', photos: (n: number) => `${n} real photo${n === 1 ? '' : 's'} (up to 10 are shown)`,
    contacts: 'Contacts that will appear', whatsapp: 'WhatsApp', ig: 'Instagram (direct message)', none: 'not set — the button will not appear',
    contactsHelp: 'They come from your company details in Settings. The copy is made when you approve.',
    warn: 'Once published, anyone with the link sees this information. Whoever fills in the form becomes a lead in your funnel, tagged with this property — nothing is sent to that person automatically.',
    needPhotos: (min: number, n: number) => `You need at least ${min} real photos to publish (you have ${n}).`,
    approve: 'Approve and publish', unpublish: 'Unpublish', working: 'Please wait…', live: '✅ Live', off: 'Offline',
    link: 'Page link', copy: 'Copy', copied: 'Copied!', err: 'Something went wrong. Try again in a few minutes.', loading: 'Loading…',
  },
} as const

async function call(body: Record<string, unknown>): Promise<{ status: number; data: Record<string, unknown> }> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/marketing-ai`, {
    method: 'POST', headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

function Panel({ itemId, onClose, onChanged }: { itemId: string; onClose: () => void; onChanged: (enabled: boolean) => void }) {
  const tx = TX[useLang().lang]
  const [st, setSt] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const { status, data } = await call({ action: 'get_public_page', item_id: itemId })
    if (status >= 400) { setMsg(String(data.error ?? tx.err)); return }
    setSt(data as unknown as State); onChanged((data as unknown as State).enabled)
  }, [itemId, tx.err, onChanged])
  useEffect(() => { void load() }, [load])

  const toggle = async (enabled: boolean) => {
    setBusy(true); setMsg('')
    const { status, data } = await call({ action: 'set_public_page', item_id: itemId, enabled })
    setBusy(false)
    if (status >= 400) { setMsg(String(data.error ?? tx.err)); return }
    await load()
  }
  const copy = async () => { if (st?.link) { try { await navigator.clipboard.writeText(st.link); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* sem permissão: o campo continua selecionável */ } } }

  const head = { fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '16px 0 6px' } as const
  const canPublish = !!st && st.photos_count >= st.min_photos

  return (
    <div role="dialog" aria-modal="true" onClick={e => { e.stopPropagation(); onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: '560px', background: CARD, border: '1px solid rgba(255,109,41,0.35)', borderRadius: '16px', padding: '20px', fontFamily: D, margin: '24px 0' }}>
        <button onClick={onClose} aria-label={tx.close} style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.06)', color: MUTED, cursor: 'pointer' }}>✕</button>
        <div style={{ fontSize: '17px', fontWeight: 800, color: 'white', marginBottom: '6px', paddingRight: '36px' }}>{tx.title}</div>
        <p style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.55, margin: '0 0 8px' }}>{tx.intro}</p>
        {msg && <p style={{ fontSize: '12.5px', color: '#f87171', margin: '0 0 10px' }}>{msg}</p>}
        {!st ? (!msg && <p style={{ fontSize: '12.5px', color: MUTED }}>{tx.loading}</p>) : (<>
          <div style={{ fontSize: '12.5px', fontWeight: 700, color: st.enabled ? '#4ade80' : MUTED }}>{st.enabled ? tx.live : tx.off}</div>

          <div style={head}>{tx.preview}</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '6px' }}>{st.title}</div>
          {st.photos.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
              {st.photos.map(u => <img key={u} src={u} alt="" style={{ width: '64px', aspectRatio: '4 / 5', objectFit: 'cover', borderRadius: '6px' }} />)}
            </div>
          )}
          <div style={{ fontSize: '11.5px', color: canPublish ? MUTED : '#f87171', marginBottom: '8px' }}>{tx.photos(st.photos_count)}</div>
          {st.fields.length === 0 ? <div style={{ fontSize: '12px', color: MUTED }}>{tx.noFields}</div> : (
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '2px 12px' }}>
              {st.fields.map((f, i) => (
                <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '7px 0', borderTop: i ? `1px solid ${BORDER}` : 'none', fontSize: '12.5px' }}>
                  <span style={{ color: MUTED }}>{f.label}</span><span style={{ color: 'white', textAlign: 'right', overflowWrap: 'anywhere' }}>{f.value}</span>
                </div>
              ))}
            </div>
          )}

          <div style={head}>{tx.contacts}</div>
          <div style={{ fontSize: '12.5px', color: 'white', lineHeight: 1.7 }}>
            <div>{tx.whatsapp}: <strong>{st.contact.phone ?? <span style={{ color: '#FBBF24', fontWeight: 400 }}>{tx.none}</span>}</strong></div>
            <div>{tx.ig}: <strong>{st.contact.ig ? `@${st.contact.ig}` : <span style={{ color: '#FBBF24', fontWeight: 400 }}>{tx.none}</span>}</strong></div>
          </div>
          <p style={{ fontSize: '11.5px', color: MUTED, margin: '4px 0 0' }}>{tx.contactsHelp}</p>

          <p style={{ fontSize: '12px', color: '#FBBF24', lineHeight: 1.55, margin: '14px 0 10px', padding: '9px 11px', border: '1px solid rgba(251,191,36,0.35)', borderRadius: '9px' }}>{tx.warn}</p>
          {!canPublish && !st.enabled && <p style={{ fontSize: '12px', color: '#f87171', margin: '0 0 10px' }}>{tx.needPhotos(st.min_photos, st.photos_count)}</p>}

          {st.enabled && st.link && (
            <>
              <div style={head}>{tx.link}</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input readOnly value={st.link} onFocus={e => e.currentTarget.select()} style={{ flex: 1, minWidth: 0, padding: '9px 10px', background: '#0E0B0A', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '12.5px', fontFamily: D }} />
                <button onClick={copy} style={{ padding: '9px 14px', background: 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.5)', borderRadius: '8px', color: ORANGE, fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: D }}>{copied ? tx.copied : tx.copy}</button>
              </div>
            </>
          )}

          <div style={{ marginTop: '14px' }}>
            {st.enabled ? (
              <button onClick={() => toggle(false)} disabled={busy} style={{ padding: '11px 16px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '10px', color: '#f87171', fontWeight: 800, fontSize: '13px', cursor: busy ? 'wait' : 'pointer', fontFamily: D }}>{busy ? tx.working : tx.unpublish}</button>
            ) : (
              <button onClick={() => toggle(true)} disabled={busy || !canPublish} style={{ padding: '11px 16px', background: canPublish ? ORANGE : 'rgba(255,255,255,0.08)', color: canPublish ? '#000' : MUTED, fontWeight: 800, fontSize: '13px', border: 'none', borderRadius: '10px', cursor: busy ? 'wait' : canPublish ? 'pointer' : 'not-allowed', fontFamily: D }}>{busy ? tx.working : tx.approve}</button>
            )}
          </div>
        </>)}
      </div>
    </div>
  )
}

export default function PublicPageButton({ itemId }: { itemId: string }) {
  const tx = TX[useLang().lang]
  const { readOnly, openPlanModal } = useShowcase()
  const [open, setOpen] = useState(false)
  const [live, setLive] = useState(false)
  const onChanged = useCallback((enabled: boolean) => setLive(enabled), [])
  return (
    <>
      <button onClick={() => (readOnly ? openPlanModal() : setOpen(true))}
        style={{ width: '100%', padding: '7px 10px', marginTop: '6px', background: 'transparent', border: `1px solid ${live ? 'rgba(74,222,128,0.5)' : BORDER}`, borderRadius: '7px', color: live ? '#4ade80' : 'white', fontWeight: 700, fontSize: '11px', cursor: 'pointer', fontFamily: D }}>
        {readOnly ? tx.lock : live ? `${tx.open} · ${tx.live}` : tx.open}
      </button>
      {open && <Panel itemId={itemId} onClose={() => setOpen(false)} onChanged={onChanged} />}
    </>
  )
}
