import type { Lang } from '../../../../contexts/LanguageContext'
import { MUTED, D } from '../shared'
import { STATION_KEYS, type StationInfo, type StationKey } from './factoryState'
import { robotView } from './robotState'
import { PoseDot } from './StationUi'

// Cortina da fábrica (C.2.1): só HTML/CSS (nada de three até abrir). Aqui: o CSS (cortina entreaberta, abertura, folha de baixo) e a
// parte da frente — as 5 luzes de estado + a frase-resumo do que precisa do dono, já úteis com a cortina fechada.
export const PREVIEW_SRC = '/factory-preview.webp'   // cena estática (sem dado de cliente), gerada com Playwright a partir da própria cena
export const CLOSED_H = 224
export const OPEN_H = 'clamp(340px, 70vh, 560px)'     // celular: a cortina aberta nunca passa de ~70% da altura da tela; o resto da página rola

export const FACTORY_CSS = `
.sbf-stage{position:relative;overflow:hidden;border-radius:16px;border:1px solid rgba(255,255,255,0.06);background:#0E0B0A;transition:height .75s cubic-bezier(.6,.05,.25,1)}
.sbf-preview{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 55%;opacity:.95}
.sbf-drape{position:absolute;top:0;bottom:0;width:52%;z-index:3;pointer-events:none;transition:transform .75s cubic-bezier(.6,.05,.25,1);
  background:linear-gradient(90deg,rgba(0,0,0,0) 70%,rgba(0,0,0,.5)),repeating-linear-gradient(90deg,#2a0e05 0,#6e2610 13px,#3b1508 27px,#8f3515 40px,#2a0e05 56px)}
.sbf-drape.l{left:0;transform:translateX(-36%)}
.sbf-drape.r{right:0;transform:translateX(36%) scaleX(-1)}
.sbf-valance{position:absolute;left:0;right:0;top:0;height:14px;z-index:4;pointer-events:none;background:linear-gradient(180deg,#FF6D29,#a8420f);box-shadow:0 4px 10px rgba(0,0,0,.5);transition:opacity .4s}
.sbf-stage.is-open .sbf-drape.l{transform:translateX(-102%)}
.sbf-stage.is-open .sbf-drape.r{transform:translateX(102%) scaleX(-1)}
.sbf-stage.is-open .sbf-valance{opacity:0}
.sbf-hit{position:absolute;inset:0;z-index:5;cursor:pointer;border:0;padding:0;background:transparent;display:block;width:100%;text-align:center}
.sbf-hit:focus-visible{outline:2px solid #FF6D29;outline-offset:-4px}
.sbf-front{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:6;display:flex;flex-direction:column;align-items:center;gap:8px;width:max-content;max-width:calc(100% - 20px);padding:12px 18px;border-radius:14px;background:rgba(14,11,10,.8);border:1px solid rgba(255,255,255,.1);box-sizing:border-box;pointer-events:none}
.sbf-stage.is-open .sbf-front{display:none}
.sbf-lights{display:flex;gap:14px;align-items:flex-start;justify-content:center;flex-wrap:nowrap}
.sbf-light{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10.5px;font-weight:700;color:#BABABA}
.sbf-lname{white-space:nowrap}
@media (max-width:640px){.sbf-lname{display:none}.sbf-lights{gap:16px}.sbf-front{padding:10px 14px}}
.sbf-ctl{position:absolute;z-index:7;font-family:${D};font-size:11.5px;font-weight:700;color:#BABABA;background:rgba(14,11,10,.78);border:1px solid rgba(255,255,255,.14);border-radius:99px;padding:6px 12px;cursor:pointer}
.sbf-ctl:hover,.sbf-ctl:focus-visible{color:#fff;border-color:rgba(255,255,255,.4)}
.sbf-link{background:none;border:0;padding:0;font:inherit;color:#FF6D29;text-decoration:underline;cursor:pointer}
@keyframes sbSheetUp{from{transform:translateY(100%)}to{transform:none}}
@keyframes sbPanelIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.sbf-stage,.sbf-drape,.sbf-valance{transition:none!important}.sbf-stage *{animation:none!important}}
`

const SHORT = {
  pt: ['Mercado', 'Oportunidades', 'Estratégia', 'Ativação', 'Resultados'],
  en: ['Market', 'Opportunities', 'Strategy', 'Activation', 'Results'],
} as const

export function CurtainFront({ lang, stations, summary }: { lang: Lang; stations: Record<StationKey, StationInfo>; summary: string }) {
  return (
    <div className="sbf-front" style={{ fontFamily: D }}>
      <div className="sbf-lights" role="list">
        {STATION_KEYS.map((k, i) => {
          const rv = robotView(stations[k], lang)
          return (
            <span key={k} className="sbf-light" role="listitem" data-robot-pose={rv.pose} title={`${i + 1} · ${SHORT[lang][i]}: ${rv.label}`} aria-label={`${i + 1} · ${SHORT[lang][i]}: ${rv.label}`}>
              <PoseDot pose={rv.pose} size={14} />
              <span>{i + 1}<span className="sbf-lname"> {SHORT[lang][i]}</span></span>
            </span>
          )
        })}
      </div>
      <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'white', textAlign: 'center', lineHeight: 1.35 }}>{summary}</div>
      <div style={{ fontSize: '11.5px', color: MUTED, fontWeight: 700 }}>{lang === 'en' ? 'Tap to open the factory ▾' : 'Toque para abrir a fábrica ▾'}</div>
    </div>
  )
}
