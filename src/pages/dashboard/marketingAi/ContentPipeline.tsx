import type { Lang } from '../../../contexts/LanguageContext'
import { buildPipeline, type PipelineInput, type PipelineStep } from '../../../lib/contentPipeline'
import { CARD, BORDER, MUTED, D } from './shared'
import { FUNNEL_DAYS } from './useCommercialFunnel'

// Etapa B (dono, 23/11): "dashboard honesto". Faixa "Da produção ao resultado" acima do "Resultado comercial":
// gerado → aprovado → publicado → alcance → leads → visitas, cada número com a fonte e "não medido" quando falta integração.
// Fica fora do modo demonstração (nunca mistura exemplo com número real).
const TX = {
  pt: { title: 'Da produção ao resultado', win: `últimos ${FUNNEL_DAYS} dias`, src: 'fonte', notMeasured: 'não medido', noData: 'sem dado', loading: 'Carregando…' },
  en: { title: 'From production to results', win: `last ${FUNNEL_DAYS} days`, src: 'source', notMeasured: 'not measured', noData: 'no data', loading: 'Loading…' },
} as const

const CSS = `
.cp-wrap{margin:24px 32px 0;font-family:${D}}
.cp-row{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
@media (max-width:1023px){.cp-row{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:767px){.cp-wrap{margin:18px 14px 0}.cp-row{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}}
`

function Step({ s, lang, i, loading }: { s: PipelineStep; lang: Lang; i: number; loading: boolean }) {
  const t = TX[lang]
  const measured = s.state === 'medido' && s.value != null
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '12px 14px', minWidth: 0 }}>
      <div style={{ fontSize: '10.5px', color: MUTED, fontWeight: 700 }}>{i + 1}. {s.label}</div>
      <div style={{ fontSize: measured ? '1.5rem' : '0.95rem', fontWeight: 900, color: measured ? 'white' : MUTED, marginTop: '4px', lineHeight: 1.2 }}>
        {measured ? s.value!.toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR') : s.state === 'nao_medido' ? t.notMeasured : loading ? '…' : t.noData}
      </div>
      {s.hint && <div style={{ fontSize: '11px', color: MUTED, marginTop: '4px', lineHeight: 1.4, overflowWrap: 'anywhere' }}>{s.hint}</div>}
      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.38)', marginTop: '6px', lineHeight: 1.35, overflowWrap: 'anywhere' }}>{t.src}: {s.source}</div>
    </div>
  )
}

export default function ContentPipeline({ lang, input, loading }: { lang: Lang; input: PipelineInput; loading: boolean }) {
  const t = TX[lang]
  const steps = buildPipeline(input, lang)
  return (
    <section className="cp-wrap" aria-label={t.title}>
      <style>{CSS}</style>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'white', margin: 0 }}>{t.title}</h2>
        <span style={{ fontSize: '12px', color: MUTED }}>{loading ? t.loading : t.win}</span>
      </div>
      <div className="cp-row" style={{ opacity: loading ? 0.5 : 1 }}>
        {steps.map((s, i) => <Step key={s.key} s={s} lang={lang} i={i} loading={loading} />)}
      </div>
    </section>
  )
}
