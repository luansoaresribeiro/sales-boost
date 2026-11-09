import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-compliance.mjs
// Etapa 1 · PR 1A (2026-11-09): CRECI obrigatório para publicar + rodapé automático. Usa a ficha da própria migration.
import { licenseRule, parseLicense, licenseStatus, licenseFooter, ensureFooter, licenseBlockMessage, publishLicense, LICENSE_CHECK_FAILED } from '../supabase/functions/_shared/compliance.ts'
import { parseLicense as parseFront, licenseRule as ruleFront, licenseFooter as footerFront } from '../src/lib/license.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

const sql = readFileSync(new URL('../supabase/migrations/20261109120000_compliance_creci_ficha.sql', import.meta.url), 'utf8')
const license = JSON.parse(sql.match(/\$json\$([\s\S]*?)\$json\$/)[1])
const config = { compliance: { license }, default_language: 'pt' }
const rule = licenseRule(config)
assert.ok(rule && rule.block_publish_without && rule.verify_url); ok('a ficha da migration lê sem erro')
assert.equal(licenseRule({}), null); assert.equal(licenseRule({ compliance: { license: { ...license, pattern: '(' } } }), null); ok('sem bloco (ou com padrão quebrado) = sem regra, nada muda')

const cases = [
  ['CRECI-RJ 12345-F', '12345-F'], ['12345-J', '12345-J'], ['creci/rj nº 12.345-f', '12345-F'], ['1234 PJ', '1234-J'],
  ['12345F', '12345-F'], ['CRECI 12345', '12345'], ['  98765-f ', '98765-F'],
]
for (const [raw, want] of cases) assert.equal(parseLicense(raw, rule)?.canonical, want, raw)
ok('formatos aceitos (PF e PJ, com e sem "CRECI-RJ", com pontos e nº)')
for (const raw of ['abc', '12', 'CRECI SP 12345-F', '12345-X', 'XYZ 12345', '12345678', '.', '']) assert.equal(parseLicense(raw, rule), null, raw)
ok('formatos recusados (texto solto, curto/longo, outro estado, tipo inexistente)')
for (const [raw] of cases) assert.equal(parseFront(raw, ruleFront(config))?.canonical, parseLicense(raw, rule)?.canonical)
assert.equal(footerFront(ruleFront(config), parseFront('12345-F', ruleFront(config)), 'pt'), licenseFooter(rule, parseLicense('12345-F', rule), 'pt'))
ok('tela e servidor leem igual (e a tela mostra o mesmo rodapé que vai no post)')

assert.deepEqual(licenseStatus({}, rule), { ok: false, reason: 'missing' })
assert.deepEqual(licenseStatus({ creci: 'abc' }, rule), { ok: false, reason: 'invalid' })
assert.deepEqual(licenseStatus({ creci: 'CRECI 12345' }, rule), { ok: false, reason: 'no_type' })
assert.equal(licenseStatus({ creci: '12345-F' }, rule).ok, true); ok('situação: falta / formato inválido / sem PF-PJ / válido')

const lic = parseLicense('12345-F', rule)
const footer = licenseFooter(rule, lic, 'pt')
assert.equal(footer, 'CRECI-RJ 12345-F')
const once = ensureFooter('Apartamento no Leblon.\n\n#leblon', footer, rule, lic)
assert.equal(once, 'Apartamento no Leblon.\n\n#leblon\n\nCRECI-RJ 12345-F')
assert.equal(ensureFooter(once, footer, rule, lic), once); ok('rodapé entra uma vez só')
assert.equal(ensureFooter('Fale comigo — CRECI 12.345', footer, rule, lic), 'Fale comigo — CRECI 12.345'); ok('legenda que já cita o CRECI não repete')
assert.ok(ensureFooter('Prédio com 123456 m²', footer, rule, lic).endsWith(footer)); ok('número parecido não engana')
const long = ensureFooter('x'.repeat(2500), footer, rule, lic)
assert.ok(long.length <= 2200 && long.endsWith(footer)); ok('legenda longa: corta a legenda, nunca o rodapé (limite do Instagram)')
assert.match(licenseBlockMessage(rule, 'missing'), /informe seu CRECI/); assert.match(licenseBlockMessage(rule, 'no_type'), /pessoa física/); ok('mensagens claras')

// publishLicense com banco falso
const fake = (company, pb, err = {}) => ({ from: (t) => ({ select: () => { const q = { eq: () => q, maybeSingle: async () => t === 'companies' ? { data: company, error: err.c ?? null } : { data: pb, error: err.p ?? null } }; return q } }) })
const pb = { config }
let r = await publishLicense(fake({ vertical_key: 'imoveis_rio', playbook_answers: {} }, pb), 'x')
assert.match(r.block, /informe seu CRECI/); ok('publicação bloqueada sem CRECI')
r = await publishLicense(fake({ vertical_key: 'imoveis_rio', playbook_answers: { creci: '12345-F' } }, pb), 'x')
assert.equal(r.block, null); assert.equal(r.footer, 'CRECI-RJ 12345-F'); ok('publicação liberada com CRECI, com rodapé')
r = await publishLicense(fake({ vertical_key: 'generico', playbook_answers: {} }, pb), 'x')
assert.deepEqual([r.block, r.footer], [null, null]); ok('setor sem exigência (genérico) não muda nada')
r = await publishLicense(fake({ vertical_key: 'outro', playbook_answers: {} }, { config: {} }), 'x')
assert.deepEqual([r.block, r.footer], [null, null]); ok('ficha sem bloco de conformidade não muda nada')
r = await publishLicense(fake(null, pb, { c: { message: 'down' } }), 'x')
assert.equal(r.block, LICENSE_CHECK_FAILED); ok('erro de banco recusa (falha fechada: publicar é irreversível)')

// A trava fica só na publicação: geração (creative-generate / catalog-package) não importa este módulo.
for (const f of ['creative-generate', 'catalog-package', 'strategy-generate']) assert.ok(!readFileSync(new URL(`../supabase/functions/${f}/index.ts`, import.meta.url), 'utf8').includes('publishLicense'), f)
const aa = readFileSync(new URL('../supabase/functions/agent-actions/index.ts', import.meta.url), 'utf8')
assert.equal((aa.match(/withLicense\(/g) ?? []).length, 2); ok('geração não é bloqueada; as 2 legendas que publicam passam pelo rodapé')
console.log(`\n${n} verificações ok`)
