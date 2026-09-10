import { useState } from 'react'
import { MUTED, BORDER, D } from './shared'
import VisualLibrary from './VisualLibrary'
import CreativeAgent from './CreativeAgent'
import FormatsLibrary from './FormatsLibrary'
import TestingArea from './TestingArea'
import ContentVault from './ContentVault'

const ORANGE = '#FF6D29'

// Abas de topo da Biblioteca — Ideias (ex-Creative Agent) leva ao Trend
// Agent + geração de ideias; Testes e Vault vivem aqui agora (canônicos,
// não duplicados em Conteúdo/Stories/Campanhas nem soltos em Conteúdo).
const TOP_TABS: { key: string; icon: string; label: string }[] = [
  { key: 'creative', icon: '💡', label: 'Ideias' },
  { key: 'formatos', icon: '🧩', label: 'Formatos' },
  { key: 'visual', icon: '🎨', label: 'Estilos e Visuais' },
  { key: 'testes', icon: '🧪', label: 'Testes' },
  { key: 'vault', icon: '⭐', label: 'Vault' },
]
// Sub-abas de módulo — filtram Ideias, Formatos e Testes por Orgânico/Stories/Campanhas.
const MODULES: { key: 'organico' | 'stories' | 'campanhas'; icon: string; label: string }[] = [
  { key: 'organico', icon: '✍️', label: 'Orgânico' },
  { key: 'stories', icon: '📖', label: 'Stories' },
  { key: 'campanhas', icon: '🎯', label: 'Campanhas' },
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

// Biblioteca: Ideias (Trend Agent + Creative Agent), Formatos (a anatomia de
// cada imagem), Estilos e Visuais (Kit da marca), Testes (QC) e Vault
// (aprovados) — tudo num lugar só.
export default function ContentLibrary({ companyId }: { companyId: string }) {
  const [top, setTop] = useState('creative')
  const [mod, setMod] = useState<'organico' | 'stories' | 'campanhas'>('organico')

  return (
    <div>
      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>📚 Biblioteca do Agente de Conteúdo</div>
        <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55, maxWidth: '760px' }}>
          <strong style={{ color: 'white' }}>Ideias</strong> (tendências reais + sugestões), <strong style={{ color: 'white' }}>Formatos</strong> (a anatomia de cada imagem), <strong style={{ color: 'white' }}>Estilos e Visuais</strong> (o Kit da marca), <strong style={{ color: 'white' }}>Testes</strong> (controle de qualidade) e <strong style={{ color: 'white' }}>Vault</strong> (aprovados, prontos pra publicar).
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

      {/* Sub-abas de módulo (Orgânico/Stories/Campanhas) — aparecem em Ideias,
          Formatos e Testes (Estilos e Visuais e Vault são da marca/QC como um
          todo, não por módulo). */}
      {(top === 'creative' || top === 'formatos' || top === 'testes') && (
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

      {top === 'creative' ? <CreativeAgent companyId={companyId} module={mod} />
        : top === 'formatos' ? <FormatsLibrary companyId={companyId} module={mod} />
        : top === 'visual' ? <VisualLibrary companyId={companyId} />
        : top === 'testes' ? <TestingArea companyId={companyId} kind={mod} />
        : <ContentVault companyId={companyId} />}
    </div>
  )
}
