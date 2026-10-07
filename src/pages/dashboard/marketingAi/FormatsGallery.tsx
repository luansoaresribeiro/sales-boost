import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { CARD, MUTED, BORDER, D, inputStyle } from './shared'
import { STANDARD_FORMATS, type FormatDef } from './formats'
import { useLang } from '../../../contexts/LanguageContext'

const TX = {
  pt: { title: '📐 Formatos & Dimensões', d1: 'Tamanhos e placements por plataforma. O criativo é adaptado pra cada formato pelo renderizador (recompõe, não estica) — ', d2: 'trocar formato não gera nova imagem de IA', d3: '. Escolha o formato no Studio ao gerar.',
    loading: 'Carregando...', deactivate: 'Desativar', activate: 'Ativar', remove: 'Remover', custom: '+ Formato custom:', name: 'Nome', width: 'Largura', height: 'Altura', save: 'Salvar',
    presets: '🎯 Presets (campanhas multi-formato)', presetPh: 'Nome do preset (ex: Campanha Instagram)', savePreset: 'Salvar preset' },
  en: { title: '📐 Formats & Dimensions', d1: 'Sizes and placements per platform. The creative is adapted to each format by the renderer (recomposes, does not stretch) — ', d2: 'switching format does not generate a new AI image', d3: '. Pick the format in the Studio when generating.',
    loading: 'Loading...', deactivate: 'Deactivate', activate: 'Activate', remove: 'Remove', custom: '+ Custom format:', name: 'Name', width: 'Width', height: 'Height', save: 'Save',
    presets: '🎯 Presets (multi-format campaigns)', presetPh: 'Preset name (e.g. Instagram Campaign)', savePreset: 'Save preset' },
} as const

const ORANGE = '#FF6D29'

interface CustomFmt { id: string; name: string; platform: string | null; placement: string | null; ratio: string | null; w: number; h: number; active: boolean }
interface Preset { id: string; name: string; formats: { name: string; w: number; h: number; key?: string }[] }

// Preview proporcional do formato (caixa no aspect ratio real).
function Preview({ w, h }: { w: number; h: number }) {
  const box = 58, scale = Math.min(box / w, box / h)
  return (
    <div style={{ width: box, height: box, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <div style={{ width: w * scale, height: h * scale, background: 'rgba(255,109,41,0.15)', border: `1px solid ${ORANGE}`, borderRadius: '3px' }} />
    </div>
  )
}

// Biblioteca de Formatos (tamanhos/placements). O conceito é separado do
// formato — trocar formato = re-render, sem nova IA. Padrão em código; custom +
// presets no banco. Modular: novo formato/plataforma não mexe na arquitetura.
export default function FormatsGallery({ companyId }: { companyId: string }) {
  const tx = TX[useLang().lang]
  const [custom, setCustom] = useState<CustomFmt[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)
  // custom form
  const [cName, setCName] = useState(''); const [cW, setCW] = useState('1080'); const [cH, setCH] = useState('1080')
  // preset form
  const [pName, setPName] = useState(''); const [pSel, setPSel] = useState<string[]>([])

  const load = useCallback(async () => {
    const [{ data: f }, { data: p }] = await Promise.all([
      supabase.from('marketing_ai_formats').select('*').eq('company_id', companyId).order('created_at'),
      supabase.from('marketing_ai_presets').select('*').eq('company_id', companyId).order('created_at'),
    ])
    setCustom((f ?? []) as CustomFmt[]); setPresets((p ?? []) as Preset[]); setLoading(false)
  }, [companyId])
  useEffect(() => { load() }, [load])

  const addCustom = async () => {
    const w = parseInt(cW), h = parseInt(cH)
    if (!cName.trim() || !w || !h) return
    await supabase.from('marketing_ai_formats').insert({ company_id: companyId, name: cName.trim(), platform: 'Custom', placement: 'Custom', ratio: `${w}:${h}`, w, h })
    setCName(''); setCW('1080'); setCH('1080'); await load()
  }
  const toggleCustom = async (c: CustomFmt) => { await supabase.from('marketing_ai_formats').update({ active: !c.active }).eq('id', c.id); await load() }
  const delCustom = async (id: string) => { await supabase.from('marketing_ai_formats').delete().eq('id', id); await load() }

  const all: (FormatDef & { id?: string; active?: boolean })[] = [...STANDARD_FORMATS, ...custom.map(c => ({ key: 'custom:' + c.id, name: c.name, platform: c.platform ?? 'Custom', placement: c.placement ?? '', ratio: c.ratio ?? `${c.w}:${c.h}`, w: c.w, h: c.h, safe: { top: 0.06, right: 0.08, bottom: 0.09, left: 0.08 }, id: c.id, active: c.active }))]

  const togglePSel = (name: string) => setPSel(s => s.includes(name) ? s.filter(x => x !== name) : [...s, name])
  const addPreset = async () => {
    if (!pName.trim() || pSel.length === 0) return
    const fmts = all.filter(f => pSel.includes(f.name)).map(f => ({ name: f.name, w: f.w, h: f.h, key: f.key }))
    await supabase.from('marketing_ai_presets').insert({ company_id: companyId, name: pName.trim(), formats: fmts })
    setPName(''); setPSel([]); await load()
  }
  const delPreset = async (id: string) => { await supabase.from('marketing_ai_presets').delete().eq('id', id); await load() }

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>{tx.title}</div>
      <div style={{ fontSize: '11px', color: MUTED, marginBottom: '13px', maxWidth: '720px' }}>{tx.d1}<strong>{tx.d2}</strong>{tx.d3}</div>

      {loading ? <div style={{ fontSize: '12px', color: MUTED }}>{tx.loading}</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', marginBottom: '18px' }}>
          {all.map(f => (
            <div key={f.key} style={{ display: 'flex', gap: '11px', alignItems: 'center', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '11px', padding: '11px 12px', opacity: f.active === false ? 0.45 : 1 }}>
              <Preview w={f.w} h={f.h} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                <div style={{ fontSize: '9.5px', color: MUTED }}>{f.platform}{f.placement ? ` · ${f.placement}` : ''}</div>
                <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.5)' }}>{f.ratio} · {f.w}×{f.h}</div>
              </div>
              {f.id && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button onClick={() => toggleCustom(custom.find(c => c.id === f.id)!)} title={f.active ? tx.deactivate : tx.activate} style={{ background: 'transparent', border: 'none', color: f.active ? '#4ade80' : MUTED, fontSize: '11px', cursor: 'pointer' }}>{f.active ? '●' : '○'}</button>
                  <button onClick={() => delCustom(f.id!)} title={tx.remove} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '11px', cursor: 'pointer' }}>🗑</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Custom Format */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px', padding: '11px 13px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: MUTED }}>{tx.custom}</span>
        <input value={cName} onChange={e => setCName(e.target.value)} placeholder={tx.name} style={{ ...inputStyle, width: '160px' }} />
        <input value={cW} onChange={e => setCW(e.target.value)} placeholder={tx.width} style={{ ...inputStyle, width: '90px' }} />
        <span style={{ color: MUTED }}>×</span>
        <input value={cH} onChange={e => setCH(e.target.value)} placeholder={tx.height} style={{ ...inputStyle, width: '90px' }} />
        <button onClick={addCustom} disabled={!cName.trim()} style={{ padding: '8px 16px', background: cName.trim() ? ORANGE : 'rgba(255,255,255,0.08)', color: cName.trim() ? '#000' : MUTED, fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: cName.trim() ? 'pointer' : 'not-allowed', fontFamily: D }}>{tx.save}</button>
      </div>

      {/* Presets */}
      <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'white', marginBottom: '6px' }}>{tx.presets}</div>
      {presets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
          {presets.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '9px', padding: '8px 12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'white' }}>{p.name}</span>
              <span style={{ fontSize: '10px', color: MUTED, flex: 1 }}>{p.formats.map(f => f.name).join(' · ')}</span>
              <button onClick={() => delPreset(p.id)} title={tx.remove} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '11px', cursor: 'pointer' }}>🗑</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ padding: '11px 13px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '9px' }}>
          <input value={pName} onChange={e => setPName(e.target.value)} placeholder={tx.presetPh} style={{ ...inputStyle, flex: 1 }} />
          <button onClick={addPreset} disabled={!pName.trim() || pSel.length === 0} style={{ padding: '8px 16px', background: pName.trim() && pSel.length ? ORANGE : 'rgba(255,255,255,0.08)', color: pName.trim() && pSel.length ? '#000' : MUTED, fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: pName.trim() && pSel.length ? 'pointer' : 'not-allowed', fontFamily: D }}>{tx.savePreset}</button>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {all.filter(f => f.active !== false).map(f => (
            <button key={f.key} onClick={() => togglePSel(f.name)} style={{ padding: '4px 10px', borderRadius: '99px', border: `1px solid ${pSel.includes(f.name) ? ORANGE : BORDER}`, background: pSel.includes(f.name) ? 'rgba(255,109,41,0.12)' : 'transparent', color: pSel.includes(f.name) ? ORANGE : MUTED, fontSize: '10.5px', cursor: 'pointer', fontFamily: D }}>{f.name}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
