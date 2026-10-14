import { useState } from 'react'
import { MUTED, BORDER, D } from './shared'
import FormatsLibrary from './FormatsLibrary'
import BrandKit from './BrandKit'
import FeedPreview from './FeedPreview'
import { useLang, type Lang } from '../../../contexts/LanguageContext'

const TX = {
  pt: {
    topBrand: 'Marca (logo e cores)', topFormats: 'Formatos', topFeed: 'Prévia do feed', organic: 'Feed', stories: 'Stories',
    title: '🎨 Padrão visual do feed',
    d1: 'Marca', d2: ' (logo, cores e fontes que todo post usa) e ', d3: 'Formatos', d4: ' (a anatomia de cada imagem, do feed e dos stories). É isso que mantém o feed com cara de uma marca só.',
  },
  en: {
    topBrand: 'Brand (logo & colors)', topFormats: 'Formats', topFeed: 'Feed preview', organic: 'Feed', stories: 'Stories',
    title: '🎨 Feed visual pattern',
    d1: 'Brand', d2: ' (logo, colors and fonts every post uses) and ', d3: 'Formats', d4: ' (the anatomy of each image, for feed and stories). This keeps the feed looking like one brand.',
  },
} as const

const KIND_LABEL_EN: Record<string, string> = {
  personality: 'Personalities', framework: 'Copy frameworks', hook: 'Hooks', cta: 'CTAs', visual_system: 'Visual systems',
  principle: 'Principles', design: 'Design', carousel: 'Carousel', single_image: 'Single image', educational: 'Educational',
  storytelling: 'Storytelling', authority: 'Authority', engagement: 'Engagement', viral: 'Viral', feed: 'Feed', structure: 'Structures',
  sequence: 'Sequences', sticker: 'Stickers', poll: 'Polls', countdown: 'Countdown', link: 'Links', bts: 'Behind the scenes',
  urgency: 'Urgency', retention: 'Retention', story_ads: 'Story Ads',
  objective: 'Objectives', funnel: 'Funnel', ad_copy: 'Ad copy', headline: 'Headlines', offer: 'Offers', targeting: 'Targeting',
  retargeting: 'Retargeting', ugc: 'UGC', video_ad: 'Video ad', image_ad: 'Image ad', meta_best: 'Meta Ads', scaling: 'Scaling', fatigue: 'Creative fatigue',
  emotion: 'Emotions', composition: 'Composition', component: 'Components',
}

const ORANGE = '#FF6D29'

// Padrão visual (antes "Biblioteca"). Em 2026-10-14 o dono pediu pra limpar
// abas soltas do fluxo: o Vault virou aba própria em Conteúdo, Testes saiu
// (o calendário já mostra cada peça "Avaliando" → "No Vault"), e o Kit da
// marca veio do antigo Agente de Dados → Estilos e Visuais pra cá — marca e
// formatos juntos são o que mantém o feed com um padrão só.
const TOP_TABS = (lang: Lang): { key: string; icon: string; label: string }[] => [
  { key: 'feed', icon: '🔲', label: TX[lang].topFeed },
  { key: 'marca', icon: '🏷️', label: TX[lang].topBrand },
  { key: 'formatos', icon: '🧩', label: TX[lang].topFormats },
]
// Sub-abas de módulo — filtram Formatos e Testes por Orgânico/Stories.
// Campanhas saiu (mudou pra dentro de Agente de Meta Ads).
const MODULES = (lang: Lang): { key: 'organico' | 'stories'; icon: string; label: string }[] => [
  { key: 'organico', icon: '✍️', label: TX[lang].organic },
  { key: 'stories', icon: '📖', label: TX[lang].stories },
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
export const kindLabel = (k: string, lang: Lang = 'pt') => (lang === 'en' ? KIND_LABEL_EN : KIND_LABEL)[k] ?? k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ')

export default function ContentLibrary({ companyId }: { companyId: string }) {
  const { lang } = useLang(); const tx = TX[lang]
  const [top, setTop] = useState('feed')
  const [mod, setMod] = useState<'organico' | 'stories'>('organico')

  return (
    <div>
      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>{tx.title}</div>
        <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55, maxWidth: '760px' }}>
          <strong style={{ color: 'white' }}>{tx.d1}</strong>{tx.d2}<strong style={{ color: 'white' }}>{tx.d3}</strong>{tx.d4}
        </div>
      </div>

      {/* Abas de topo da Biblioteca */}
      <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '11px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {TOP_TABS(lang).map(t => {
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

      {/* Sub-abas de módulo — Formatos de feed e de stories. */}
      {top === 'formatos' && (
        <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '11px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {MODULES(lang).map(m => {
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

      {top === 'formatos' ? <FormatsLibrary companyId={companyId} module={mod} /> : top === 'feed' ? <FeedPreview companyId={companyId} /> : <BrandKit companyId={companyId} />}
    </div>
  )
}
