import { D } from '../shared'

// CSS e constantes da fábrica dos agentes. O nome do arquivo ficou da época da CORTINA (C.2.1, 2026-11-07); a cortina e os cartões
// saíram em 2026-11-10 (dono: "sem cortina, sem cards, só os robozinhos") — a cena 3D abre direto e ocupa a aba.
export const PREVIEW_SRC = '/factory-preview.webp'   // cena estática (sem dado de cliente), aparece enquanto o 3D baixa
// Altura da cena: ocupa a tela abaixo do título da aba. No celular o dedo na cena gira a câmera (touch-action:none), então ela NUNCA
// pode passar da altura da tela — senão a pessoa não consegue rolar até o que está embaixo (ver docs/PITFALLS.md).
export const OPEN_H = 'clamp(340px, calc(100svh - 230px), 820px)'

export const FACTORY_CSS = `
.sbf-stage{position:relative;overflow:hidden;border-radius:16px;border:1px solid rgba(255,255,255,0.06);background:#0E0B0A}
.sbf-preview{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 55%;opacity:.95}
.sbf-ctl{position:absolute;z-index:7;font-family:${D};font-size:11.5px;font-weight:700;color:#BABABA;background:rgba(14,11,10,.78);border:1px solid rgba(255,255,255,.14);border-radius:99px;padding:6px 12px;cursor:pointer}
.sbf-ctl:hover,.sbf-ctl:focus-visible{color:#fff;border-color:rgba(255,255,255,.4)}
.sbf-link{background:none;border:0;padding:0;font:inherit;color:#FF6D29;text-decoration:underline;cursor:pointer}
@keyframes sbSheetUp{from{transform:translateY(100%)}to{transform:none}}
@keyframes sbPanelIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.sbf-stage *{animation:none!important}}
`
