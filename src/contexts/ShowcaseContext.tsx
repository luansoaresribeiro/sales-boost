import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCompany } from './CompanyContext'
import { useLang } from './LanguageContext'
import { isShowcaseMode } from '../lib/setupGate'
import { installShowcaseGuard } from '../lib/showcaseGuard'

// "Modo vitrine" (decisão do dono 2026-10-13, docs/DECISIONS.md): conta nova que
// ainda não pagou navega por todo o painel, só que em "somente visualização".
// Este provider (montado no layout do painel) faz duas coisas:
//  1. liga o guard central (lib/showcaseGuard.ts) que impede as chamadas que
//     gastam/publicam e abre o modal único "Disponível no plano";
//  2. expõe `readOnly` e `openPlanModal()` pra telas que disparam coisa sozinhas
//     ao abrir (ex.: a 1ª estratégia) — elas devem NÃO disparar quando readOnly.
// A trava de verdade fica no servidor (supabase/functions/_shared/access.ts).

interface ShowcaseCtx { readOnly: boolean; openPlanModal: () => void }
const Ctx = createContext<ShowcaseCtx>({ readOnly: false, openPlanModal: () => {} })
export const useShowcase = () => useContext(Ctx)

// Chamadas que acontecem logo depois de trocar de tela são automáticas (a tela
// abrindo e buscando), não clique do dono: bloqueia em silêncio, sem modal.
const AUTO_WINDOW_MS = 1500

const TX = {
  pt: {
    title: 'Disponível no plano',
    body: 'Isso é o Sales Boost trabalhando de verdade (criar com IA, publicar, enviar). Escolha um plano pra liberar. Enquanto isso você pode ver todo o painel e editar os dados do seu negócio.',
    plans: 'Ver planos', later: 'Agora não',
  },
  en: {
    title: 'Available on the plan',
    body: 'This is Sales Boost working for real (creating with AI, publishing, sending). Pick a plan to unlock it. Meanwhile you can browse the whole dashboard and edit your business details.',
    plans: 'See plans', later: 'Not now',
  },
} as const

export const PLANS_PATH = '/gratis#plano'

export function ShowcaseProvider({ children }: { children: React.ReactNode }) {
  const { company, access } = useCompany()
  const { lang } = useLang()
  const navigate = useNavigate()
  const location = useLocation()
  const readOnly = isShowcaseMode(company, access)
  const [open, setOpen] = useState(false)
  const routeAt = useRef(0)
  useEffect(() => { routeAt.current = Date.now() }, [location.pathname, location.search])

  const openPlanModal = useCallback(() => setOpen(true), [])
  const onBlocked = useCallback(() => { if (Date.now() - routeAt.current >= AUTO_WINDOW_MS) setOpen(true) }, [])
  useEffect(() => (readOnly ? installShowcaseGuard(onBlocked) : undefined), [readOnly, onBlocked])

  const value = useMemo(() => ({ readOnly, openPlanModal }), [readOnly, openPlanModal])
  const t = TX[lang]

  return (
    <Ctx.Provider value={value}>
      {children}
      {readOnly && open && createPortal(
        <div role="dialog" aria-modal="true" aria-label={t.title} onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '400px', background: '#1A1008', border: '1px solid rgba(255,109,41,0.4)', borderRadius: '18px', padding: '24px', fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", boxShadow: '0 24px 80px rgba(0,0,0,0.5)', textAlign: 'center' }}>
            <div style={{ fontSize: '21px', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', marginBottom: '8px' }}>🔒 {t.title}</div>
            <div style={{ fontSize: '13px', color: '#BABABA', lineHeight: 1.6, marginBottom: '18px' }}>{t.body}</div>
            <button onClick={() => { setOpen(false); navigate(PLANS_PATH) }}
              style={{ width: '100%', padding: '13px', background: '#FF6D29', color: '#000', fontWeight: 900, fontSize: '14px', border: 'none', borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>{t.plans} →</button>
            <button onClick={() => setOpen(false)}
              style={{ display: 'block', width: '100%', marginTop: '8px', padding: '10px', background: 'transparent', border: 'none', color: '#BABABA', fontSize: '12.5px', cursor: 'pointer', fontFamily: 'inherit' }}>{t.later}</button>
          </div>
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  )
}
