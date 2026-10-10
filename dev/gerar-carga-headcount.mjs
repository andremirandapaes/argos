// Gera a migration de carga inicial do HeadCount a partir da base embutida no artefato
// "Headcount de Colaboradores" (dev/headcount-base-inicial.json).
// Uso: node dev/gerar-carga-headcount.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const base = JSON.parse(readFileSync(new URL('./headcount-base-inicial.json', import.meta.url), 'utf8'))
const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const arr = (a) => (a == null ? 'null' : `array[${a.map(q).join(', ')}]::text[]`)
const json = (v) => (v == null ? 'null' : `${q(JSON.stringify(v))}::jsonb`)
const mes = (c) => `${c}-01`

let sql = `-- =============================================================================
-- ARGOS — HeadCount: carga inicial
-- Dados migrados do artefato "Headcount de Colaboradores" (base embutida, ${base.length} bases).
-- Gerado por dev/gerar-carga-headcount.mjs — não editar à mão.
-- Rodar DEPOIS de 20261004000000_headcount.sql.
-- =============================================================================

`
let total = 0
for (const f of base) {
  const comps = [...new Set(f.rows.map((r) => r[0]))].sort()
  sql += `-- ${f.fonte} (${f.arquivo}): ${f.rows.length} linhas, ${comps[0]} a ${comps.at(-1)}\n`
  sql += `insert into public.hc_fontes (fonte, tipo, uf, ufs, resumo, arquivo, competencias, avisos, padronizacoes)\nvalues (${q(f.fonte)}, ${q(f.tipo)}, ${q(f.uf)}, ${arr(f.ufs ?? null)}, ${json(f.resumo ?? null)}, ${q(f.arquivo)}, array[${comps.map((c) => q(mes(c))).join(', ')}]::date[], ${json(f.avisos ?? [])}, ${json(f.padronizacoes ?? [])});\n`
  sql += `insert into public.hc_linhas (fonte, competencia, uf, area, distribuidora, centro, departamento, cargo, vinculo, quantidade) values\n`
  sql += f.rows
    .map((r) => `  (${q(f.fonte)}, ${q(mes(r[0]))}, ${q(r[1])}, ${q(r[2])}, ${q(r[3])}, ${q(r[4])}, ${q(r[5])}, ${q(r[6])}, ${q(r[7])}, ${r[8]})`)
    .join(',\n')
  sql += ';\n\n'
  total += f.rows.length
}
sql += `-- total: ${total} linhas\n`
writeFileSync(new URL('../supabase/migrations/20261004000100_headcount_carga_inicial.sql', import.meta.url), sql)
console.log(`gerado: ${base.length} bases, ${total} linhas`)
