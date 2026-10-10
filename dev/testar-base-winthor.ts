// Teste de desenvolvimento do leitor da base do Winthor (sem navegador).
// Rodar:  npx tsx dev/testar-base-winthor.ts [caminho/opcional/para/um/arquivo-real.xls]
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import * as XLSX from 'xlsx'
import { caminhoNoStorage, lerArquivo, paraNumero, validarBase } from '../src/features/dun-pro/importacao/base-winthor'

let falhas = 0
function confere(nome: string, ok: boolean, detalhe?: unknown) {
  if (!ok) falhas++
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${nome}${!ok && detalhe !== undefined ? ' -> ' + JSON.stringify(detalhe) : ''}`)
}

/** Monta um File .xlsx em memória a partir de linhas (sem cabeçalho). */
function arquivo(linhas: unknown[][], nome = 'teste.xlsx') {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), 'Plan1')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new File([buf], nome)
}

/** Linha de 18 colunas no layout do Winthor. */
const linha = (cod: unknown, nome: unknown, fat: unknown, part: unknown, marg: unknown) =>
  [cod, nome, 'x', 'x', 'x', fat, part, marg, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

// ---- paraNumero ----
confere('número nativo', paraNumero(1234.5) === 1234.5)
confere('texto pt-BR com milhar', paraNumero('1.234.567,89') === 1234567.89)
confere('texto pt-BR decimal', paraNumero('25,2195') === 25.2195)
confere('texto com ponto decimal', paraNumero('513175.86') === 513175.86)
confere('texto com R$ e %', paraNumero('R$ 1.000,50') === 1000.5 && paraNumero('12,5%') === 12.5)
confere('texto não numérico', paraNumero('abc') === null && paraNumero('') === null && paraNumero(null) === null)

// ---- arquivo válido ----
{
  const f = arquivo([
    linha(91, '  SOFTYS - PROFESSIONAL ', 513175.86, 60, 25.219531),
    [],
    linha('12', 'KIMBERLY CLARK', '200.000,00', '25,5', '20'),
    linha(45, 'SANTHER', 142000, 14.5, 10),
  ])
  const linhas = await lerArquivo(f)
  confere('ignora linha vazia', linhas.length === 3, linhas.length)
  confere('mantém número real da linha', linhas.map((l) => l.numero).join(',') === '1,3,4', linhas.map((l) => l.numero))
  const r = validarBase(linhas)
  confere('arquivo válido sem erros', r.erros.length === 0, r.erros)
  confere('trim no nome', r.linhas[0].nome === 'SOFTYS - PROFESSIONAL', r.linhas[0].nome)
  confere('converte texto pt-BR', r.linhas[1].faturamento_liquido === 200000 && r.linhas[1].codigo === 12)
  const fat = 513175.86 + 200000 + 142000
  const marg = 513175.86 * 0.25219531 + 200000 * 0.2 + 142000 * 0.1
  confere('resumo faturamento', Math.abs(r.resumo.faturamento - fat) < 1e-6, r.resumo)
  confere('resumo margem', Math.abs(r.resumo.margem - marg) < 1e-6, r.resumo)
  confere('linha_original com 18 colunas', r.linhas[0].linha_original.length === 18)
}

// ---- erros ----
{
  const f = arquivo([
    linha(1.5, 'DECIMAL', 100, 50, 10), // código não inteiro
    linha(2, '', 100, 20, 10), // nome vazio
    linha(3, 'FAT TEXTO', 'abc', 10, 10), // F não numérico
    linha(4, 'MARGEM VAZIA', 100, 10, null), // H vazio
    linha(3, 'REPETIDO', 100, 10, 10), // código repetido
    [5, 'CURTA', 'x', 'x', 'x', 100], // menos de 8 colunas
  ])
  const r = validarBase(await lerArquivo(f))
  const tem = (linhaN: number, col: string | null) => r.erros.some((e) => e.linha === linhaN && e.coluna === col)
  confere('código não inteiro (linha 1, A)', tem(1, 'A'), r.erros)
  confere('nome vazio (linha 2, B)', tem(2, 'B'), r.erros)
  confere('F não numérico (linha 3, F)', tem(3, 'F'), r.erros)
  confere('H vazio (linha 4, H)', tem(4, 'H'), r.erros)
  confere('código repetido (linha 5, A)', tem(5, 'A') && r.erros.some((e) => e.linha === 5 && /repetido/.test(e.mensagem)), r.erros)
  confere('menos de 8 colunas (linha 6)', tem(6, null), r.erros)
}

// ---- soma da coluna G ----
{
  const ok = validarBase(await lerArquivo(arquivo([linha(1, 'A', 100, 99.95, 10), linha(2, 'B', 1, 0.1, 10)])))
  confere('soma G 100,05 aceita', ok.erros.length === 0, ok.erros)
  const comTotal = validarBase(
    await lerArquivo(arquivo([linha(1, 'A', 100, 60, 10), linha(2, 'B', 50, 40, 10), linha(999, 'TOTAL', 150, 100, 10)])),
  )
  confere('linha de total (soma G = 200) bloqueia', comTotal.erros.some((e) => e.coluna === 'G' && e.linha === null), comTotal.erros)
  const incompleto = validarBase(await lerArquivo(arquivo([linha(1, 'A', 100, 60, 10)])))
  confere('arquivo incompleto (soma G = 60) bloqueia', incompleto.erros.some((e) => e.coluna === 'G'), incompleto.erros)
}

// ---- caminho no Storage ----
{
  const c = caminhoNoStorage('dun-professional', '2026-08-01', 2, 'Base Agôsto (final).xls', new Date(2026, 9, 5, 14, 30, 0))
  confere('caminho do Storage', c === 'dun-professional/2026-08/v2_20261005T143000_Base_Agosto_final_.xls', c)
}

// ---- arquivo real opcional ----
const real = process.argv[2]
if (real) {
  const f = new File([readFileSync(real)], basename(real))
  const r = validarBase(await lerArquivo(f))
  console.log(`\nArquivo real ${basename(real)}: ${r.linhas.length} departamentos, ${r.erros.length} erros`)
  console.log('Resumo:', r.resumo)
  for (const e of r.erros.slice(0, 20)) console.log('  erro:', e)
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.')
process.exit(falhas ? 1 : 0)
