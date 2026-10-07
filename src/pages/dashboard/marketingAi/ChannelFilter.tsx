import { MUTED, BORDER, D } from './shared'
import { CHANNEL_META, type Channel } from './salesDemo'
import { useLang } from '../../../contexts/LanguageContext'

const ORANGE = '#FF6D29'
export type ChannelFilterValue = 'all' | Channel

// Seletor de canal [ Todos ] [ 📷 Instagram ] [ 💬 WhatsApp ] usado pelo Funil
// e pelo Atendimento. Filtra instantaneamente (estado local, sem reload).
export default function ChannelFilter({ value, onChange }: { value: ChannelFilterValue; onChange: (v: ChannelFilterValue) => void }) {
  const { lang } = useLang()
  const opts: { key: ChannelFilterValue; label: string }[] = [
    { key: 'all', label: lang === 'en' ? 'All' : 'Todos' },
    { key: 'instagram', label: `${CHANNEL_META.instagram.icon} ${CHANNEL_META.instagram.label}` },
    { key: 'whatsapp', label: `${CHANNEL_META.whatsapp.icon} ${CHANNEL_META.whatsapp.label}` },
  ]
  return (
    <div style={{ display: 'inline-flex', gap: '4px', padding: '3px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px' }}>
      {opts.map(o => {
        const on = value === o.key
        return (
          <button key={o.key} onClick={() => onChange(o.key)}
            style={{ padding: '6px 13px', background: on ? 'rgba(255,109,41,0.12)' : 'transparent', border: `1px solid ${on ? 'rgba(255,109,41,0.35)' : 'transparent'}`, borderRadius: '7px', cursor: 'pointer', fontFamily: D, fontSize: '11.5px', fontWeight: 700, color: on ? ORANGE : MUTED }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// Chip discreto de origem do cliente/conversa (📷 Instagram · 💬 WhatsApp).
export function ChannelBadge({ channel }: { channel: Channel }) {
  const m = CHANNEL_META[channel]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9.5px', fontWeight: 700, color: MUTED, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '99px', padding: '1px 7px' }}>
      <span style={{ fontSize: '10px' }}>{m.icon}</span>{m.label}
    </span>
  )
}
