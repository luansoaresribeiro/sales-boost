import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLang } from '../../contexts/LanguageContext'
import { d } from '../../i18n-dash'
import {
  CARD_GROUPS, CARD_ICONS, GROUP_ICONS, COMING_SOON_KEYS, titleFor, groupTitle,
  ModuleCard, useAgentCardPreviews, type CardKey, type GroupKey,
} from './agentCardShared'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const BORDER = 'rgba(255,255,255,0.06)'

export type PostStatus = 'rascunho' | 'aprovado' | 'publicado'

export interface Post {
  id: string
  content: string
  image_suggestion: string | null
  image_url: string | null
  best_time: string | null
  status: PostStatus
  platform: string | null
  created_at: string
  agent_notes: string | null
}

const STATUS_COLORS: Record<PostStatus, { bg: string; color: string; border: string }> = {
  rascunho: { bg: 'rgba(251,191,36,0.1)', color: '#FBBF24', border: 'rgba(251,191,36,0.25)' },
  aprovado: { bg: 'rgba(74,222,128,0.1)', color: '#4ade80', border: 'rgba(74,222,128,0.25)' },
  publicado: { bg: 'rgba(167,139,250,0.1)', color: '#A78BFA', border: 'rgba(167,139,250,0.25)' },
}

function StatusBadge({ status, label }: { status: PostStatus; label: string }) {
  const s = STATUS_COLORS[status]
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '99px', background: s.bg, color: s.color, border: `1px solid ${s.border}`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label}
    </span>
  )
}

export function PostCard({ post, onStatusChange, locked, T }: {
  post: Post
  onStatusChange: (id: string, status: PostStatus) => void
  locked: boolean
  T: typeof d['pt']['posts']
}) {
  const { lang } = useLang()
  const loc = lang === 'en' ? 'en-US' : 'pt-BR'
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(post.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleApprove = async () => { setLoading(true); await onStatusChange(post.id, 'aprovado'); setLoading(false) }
  const handlePublish = async () => { setLoading(true); await onStatusChange(post.id, 'publicado'); setLoading(false) }
  const handleReject  = async () => { setLoading(true); await onStatusChange(post.id, 'rascunho');  setLoading(false) }

  const preview = post.content.length > 180 ? post.content.slice(0, 180) + '…' : post.content

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', overflow: 'hidden', transition: 'border-color 0.2s' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = locked ? 'rgba(255,255,255,0.1)' : 'rgba(255,109,41,0.2)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
    >
      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: ORANGE, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><path d="M17.5 6.5h.01" />
            </svg>
          </div>
          <span style={{ fontSize: '12px', color: MUTED, textTransform: 'capitalize' }}>{post.platform ?? 'Instagram'}</span>
          {post.best_time && (
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', borderLeft: `1px solid ${BORDER}`, paddingLeft: '10px' }}>
              {post.best_time}
            </span>
          )}
          {locked && (
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', border: `1px solid ${BORDER}` }}>
              {T.freeBadge}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusBadge status={post.status} label={T.statuses[post.status]} />
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>
            {new Date(post.created_at).toLocaleDateString(loc)}
          </span>
        </div>
      </div>

      {/* Image */}
      {post.image_url && (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', overflow: 'hidden', maxHeight: '360px' }}>
          <img src={post.image_url} alt={lang === 'en' ? 'Image generated by the marketing agent' : 'Imagem gerada pelo agente de marketing'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: locked ? 'blur(6px)' : 'none', transition: 'filter 0.3s' }} />
          {locked && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(14,11,10,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '32px', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}>🔒</div>
            </div>
          )}
          {!locked && (
            <div style={{ position: 'absolute', bottom: '8px', right: '8px', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.5)', padding: '2px 7px', borderRadius: '99px', letterSpacing: '0.06em', backdropFilter: 'blur(4px)' }}>
              {lang === 'en' ? 'AI' : 'IA'} · DALL-E 3
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '16px 20px' }}>
        <p style={{ fontSize: '14px', color: 'white', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {expanded ? post.content : preview}
        </p>
        {post.content.length > 180 && (
          <button onClick={() => setExpanded(e => !e)} style={{ marginTop: '6px', fontSize: '12px', color: ORANGE, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            {expanded ? T.seeLess : T.seeMore}
          </button>
        )}

        {post.agent_notes && (
          <div style={{ marginTop: '14px', padding: '12px 14px', background: 'rgba(255,109,41,0.04)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(255,109,41,0.15)', border: '1px solid rgba(255,109,41,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '11px' }}>🤖</div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>{T.agentNote}</div>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, margin: 0 }}>{post.agent_notes}</p>
            </div>
          </div>
        )}

        {post.image_suggestion && !locked && (
          <div style={{ marginTop: '10px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>{T.imageSuggestion}</div>
            <p style={{ fontSize: '12px', color: MUTED, lineHeight: 1.6, margin: 0 }}>{post.image_suggestion}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {locked ? (
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${BORDER}` }}>
          <Link to="/dashboard/settings"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(255,109,41,0.08)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '8px', color: ORANGE, fontWeight: 600, fontSize: '13px', textDecoration: 'none', transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,109,41,0.14)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,109,41,0.08)' }}>
            {T.upgradePost}
          </Link>
        </div>
      ) : (
        post.status !== 'publicado' && (
          <div style={{ padding: '12px 20px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: '8px' }}>
            {post.status === 'rascunho' && (
              <button onClick={handleApprove} disabled={loading} style={{ padding: '8px 16px', background: 'rgba(74,222,128,0.1)', color: '#4ade80', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: '1px solid rgba(74,222,128,0.25)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                {T.approve}
              </button>
            )}
            {post.status === 'aprovado' && (
              <>
                <button onClick={handleCopy} style={{ padding: '8px 16px', background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)', color: copied ? '#4ade80' : MUTED, fontWeight: 600, fontSize: '12px', borderRadius: '8px', border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : BORDER}`, cursor: 'pointer', transition: 'all 0.2s' }}>
                  {copied ? T.copied : T.copyCaption}
                </button>
                <button onClick={handlePublish} disabled={loading} style={{ padding: '8px 16px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                  {T.markPublished}
                </button>
                <button onClick={handleReject} disabled={loading} style={{ padding: '8px 16px', background: 'transparent', color: MUTED, fontWeight: 600, fontSize: '12px', borderRadius: '8px', border: `1px solid ${BORDER}`, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                  {T.backDraft}
                </button>
              </>
            )}
          </div>
        )
      )}
    </div>
  )
}

// ── Card grid (redesign: cada antiga aba virou um card independente) ──
// Dois modos de visualização, alternáveis por switch — preferência salva no
// localStorage do navegador (é só uma preferência de exibição, não precisa
// de coluna no banco nem sincronizar entre dispositivos).

const VIEW_MODE_KEY = 'sb_agents_view_mode'
type ViewMode = 'modules' | 'categories'

function readStoredViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'modules'
  return window.localStorage.getItem(VIEW_MODE_KEY) === 'categories' ? 'categories' : 'modules'
}

function ViewModeSwitch({ mode, onChange, T }: { mode: ViewMode; onChange: (m: ViewMode) => void; T: typeof d['pt']['posts'] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
      <span style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{T.cards.viewLabel}</span>
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '9px', padding: '3px', gap: '2px' }}>
        {(['modules', 'categories'] as const).map(m => (
          <button key={m} onClick={() => onChange(m)}
            style={{ padding: '6px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: mode === m ? ORANGE : 'transparent', color: mode === m ? '#000' : MUTED, transition: 'all 0.15s', fontFamily: D }}>
            {m === 'modules' ? T.cards.viewModules : T.cards.viewCategories}
          </button>
        ))}
      </div>
    </div>
  )
}

function CategorySummaryCard({ group, keys, T, preview, updatedAt, onClick }: {
  group: GroupKey; keys: CardKey[]; T: typeof d['pt']['posts']; preview: string | null; updatedAt: string | null; onClick: () => void
}) {
  const { lang } = useLang()
  const [hover, setHover] = useState(false)
  const soon = group === 'atendimento'
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', boxSizing: 'border-box',
        background: CARD, border: `1px solid ${hover ? 'rgba(255,109,41,0.35)' : BORDER}`,
        borderRadius: '16px', padding: '22px 24px', cursor: 'pointer', fontFamily: D,
        transition: 'transform 0.18s, border-color 0.18s, box-shadow 0.18s',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? '0 8px 24px rgba(0,0,0,0.25)' : 'none',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>{GROUP_ICONS[group]}</span>
          <span style={{ fontSize: '16px', fontWeight: 800, color: 'white' }}>{groupTitle(T, group)}</span>
        </div>
        {soon && (
          <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.25)', color: ORANGE, letterSpacing: '0.04em' }}>
            {T.cards.soon}
          </span>
        )}
      </div>
      <p style={{ fontSize: '12px', color: MUTED, margin: 0, lineHeight: 1.5 }}>{T.cards.groupDesc[group]}</p>
      {preview && (
        <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '9px', fontSize: '11.5px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {preview}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '4px' }}>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
          {keys.length} {T.cards.modulesCount}{updatedAt ? ` · ${T.cards.updatedOn} ${new Date(updatedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR')}` : ''}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: hover ? ORANGE : 'rgba(255,255,255,0.25)', fontSize: '11.5px', fontWeight: 600 }}>
          {T.cards.open} <span style={{ transition: 'transform 0.18s', transform: hover ? 'translateX(3px)' : 'none' }}>→</span>
        </span>
      </div>
    </button>
  )
}

export default function PostsPage() {
  const { lang } = useLang()
  const T = d[lang].posts
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredViewMode)
  const { previewFor, groupPreview, groupUpdatedAt } = useAgentCardPreviews(T)

  const changeViewMode = (m: ViewMode) => {
    setViewMode(m)
    window.localStorage.setItem(VIEW_MODE_KEY, m)
  }

  const openGroup = (group: GroupKey, keys: CardKey[]) => {
    if (keys.length === 1) { navigate(`/dashboard/posts/${keys[0]}`); return }
    navigate(`/dashboard/posts/categoria/${group}`)
  }

  return (
    <div>
      <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{T.title}</h1>
          <p style={{ color: MUTED, fontSize: '13px' }}>{T.subtitle}</p>
        </div>
        <ViewModeSwitch mode={viewMode} onChange={changeViewMode} T={T} />
      </div>

      {viewMode === 'modules' ? (
        <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {CARD_GROUPS.map(({ group, keys }) => (
            <div key={group}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
                {T.cards.groupLabels[group]}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                {keys.map(key => (
                  <ModuleCard
                    key={key}
                    title={titleFor(T, key, group)}
                    desc={T.cards.desc[key]}
                    preview={previewFor(key)}
                    icon={CARD_ICONS[key]}
                    soon={COMING_SOON_KEYS.has(key)}
                    openLabel={T.cards.open}
                    soonLabel={T.cards.soon}
                    onClick={() => navigate(`/dashboard/posts/${key}`)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '28px 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {CARD_GROUPS.map(({ group, keys }) => (
            <CategorySummaryCard
              key={group}
              group={group}
              keys={keys}
              T={T}
              preview={groupPreview(group, keys)}
              updatedAt={groupUpdatedAt(keys)}
              onClick={() => openGroup(group, keys)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
