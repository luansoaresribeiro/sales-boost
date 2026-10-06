import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany } from '../../contexts/CompanyContext'
import { setupGateApplies } from '../../lib/setupGate'
import { useSetupStatus, type SetupStepId } from '../../lib/useSetupStatus'
import CatalogItems from '../dashboard/marketingAi/CatalogItems'
import { DadosForm, PerguntasForm, StepShell, BG, CARD, D, GREEN, MUTED, ORANGE } from './SetupSteps'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

// Fim do cadastro: "alimentar os dados reais". Fica fora do DashboardLayout.
// Contas novas sem assinatura só entram no painel depois de completar (gate em
// ClientRoute, src/main.tsx). Abrir /setup já completa mostra a tela normal,
// com o botão liberado (sem redirecionar — evita qualquer loop com o gate).
export default function SetupPage() {
  const { company, refreshCompany } = useCompany()
  const navigate = useNavigate()
  const status = useSetupStatus(company?.id)
  // undefined = automático (abre o 1º pendente); null = tudo fechado; id = aberto à mão
  // "Conectar depois" não grava nada: só recolhe o cartão (o sino de pendências segue lembrando)
  const [igLater, setIgLater] = useState(false)
  const [manual, setManual] = useState<SetupStepId | null | undefined>(undefined)
  const refresh = status.refresh
  const onChanged = useCallback(() => { void refresh() }, [refresh])

  if (!company || status.loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,109,41,0.2)', borderTopColor: ORANGE, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const gated = setupGateApplies(company)
  // Contas fora do gate (antigas/pagantes) ou erro ao calcular: o botão nunca trava.
  const canGo = status.allDone || !gated || status.error
  const firstPending = status.steps.find(s => !s.done)?.id ?? null
  const openId = manual !== undefined ? manual : firstPending
  const saved = async (id: SetupStepId) => {
    setManual(undefined) // volta ao automático: abre o próximo pendente
    if (id === 'dados') await refreshCompany()
    await status.refresh()
  }
  const toggle = (id: SetupStepId) => setManual(openId === id ? null : id)
  const igLink = `${SUPABASE_URL}/functions/v1/instagram-oauth-start?company_id=${company.id}`
  const pct = status.required > 0 ? Math.round((status.doneCount / status.required) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: BG, color: 'white', display: 'flex', flexDirection: 'column', position: 'relative', overflowX: 'hidden', fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%,-40%)', width: '700px', maxWidth: '150vw', height: '460px', background: 'radial-gradient(ellipse, rgba(255,109,41,0.22) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <main style={{ flex: 1, width: '100%', maxWidth: '560px', margin: '0 auto', padding: '28px 16px 24px', boxSizing: 'border-box', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '26px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#000', fontWeight: 900, fontSize: '13px' }}>SB</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em' }}>SalesBoost</span>
        </div>

        <h1 style={{ fontFamily: D, fontSize: 'clamp(1.5rem, 6.5vw, 2.1rem)', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.03em', textAlign: 'center', margin: '0 0 22px', overflowWrap: 'break-word' }}>
          Esse é o momento importante de <span style={{ color: ORANGE }}>alimentar os dados reais</span> — depois é só relaxar!
        </h1>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
            <span>{status.doneCount} de {status.required} obrigatórios</span>
            <span style={{ color: status.allDone ? GREEN : MUTED }}>{pct}%</span>
          </div>
          <div style={{ height: '8px', borderRadius: '99px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: status.allDone ? GREEN : ORANGE, borderRadius: '99px', transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* Instagram em destaque */}
        {igLater && !status.instagramConnected && !status.instagramRequired ? (
          <div style={{ background: CARD, border: '1px solid rgba(255,109,41,0.4)', borderRadius: '14px', padding: '12px 16px', marginBottom: '14px', fontSize: '13px', color: MUTED, lineHeight: 1.5 }}>
            Instagram: você conecta depois — vai ficar lembrado no sino de pendências.{' '}
            <button type="button" onClick={() => setIgLater(false)} style={{ minHeight: '44px', background: 'none', border: 'none', color: ORANGE, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Conectar agora</button>
          </div>
        ) : (
        <section style={{ position: 'relative', background: CARD, border: `2px solid ${ORANGE}`, borderRadius: '16px', padding: '22px 16px 16px', marginBottom: '14px', boxShadow: '0 0 28px rgba(255,109,41,0.18)' }}>
          <span style={{ position: 'absolute', top: '-11px', left: '16px', background: ORANGE, color: '#000', fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '99px', letterSpacing: '0.04em' }}>Em destaque</span>
          <h2 style={{ fontFamily: D, fontSize: '18px', fontWeight: 800, margin: '0 0 6px' }}>
            {status.instagramConnected ? '✓ Instagram conectado' : 'Conecte seu Instagram'}
          </h2>
          <p style={{ fontSize: '14px', color: MUTED, lineHeight: 1.55, margin: '0 0 14px' }}>
            {status.instagramConnected
              ? 'Pronto. O Sales Boost já pode publicar e medir o resultado — sempre com a sua aprovação.'
              : 'Assim o Sales Boost publica e mede o resultado. Nada vai ao ar sem você aprovar.'}
            {status.instagramRequired && !status.instagramConnected && <strong style={{ color: 'white' }}> Obrigatório nesta etapa.</strong>}
          </p>
          {!status.instagramConnected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a href={igLink} style={{ minHeight: '44px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '14px', borderRadius: '10px', textDecoration: 'none' }}>
                Conectar Instagram
              </a>
              {!status.instagramRequired && (
                <button type="button" onClick={() => setIgLater(true)}
                  style={{ minHeight: '44px', background: 'transparent', border: 'none', color: MUTED, fontSize: '13.5px', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Conectar depois
                </button>
              )}
            </div>
          )}
        </section>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {status.steps.map((s, i) => {
            const n = i + 1
            const open = openId === s.id
            if (s.id === 'dados') return (
              <StepShell key={s.id} n={n} done={s.done} open={open} onToggle={() => toggle(s.id)} title="Dados do negócio" hint="Nome, cidade e telefone/WhatsApp">
                <DadosForm companyId={company.id} initial={status.business} onSaved={() => saved('dados')} />
              </StepShell>
            )
            if (s.id === 'perguntas') return (
              <StepShell key={s.id} n={n} done={s.done} open={open} onToggle={() => toggle(s.id)} title="Perguntas sobre seu negócio" hint={s.done ? '' : `Responda todas (${s.missing} sem resposta)`}>
                <PerguntasForm companyId={company.id} questions={status.questions} initial={status.answers} onSaved={() => saved('perguntas')} />
              </StepShell>
            )
            const schema = status.schema
            if (!schema) return null
            const item = schema.itemLabel.toLowerCase()
            return (
              <StepShell key={s.id} n={n} done={s.done} open={open} onToggle={() => toggle(s.id)}
                title={status.minItems > 1 ? `${schema.catalogLabel}: cadastre ${status.minItems}` : `Seu primeiro ${item}`}
                hint={`${schema.catalogLabel} · mínimo de ${status.minPhotos} fotos reais por ${item}`}>
                <CatalogItems companyId={company.id} schema={schema} verticalKey={status.verticalKey} setupMode onChanged={onChanged} />
              </StepShell>
            )
          })}
        </div>
      </main>

      {/* Rodapé fixo, respeitando a área segura do celular */}
      <footer style={{ position: 'sticky', bottom: 0, zIndex: 5, background: 'rgba(14,11,10,0.96)', backdropFilter: 'blur(8px)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          {!canGo && <div style={{ fontSize: '13px', color: MUTED, textAlign: 'center', marginBottom: '8px', lineHeight: 1.4 }}>{status.missingText}</div>}
          <button type="button" disabled={!canGo} onClick={() => navigate('/dashboard')}
            style={{ width: '100%', minHeight: '48px', background: canGo ? ORANGE : 'rgba(255,255,255,0.08)', color: canGo ? '#000' : MUTED, fontWeight: 800, fontSize: '15px', border: 'none', borderRadius: '12px', cursor: canGo ? 'pointer' : 'not-allowed', fontFamily: D }}>
            Ir para o painel
          </button>
          <div style={{ fontSize: '12px', color: MUTED, textAlign: 'center', marginTop: '8px' }}>Seu progresso fica salvo.</div>
        </div>
      </footer>
    </div>
  )
}
