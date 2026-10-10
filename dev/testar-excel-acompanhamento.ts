// Teste de desenvolvimento: gera o Excel da aba Acompanhamento com os dados do seed e confere o arquivo.
// Rodar:  npx tsx dev/testar-excel-acompanhamento.ts
import * as fs from 'node:fs'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

XLSX.set_fs(fs) // no Node, a versão ESM do SheetJS precisa receber o módulo de arquivos (no navegador não)
import { exportarExcel } from '../src/lib/exportar-excel'
import { MEDIDAS_GERENCIAL, montarExcel, montarLinhas, montarTotal, valoresDe } from '../src/features/dun-pro/acompanhamento/acompanhamento-tabela'

const dados = JSON.parse(readFileSync('dev/dados-demo-2026.json', 'utf8'))
const totaisAno = dados.totais.filter((t: { mes_ref: string }) => t.mes_ref.startsWith('2026-'))
const meses = Array.from({ length: 8 }, (_, i) => `2026-0${i + 1}-01`)
const comCarga = new Set<string>(totaisAno.map((t: { mes_ref: string }) => t.mes_ref))

const linhas = montarLinhas(dados.anual, dados.anual, dados.mensal, MEDIDAS_GERENCIAL)
const doTotal = (t: Record<string, unknown> & { despesa: number | null }) => ({ ...valoresDe(t, MEDIDAS_GERENCIAL), despesa_rateada: t.despesa })
const total = montarTotal(Object.fromEntries(totaisAno.map((t: { mes_ref: string; despesa: number | null }) => [t.mes_ref, doTotal(t)])), doTotal(dados.anualTotal))
const { colunas, grupos } = montarExcel(meses, comCarga, MEDIDAS_GERENCIAL)
const arquivo = process.env.SAIDA ?? 'acompanhamento-teste.xlsx'

await exportarExcel({ arquivo, aba: 'Acompanhamento 2026', titulo: ['Teste'], colunas, grupos, linhas, total })

const ws = XLSX.readFile(arquivo).Sheets['Acompanhamento 2026']
const cel = (ref: string) => ws[ref]?.v
console.log('linha de grupos (C3, I3, AY3):', cel('C3'), '|', cel('I3'), '|', cel('AY3'))
console.log('cabeçalho (A4, B4, C4, H4):', cel('A4'), '|', cel('B4'), '|', cel('C4'), '|', cel('H4'))
console.log('mesclas:', ws['!merges']?.length, '(esperado 9: 8 meses + Acumulado)')
const ultima = XLSX.utils.decode_range(ws['!ref']!).e.r + 1
console.log(`linha TOTAL (${ultima}):`, cel(`B${ultima}`), '| Ago FAT:', cel(`AQ${ultima}`), '| Acum FAT:', cel(`AY${ultima}`), '| Acum LB:', cel(`BC${ultima}`))
console.log('departamentos exportados:', ultima - 5, '(esperado', linhas.length + ')')
