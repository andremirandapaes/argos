// Confere o leitor da exportação do sistema (FPRE):
//  1) FPRE0082025.xlsx tem de dar exatamente a base "sistema_2025-08" que o artefato gravou (dev/headcount-base-inicial.json),
//     menos a Logística (no ARGOS ela vem só da planilha do Depósito);
//  2) mostra o resumo de outro arquivo (ex.: FPRE0082026.xlsx), para conferência manual.
// Uso: npx tsx dev/testar-leitor-sistema.ts <pasta com os FPRE>
import * as XLSX from 'xlsx'
import * as fs from 'node:fs'
import { lerExportacaoSistema, type AbaPlanilha } from '../src/features/headcount/importacao/ler-sistema'

XLSX.set_fs(fs)
const pasta = process.argv[2] ?? 'C:/Users/amiranda/Downloads'
const abas = (arq: string): AbaPlanilha[] => {
  const wb = XLSX.readFile(`${pasta}/${arq}`)
  return wb.SheetNames.map((nome) => ({ nome, linhas: XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null }) as unknown[][] }))
}
const chaveLinha = (r: unknown[]) => r.slice(0, 8).map((v) => v ?? '∅').join('|')

let falhas = 0
// 1) contra o artefato
if (fs.existsSync(`${pasta}/FPRE0082025.xlsx`)) {
  const base = JSON.parse(fs.readFileSync(new URL('./headcount-base-inicial.json', import.meta.url), 'utf8'))
  const esperado = base.find((b: { fonte: string }) => b.fonte === 'sistema_2025-08')
  const lido = lerExportacaoSistema(abas('FPRE0082025.xlsx'), 'FPRE0082025.xlsx')
  const linhas = lido.linhas.map((l) => [l.competencia, l.uf, l.area, l.distribuidora, l.centro, l.departamento, l.cargo, l.vinculo, l.quantidade])
  const semLogistica = esperado.rows.filter((r: unknown[]) => r[2] !== 'Logística')
  const a = new Map<string, number>(semLogistica.map((r: unknown[]) => [chaveLinha(r), r[8] as number]))
  const b = new Map<string, number>(linhas.map((r) => [chaveLinha(r), r[8] as number]))
  const difs = [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k) !== b.get(k))
  const igual = (rot: string, x: unknown, y: unknown) => {
    const ok = JSON.stringify(x) === JSON.stringify(y)
    if (!ok) falhas++
    console.log(`  ${ok ? 'ok ' : 'DIF'} ${rot}${ok ? '' : `\n      artefato: ${JSON.stringify(x)}\n      ARGOS:    ${JSON.stringify(y)}`}`)
  }
  console.log('FPRE0082025.xlsx × base do artefato (sistema_2025-08):')
  console.log(`  ${difs.length ? 'DIF' : 'ok '} linhas (sem Logística): ${semLogistica.length} no artefato, ${linhas.length} no ARGOS${difs.length ? ' — ex.: ' + difs.slice(0, 4).join(' / ') : ''}`)
  if (difs.length) falhas++
  igual('fonte', esperado.fonte, lido.fonte)
  igual('ufs', esperado.ufs, lido.ufs)
  igual('padronizações', esperado.padronizacoes, lido.padronizacoes)
  console.log('  (resumo e avisos mudam de propósito: Logística e Contact Center fora)', JSON.stringify(lido.resumo), lido.avisos)
}

// 2) resumo de conferência dos demais arquivos
for (const arq of fs.readdirSync(pasta).filter((f) => /^FPRE\d+\.xlsx$/i.test(f) && f !== 'FPRE0082025.xlsx')) {
  const lido = lerExportacaoSistema(abas(arq), arq)
  console.log(`\n${arq} → ${lido.fonte} · UFs ${lido.ufs.join('/')} · colaboradores no painel ${JSON.stringify(lido.resumo)}`)
  const soma = new Map<string, number>()
  for (const l of lido.linhas) {
    const k = l.area === 'Comercial' ? `${l.uf} Comercial ${l.distribuidora} ${l.centro}` : `${l.uf} ${l.area} ${l.departamento}`
    soma.set(k, (soma.get(k) || 0) + l.quantidade)
  }
  for (const [k, n] of [...soma].sort((x, y) => x[0].localeCompare(y[0]))) console.log(`  ${k.padEnd(48)} ${n}`)
  console.log('  avisos:', lido.avisos.length ? '' : 'nenhum')
  lido.avisos.forEach((a) => console.log('   -', a))
  console.log('  padronizações:', JSON.stringify(lido.padronizacoes))
}
console.log(falhas ? `\n${falhas} DIFERENÇA(S)` : '\nLeitor confere com o artefato.')
