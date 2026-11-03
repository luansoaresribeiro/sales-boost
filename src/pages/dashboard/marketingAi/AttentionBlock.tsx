import { useNavigate } from 'react-router-dom'
import type { Lang } from '../../../contexts/LanguageContext'
import { MUTED, BORDER, D, ORANGE, CARD } from './shared'
import type { AttentionData, NextKind, Row } from './useAttention'

// "O que merece sua atenção" (Pacote A): 4 linhas clicáveis pra tela de origem. Estados: valor real, ausência, carregando,
// "Não foi possível verificar" (erro). Dado fictício só no demo, com a etiqueta "exemplo" (regra 5).
const TX = {
  pt: {
    title: 'O que merece sua atenção', demoTag: 'exemplo', loading: 'Verificando…', error: 'Não foi possível verificar',
    signal: 'Último sinal válido', noSignal: 'Nenhum sinal válido ainda',
    opp: 'Oportunidade', noOpp: 'Nenhuma oportunidade aguardando avaliação', oppN: (n: number) => `${n} oportunidade${n === 1 ? '' : 's'} aguardando avaliação`,
    dir: 'Direcionamento', noStrat: 'Sem estratégia ativa', noCentral: 'Sem tema central definido',
    next: 'Próxima ação',
    nexts: { strategy: 'Criar a estratégia (ainda não há uma ativa)', opportunity: 'Avaliar as oportunidades que aguardam você', approve: 'Aprovar as peças prontas', week: 'Planejar as peças da semana (nenhuma nos próximos 7 dias)', ok: 'Tudo em dia' } as Record<NextKind, string>,
    approveN: (n: number) => `${n} peça${n === 1 ? '' : 's'} do calendário pronta${n === 1 ? '' : 's'} para aprovar`,
  },
  en: {
    title: 'What deserves your attention', demoTag: 'example', loading: 'Checking…', error: 'Could not verify',
    signal: 'Latest valid signal', noSignal: 'No valid signal yet',
    opp: 'Opportunity', noOpp: 'No opportunity waiting for review', oppN: (n: number) => `${n} opportunit${n === 1 ? 'y' : 'ies'} waiting for review`,
    dir: 'Direction', noStrat: 'No active strategy', noCentral: 'No central theme defined',
    next: 'Next action',
    nexts: { strategy: 'Create the strategy (none is active yet)', opportunity: 'Review the opportunities waiting for you', approve: 'Approve the ready pieces', week: 'Plan this week\'s pieces (none in the next 7 days)', ok: 'All up to date' } as Record<NextKind, string>,
    approveN: (n: number) => `${n} calendar piece${n === 1 ? '' : 's'} ready to approve`,
  },
} as const

const ROUTE: Record<NextKind, string> = { strategy: '/dashboard/marketing-ai/estrategia', opportunity: '/dashboard/opportunities', approve: '/dashboard/aprovacoes', week: '/dashboard/marketing-ai/content', ok: '/dashboard/marketing-ai/content' }

export default function AttentionBlock({ lang, data }: { lang: Lang; data: AttentionData }) {
  const t = TX[lang]
  const navigate = useNavigate()
  const locale = lang === 'en' ? 'en-US' : 'pt-BR'
  const fmt = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString(locale) }
  const generic = (r: Row<unknown>): string | null => (r.state === 'loading' ? t.loading : r.state === 'error' ? t.error : null)
  const { signal, opportunity, direction, next } = data

  const rows: { key: string; label: string; text: string; sub?: string; to: string | null; alert?: boolean }[] = [
    { key: 'signal', label: t.signal, to: '/dashboard/marketing-ai/dados?sub=mercado',
      text: generic(signal) ?? (signal.state === 'empty' ? t.noSignal : `${signal.value!.source} · ${fmt(signal.value!.date)}`) },
    { key: 'opp', label: t.opp, to: '/dashboard/opportunities', alert: opportunity.state === 'value',
      text: generic(opportunity) ?? (opportunity.state === 'empty' ? t.noOpp : t.oppN(opportunity.value!.count)), sub: opportunity.value?.title ?? undefined },
    { key: 'dir', label: t.dir, to: '/dashboard/marketing-ai/estrategia',
      text: generic(direction) ?? (direction.state === 'empty' ? (direction.why === 'no_strategy' ? t.noStrat : t.noCentral) : direction.value!.text) },
    { key: 'next', label: t.next, to: next.state === 'value' ? ROUTE[next.value!.kind] : null, alert: next.state === 'value' && next.value!.kind !== 'ok',
      text: generic(next) ?? t.nexts[next.value!.kind], sub: next.value?.kind === 'approve' && next.value.count ? t.approveN(next.value.count) : undefined },
  ]
  return (
    <div style={{ margin: '24px 32px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t.title}</span>
        {data.demo && <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#FBBF24', border: '1px solid rgba(251,191,36,0.35)', borderRadius: '99px', padding: '2px 8px', textTransform: 'uppercase' }}>{t.demoTag}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
        {rows.map(r => (
          <button key={r.key} onClick={() => r.to && navigate(r.to)} disabled={!r.to}
            style={{ textAlign: 'left', fontFamily: D, background: CARD, border: `1px solid ${r.alert ? 'rgba(255,109,41,0.35)' : BORDER}`, borderRadius: '12px', padding: '12px 14px', cursor: r.to ? 'pointer' : 'default' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>{r.label}{data.demo ? ` · ${t.demoTag}` : ''}</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: r.alert ? ORANGE : 'white', lineHeight: 1.4 }}>{r.text}</div>
            {r.sub && <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '3px', lineHeight: 1.4 }}>{r.sub}</div>}
          </button>
        ))}
      </div>
    </div>
  )
}
