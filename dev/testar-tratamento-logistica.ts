// Confere o tratamento da Logística (de Set/26 em diante a Logística vem do sistema):
// lê o FPRE de um mês como se fosse a partir de Set/26 e compara o Depósito, cargo a cargo,
// com a coluna do mesmo mês da planilha auditada "Folha - Depósito.xlsx".
// Uso: npx tsx dev/testar-tratamento-logistica.ts [pasta] [FPRE] [coluna do mês na planilha, ex.: 8 = Ago/26]
import * as XLSX from 'xlsx'
import * as fs from 'node:fs'
import { chave, lerExportacaoSistema } from '../src/features/headcount/importacao/ler-sistema'

XLSX.set_fs(fs)
const pasta = process.argv[2] ?? 'C:/Users/amiranda/Downloads'
const fpre = process.argv[3] ?? 'FPRE0082026.xlsx'
const coluna = Number(process.argv[4] ?? 8)
const wb = XLSX.readFile(`${pasta}/${fpre}`)
const abas = wb.SheetNames.map((nome) => ({ nome, linhas: XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null }) as unknown[][] }))
const lido = lerExportacaoSistema(abas, fpre, { competencia: '2026-09' })
const dep = XLSX.readFile(`${pasta}/Folha - Depósito.xlsx`)

let falhas = 0
for (const uf of ['AM', 'RR'] as const) {
  const sistema = new Map<string, number>()
  let distribuicao = 0
  for (const l of lido.linhas) {
    if (l.uf !== uf || l.area !== 'Logística') continue
    if (l.departamento === 'Depósito') sistema.set(chave(l.cargo), (sistema.get(chave(l.cargo)) || 0) + l.quantidade)
    else distribuicao += l.quantidade
  }
  const planilha = new Map<string, number>()
  let totalPlanilha = 0
  for (const r of XLSX.utils.sheet_to_json(dep.Sheets[uf], { header: 1, raw: true, defval: null }) as unknown[][]) {
    const nome = typeof r[0] === 'string' ? chave(r[0]) : ''
    if (!nome || nome === 'CARGO' || nome.startsWith('QUADRO') || nome.startsWith('TERCE') || nome.startsWith('TOTAL EM')) continue
    if (nome === 'TOTAL GERAL') { totalPlanilha = Number(r[coluna]); continue }
    if (Number(r[coluna]) > 0) planilha.set(nome, Number(r[coluna]))
  }
  const totalSistema = [...sistema.values()].reduce((a, b) => a + b, 0)
  console.log(`\n${uf}: Depósito no sistema (com tratamento) ${totalSistema} × planilha auditada ${totalPlanilha} · Distribuição ${distribuicao}`)
  for (const c of [...new Set([...sistema.keys(), ...planilha.keys()])].sort()) {
    const a = sistema.get(c) ?? 0
    const b = planilha.get(c) ?? 0
    if (a !== b) falhas++
    console.log(`  ${a === b ? 'ok ' : 'DIF'} ${c.padEnd(32)} sistema ${String(a).padStart(3)}  planilha ${String(b).padStart(3)}`)
  }
  if (totalSistema !== totalPlanilha) falhas++
}
console.log('\navisos:', lido.avisos.filter((a) => /Logística|Distribuição/.test(a)))
console.log(falhas ? `\n${falhas} diferença(s)` : '\nTratamento reproduz a planilha auditada do Depósito.')
