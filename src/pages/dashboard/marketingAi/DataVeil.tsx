// ── DataVeil ─────────────────────────────────────────────────────────────
// Mantém o LAYOUT do demo, mas deixa claro o estado do dado (Política de Fonte
// de Dados). Nunca mostra número falso como se fosse real:
//   real   → mostra o conteúdo normal (dado de verdade).
//   demo   → mostra o conteúdo normal (o dono LIGOU o Modo demonstração).
//   locked → mostra o MESMO layout, porém BORRADO, com um card "conecte pra ver
//            de verdade" por cima. O número fica ilegível — não engana.
//   error  → igual ao locked, mas a mensagem diz que a atualização falhou.
import type { ReactNode } from 'react'
import { CARD, MUTED, BORDER, D } from './shared'

const ORANGE = '#FF6D29'
const RED = '#f87171'

export type VeilMode = 'real' | 'demo' | 'locked' | 'error'

// Decisão única e consistente em toda a plataforma.
export function veilMode(opts: { hasReal: boolean; demoMode: boolean; error?: boolean }): VeilMode {
  if (opts.error) return 'error'
  if (opts.hasReal) return 'real'
  return opts.demoMode ? 'demo' : 'locked'
}

export default function DataVeil({ mode, title, message, cta, children }: {
  mode: VeilMode
  title?: string
  message?: string
  cta?: { label: string; onClick: () => void }
  children: ReactNode
}) {
  // Dado real ou demo explícito → não borra nada.
  if (mode === 'real' || mode === 'demo') return <>{children}</>

  const isError = mode === 'error'
  return (
    <div style={{ position: 'relative' }}>
      {/* Layout preservado, porém borrado e não-interativo. */}
      <div aria-hidden style={{ filter: 'blur(7px)', opacity: 0.5, pointerEvents: 'none', userSelect: 'none' }}>
        {children}
      </div>

      {/* Card por cima (nítido) explicando o estado. */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ maxWidth: '360px', textAlign: 'center', background: CARD, border: `1px solid ${isError ? 'rgba(248,113,113,0.35)' : BORDER}`, borderRadius: '14px', padding: '22px 24px', boxShadow: '0 12px 40px rgba(0,0,0,0.45)' }}>
          <div style={{ fontSize: '26px', marginBottom: '10px' }}>{isError ? '⚠️' : '🔒'}</div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', fontFamily: D, marginBottom: '6px' }}>
            {title ?? (isError ? 'Não foi possível atualizar' : 'Sem dados reais ainda')}
          </div>
          <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.55, marginBottom: cta ? '14px' : 0 }}>
            {message ?? (isError
              ? 'A conexão existe, mas a última atualização falhou. Tente de novo em instantes.'
              : 'Estes números são só um exemplo do layout. Conecte a fonte pra ver os seus dados de verdade — ou ligue o Modo demonstração pra explorar com dados fictícios.')}
          </div>
          {cta && (
            <button onClick={cta.onClick}
              style={{ padding: '9px 18px', background: isError ? 'transparent' : ORANGE, color: isError ? RED : '#000', fontWeight: 700, fontSize: '12px', borderRadius: '9px', border: isError ? `1px solid ${RED}` : 'none', cursor: 'pointer', fontFamily: D }}>
              {cta.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
