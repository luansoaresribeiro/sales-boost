// Travas de qualidade da peça do calendário (A.6, 2026-11-07). PURO (sem Deno/rede): roda no Deno e em Node
// (scripts/test-piece-guard.mjs).
//
//  1) Imagem: peça de foto/carrossel SEM nenhuma imagem utilizável nunca entra na fila de aprovação (Vault). Antes: o modelo
//     "livre" só tentava foto de IA e, falhando, o carrossel ficava sem nada e ia pro Vault com nota 82 (Teste Zero, 3840d8d7).
//  2) Modelo (template): o que o Diretor escolheu é gravado e a troca (educativo usa slides; rotação automática) sempre
//     explicada no reasoning — antes o reasoning justificava "faq" e o brief saía "livre" sem aviso.
//  3) Afirmação de TENDÊNCIA de mercado sem sinal real ligado (Tespon, e186633d: "Locatários com renda mais alta estão
//     escolhendo contratos mais longos"). A trava de números/termos não pega afirmação em frase comum. Aqui: os padrões de
//     tendência vêm da FICHA (opportunity_texts.market_trends — regra 6); sem a lista na ficha a trava fica desligada.
import { norm } from './opportunityEngine.ts'

// ── 1) Imagem ────────────────────────────────────────────────────────────────
export interface PieceMedia { image_url?: string | null; video_url?: string | null; slides?: unknown; media?: unknown }
/** Tem ao menos 1 imagem/vídeo de verdade (capa, slide com imagem ou mídia da peça). */
export function hasUsableImage(p: PieceMedia): boolean {
  const ok = (u: unknown) => typeof u === 'string' && /^https?:\/\/\S+$/i.test(u.trim())
  if (ok(p.image_url) || ok(p.video_url)) return true
  if (Array.isArray(p.slides) && p.slides.some(s => ok((s as { image_url?: unknown } | null)?.image_url))) return true
  if (Array.isArray(p.media) && p.media.some(m => ok((m as { url?: unknown } | null)?.url))) return true
  return false
}
/** Só foto/carrossel precisam de imagem; vídeo/reel/story têm fluxo próprio (estúdio) e ficam de fora desta trava. */
export const needsImage = (format: string | null | undefined): boolean => ['foto', 'carrossel'].includes(String(format ?? ''))

export interface FallbackCard { template: 'faq' | 'photo'; fields: Record<string, string> }
/** Card de reserva (render-format: texto só via render — regra 4). Diretor escolheu "faq" e a peça trouxe pergunta+resposta = faq; senão card "photo" (fundo da marca + manchete). */
export function fallbackCardPlan(a: { directorTemplate?: string | null; post: Record<string, unknown>; idea?: string | null; caption?: string | null; brand: string; cap: (s: string, n: number) => string }): FallbackCard {
  const q = String(a.post.card_question ?? '').trim(), ans = String(a.post.card_answer ?? '').trim()
  if (a.directorTemplate === 'faq' && q && ans) return { template: 'faq', fields: { question: a.cap(q, 90), answer: a.cap(ans, 140) } }
  return { template: 'photo', fields: { headline: a.cap(String(a.idea ?? a.caption ?? a.brand), 90), cta: a.cap(String(a.post.cta ?? ''), 28) } }
}

// ── 2) Modelo (template) ─────────────────────────────────────────────────────
export interface TemplateIn { directorTemplate: unknown; forced: string | null; deck: boolean; format: string; templateKeys: string[]; lastTemplate?: string | null }
export interface TemplateOut { template: string; format: string; directorTemplate: string | null; note: string | null }
/** Decide o modelo final. `directorTemplate` (escolha válida da IA) é sempre devolvido pra gravar no brief; `note` explica qualquer troca. */
export function resolveTemplate(a: TemplateIn): TemplateOut {
  const dir = a.templateKeys.includes(String(a.directorTemplate)) ? String(a.directorTemplate) : null
  let template = dir ?? 'livre', format = a.format, note: string | null = null
  if (a.deck) {
    format = 'carrossel'; template = 'livre'
    if (dir && dir !== 'livre') note = `(O modelo "${dir}" não se aplica: este pedido é carrossel de slides da marca, feito pelo desenho de slides.)`
  } else if (a.forced) {
    template = a.forced; format = 'foto'
    if (dir && dir !== a.forced) note = `(Modelo "${a.forced}" escolhido por você no botão, no lugar de "${dir}".)`
  } else if (format === 'foto') {
    const idx = a.lastTemplate && a.templateKeys.includes(a.lastTemplate) ? a.templateKeys.indexOf(a.lastTemplate) : -1
    const rotated = a.templateKeys[(idx + 1) % a.templateKeys.length]
    if (rotated !== (dir ?? 'livre')) note = `(Template ajustado para "${rotated}" pela rotação automática entre todos os formatos.)`
    template = rotated
  }
  return { template, format, directorTemplate: dir, note }
}

// ── 3) Afirmação de tendência de mercado sem fonte ───────────────────────────
export interface TrendCfg { terms: string[]; opinion: string[] }
/** Lê da ficha (opportunity_texts.market_trends[lang] = {terms, opinion}). Sem lista = null (trava desligada, prompt idêntico ao de antes). */
export function parseTrendCfg(raw: unknown): TrendCfg | null {
  const r = (raw && typeof raw === 'object' ? raw : null) as { terms?: unknown; opinion?: unknown } | null
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map(x => norm(x)) : [])
  const terms = strs(r?.terms)
  return terms.length ? { terms, opinion: strs(r?.opinion) } : null
}
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const hit = (n: string, list: string[]) => list.some(t => new RegExp('(?:^|[^a-z0-9])' + esc(t)).test(n))

/** Sinal de mercado REAL ligado à peça (vaga do calendário que usou sinal/tendência): precisa ter fonte (nome ou link). */
export function hasMarketSource(intent: { market_context?: { evidence?: { source_name?: string | null; source_url?: string | null }[] } | null } | null | undefined): boolean {
  return (intent?.market_context?.evidence ?? []).some(e => !!(e?.source_name || e?.source_url))
}

/** Frases que afirmam tendência/comportamento de mercado como fato. Frase em tom de opinião do corretor ("na minha experiência…") não conta. */
export function trendIssues(text: string, cfg: TrendCfg | null): string[] {
  if (!cfg) return []
  const out: string[] = []
  for (const line of String(text ?? '').split('\n')) {
    for (const s of line.replace(/[ \t]+/g, ' ').trim().split(/(?<=[.!?…])\s+/)) {
      const n = norm(s)
      if (n && hit(n, cfg.terms) && !hit(n, cfg.opinion)) out.push(s.trim())
    }
  }
  return out
}

/** Afirmações de tendência da peça inteira. Sinal real com fonte ligado = nada a barrar (a fonte sustenta). */
export function pieceTrendIssues(texts: string[], cfg: TrendCfg | null, sourced: boolean): string[] {
  if (!cfg || sourced) return []
  return [...new Set(texts.flatMap(t => trendIssues(t, cfg)))]
}

/** Aviso pro dono (vira reasoning); o marcador "Precisa de fonte:" baixa a nota (claimLock.qualityFlags) e impede o Vault automático. */
export function trendNotice(issues: string[]): string | null {
  if (!issues.length) return null
  const shown = issues.slice(0, 3).map(r => `“${r.length > 90 ? `${r.slice(0, 89).trimEnd()}…` : r}”`).join('; ')
  return `Precisa de fonte: ${shown}${issues.length > 3 ? ` (+${issues.length - 3})` : ''}. A peça afirma algo sobre o mercado sem sinal real ligado — reescreva como opinião sua ou confirme a fonte antes de aprovar.`
}

/** Regra do prompt de escrita. Sem lista na ficha = '' (prompt idêntico). Com sinal com fonte: só ele sustenta fato; sem: tudo vira orientação. */
export function trendPromptRule(cfg: TrendCfg | null, evidence: { title: string; source_name?: string | null }[] | null | undefined, bullet = '- '): string {
  if (!cfg) return ''
  const ev = (evidence ?? []).filter(e => e?.title && e.source_name)
  const base = `${bullet}AFIRMAÇÃO SOBRE O MERCADO: tendência, comportamento ou movimento do mercado ("estão escolhendo", "cada vez mais", "está crescendo", efeitos como rotatividade ou vacância) é FATO e só pode aparecer se vier de um sinal de mercado real, com fonte, listado abaixo.`
  if (ev.length) return `${base} Sinais reais disponíveis (cite a fonte, sem acrescentar número nem detalhe que não esteja no título): ${ev.map(e => `"${e.title}" (fonte: ${e.source_name})`).join('; ')}.\n`
  return `${base} NENHUM sinal de mercado foi fornecido para esta peça: então NÃO afirme nenhuma tendência. Escreva como orientação ou opinião do corretor ("na minha experiência", "vale conferir", "o que eu recomendo"), sobre o que o cliente deve olhar ou fazer — sem dizer o que o mercado ou os compradores/locatários estão fazendo.\n`
}
