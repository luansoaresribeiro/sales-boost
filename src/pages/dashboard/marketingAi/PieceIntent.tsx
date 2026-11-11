import { Link } from 'react-router-dom'
import { useLang } from '../../../contexts/LanguageContext'
import { MUTED } from './shared'
import { activationType, pieceObjective, type ActivationKind, type OppMap, type PieceFields } from './activationType'

// Objetivo + tipo de ativação da peça (Pacote A). `compact` = célula do calendário; `full` = modal (também imóvel e oportunidade).
// Motivo da escolha do imóvel: hoje NÃO existe campo por peça — nunca inventar (regra 5); o modal avisa que não é registrado.
const TX = {
  pt: {
    objective: 'Objetivo', type: 'Tipo', noObjective: 'Sem objetivo registrado', unverifiable: 'Não foi possível verificar',
    funnel: 'Objetivo da etapa do funil', opportunity: 'Objetivo da oportunidade',
    kinds: { opportunity: 'Oportunidade', property: 'Apresentação de imóvel', educational_with_property: 'Educativo com imóvel', educational_without_property: 'Educativo sem imóvel', unknown: 'Tipo não identificado' } as Record<ActivationKind, string>,
    item: 'Imóvel', noItem: 'Sem imóvel ligado', itemLinked: 'Imóvel ligado (abrir no Catálogo)', opp: 'Oportunidade', noOpp: 'Sem oportunidade ligada', oppMissing: 'Oportunidade ligada, mas não encontrada',
  },
  en: {
    objective: 'Objective', type: 'Type', noObjective: 'No objective recorded', unverifiable: 'Could not verify',
    funnel: 'Funnel stage objective', opportunity: 'Opportunity objective',
    kinds: { opportunity: 'Opportunity', property: 'Property presentation', educational_with_property: 'Educational with property', educational_without_property: 'Educational without property', unknown: 'Type not identified' } as Record<ActivationKind, string>,
    item: 'Property', noItem: 'No property linked', itemLinked: 'Property linked (open in Catalog)', opp: 'Opportunity', noOpp: 'No opportunity linked', oppMissing: 'Opportunity linked, but not found',
  },
} as const

export default function PieceIntent({ piece, intent, oppById, mode, itemTitle }: {
  piece: PieceFields; intent: unknown; oppById: OppMap; mode: 'compact' | 'full'; itemTitle?: string | null
}) {
  const { lang } = useLang(); const t = TX[lang]
  const obj = pieceObjective(intent)
  const act = activationType(piece, oppById)
  const typeText = act.state === 'unverifiable' ? t.unverifiable : t.kinds[act.kind]
  const objLabel = obj ? t[obj.key] : t.objective
  const row = (label: string, value: React.ReactNode, key: string) => <div key={key} style={{ fontSize: mode === 'compact' ? '8.5px' : '11.5px', color: MUTED, lineHeight: 1.45 }}><strong style={{ color: 'rgba(255,255,255,0.75)' }}>{label}:</strong> {value}</div>
  if (mode === 'compact') {
    const o = obj ? obj.text : t.noObjective
    return (
      <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <div title={`${objLabel}: ${o}`} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row(t.objective, o, 'o')}</div>
        {row(t.type, typeText, 't')}
      </div>
    )
  }
  const opp = piece.opportunity_id ? (oppById ? oppById[piece.opportunity_id] : null) : undefined
  return (
    <div style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {row(objLabel, obj ? obj.text : t.noObjective, 'o')}
      {row(t.type, typeText, 't')}
      {row(t.item, piece.item_id
        ? <Link to={`/dashboard/catalogo?item=${encodeURIComponent(piece.item_id)}`} style={{ color: '#FF6D29', fontWeight: 700 }}>{itemTitle || t.itemLinked}</Link>
        : t.noItem, 'i')}
      {row(t.opp, opp === undefined ? t.noOpp
        : opp === null ? (oppById === null ? t.unverifiable : t.oppMissing)
        : <Link to="/dashboard/opportunities" style={{ color: '#FF6D29', fontWeight: 700 }}>{opp.title}</Link>, 'p')}
    </div>
  )
}
