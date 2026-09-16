import { useState } from 'react'
import { MUTED, BORDER, D } from './shared'
import FormatsLibrary from './FormatsLibrary'
import TestingArea from './TestingArea'
import ContentVault from './ContentVault'

const ORANGE = '#FF6D29'

// Abas de topo da Biblioteca — Ideias saiu daqui (mudou pra dentro de
// Calendário da Semana, é lá que ela orienta o planejamento agora — ver
// WeeklyCalendarTab.tsx). Formatos e Testes viraram UMA aba só (pedido do
// dono — gerar o formato e já ver ele passando pelo controle de qualidade,
// sem trocar de aba no meio do caminho). Vault continua separado.
// Estilos e Visuais mudou pra aba Agente de Dados — identidade visual/marca é
// dado de contexto pro agente, não algo que se "testa" ou "publica" daqui.
const TOP_TABS: { key: string; icon: string; label: string }[] = [
  { key: 'formatos', icon: '🧩', label: 'Formatos & Testes' },
  { key: 'vault', icon: '⭐', label: 'Vault' },
]
// Sub-abas de módulo — filtram Formatos e Testes por Orgânico/Stories.
// Campanhas saiu (mudou pra dentro de Agente de Meta Ads).
const MODULES: { key: 'organico' | 'stories'; icon: string; label: string }[] = [
  { key: 'organico', icon: '✍️', label: 'Orgânico' },
  { key: 'stories', icon: '📖', label: 'Stories' },
]

// Continuam exportados — usados por ModuleLibrary.tsx e ContentVault.tsx.
export const KIND_LABEL: Record<string, string> = {
  personality: 'Personalidades', framework: 'Frameworks de copy', hook: 'Hooks', cta: 'CTAs', visual_system: 'Sistemas visuais',
  principle: 'Princípios', design: 'Design', carousel: 'Carrossel', single_image: 'Imagem única', educational: 'Educativo',
  storytelling: 'Storytelling', authority: 'Autoridade', engagement: 'Engajamento', viral: 'Viral', feed: 'Feed', structure: 'Estruturas',
  sequence: 'Sequências', sticker: 'Stickers', poll: 'Enquetes', countdown: 'Contagem regressiva', link: 'Links', bts: 'Bastidores',
  urgency: 'Urgência', retention: 'Retenção', story_ads: 'Story Ads',
  objective: 'Objetivos', funnel: 'Funil', ad_copy: 'Copy de anúncio', headline: 'Headlines', offer: 'Ofertas', targeting: 'Segmentação',
  retargeting: 'Retargeting', ugc: 'UGC', video_ad: 'Vídeo ad', image_ad: 'Imagem ad', meta_best: 'Meta Ads', scaling: 'Escala', fatigue: 'Fadiga de criativo',
  emotion: 'Emoções', composition: 'Composição', component: 'Componentes',
}
export const kindLabel = (k: string) => KIND_LABEL[k] ?? k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ')

// Biblioteca: Formatos (a anatomia de cada imagem), Testes (QC) e Vault
// (aprovados) — tudo num lugar só. Ideias mudou pra Calendário da Semana;
// Estilos e Visuais fica na aba Agente de Dados.
export default function ContentLibrary({ companyId }: { companyId: string }) {
  const [top, setTop] = useState('formatos')
  const [mod, setMod] = useState<'organico' | 'stories'>('organico')

  return (
    <div>
      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>📚 Biblioteca do Agente de Conteúdo</div>
        <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55, maxWidth: '760px' }}>
          <strong style={{ color: 'white' }}>Formatos</strong> (a anatomia de cada imagem), <strong style={{ color: 'white' }}>Testes</strong> (controle de qualidade) e <strong style={{ color: 'white' }}>Vault</strong> (aprovados, prontos pra publicar). Ideias vive em <strong style={{ color: 'white' }}>Calendário da Semana</strong> agora; Estilos e Visuais (Kit da marca) fica na aba <strong style={{ color: 'white' }}>Agente de Dados</strong>.
        </div>
      </div>

      {/* Abas de topo da Biblioteca */}
      <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '11px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {TOP_TABS.map(t => {
          const active = top === t.key
          return (
            <button key={t.key} onClick={() => setTop(t.key)}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 15px', background: active ? 'rgba(255,109,41,0.14)' : 'transparent', border: `1px solid ${active ? 'rgba(255,109,41,0.4)' : 'transparent'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: D }}>
              <span style={{ fontSize: '14px' }}>{t.icon}</span>
              <span style={{ fontSize: '12.5px', fontWeight: 800, color: active ? ORANGE : 'white' }}>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Sub-abas de módulo — Formatos e Testes têm Orgânico/Stories
          (Vault é da marca/QC como um todo, não por módulo). */}
      {top === 'formatos' && (
        <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '11px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {MODULES.map(m => {
            const active = mod === m.key
            return (
              <button key={m.key} onClick={() => setMod(m.key)}
                style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 13px', background: active ? 'rgba(255,109,41,0.12)' : 'transparent', border: `1px solid ${active ? 'rgba(255,109,41,0.35)' : 'transparent'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: D }}>
                <span style={{ fontSize: '14px' }}>{m.icon}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: active ? ORANGE : 'white' }}>{m.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {top === 'formatos' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <FormatsLibrary companyId={companyId} module={mod} />
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: '24px' }}>
            <TestingArea companyId={companyId} kind={mod} />
          </div>
        </div>
      ) : <ContentVault companyId={companyId} />}
    </div>
  )
}
