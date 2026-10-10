// Leitura e validação da base mensal do Winthor (faturamento por departamento).
// Funções puras, sem React: a tela só chama lerArquivo() e validarBase().
//
// O arquivo NÃO tem cabeçalho; a leitura é por posição (índice 0):
//   A (0) código do departamento · B (1) nome · F (5) faturamento líquido
//   G (6) participação % (só validação) · H (7) margem % (ex.: 25.2195)

import type { WorkBook } from 'xlsx'
import { paraNumero } from '../../../lib/numero'

export const COLUNAS_MINIMAS = 8
/** A soma da coluna G precisa ficar nesta faixa para o arquivo ser considerado completo. */
export const SOMA_PARTICIPACAO = { min: 99.9, max: 100.1 }

const COL = { codigo: 0, nome: 1, faturamento: 5, participacao: 6, margem: 7 } as const

export type Celula = string | number | boolean | null

/** Linha crua da planilha, com o número dela no arquivo (1 = primeira linha do Excel). */
export type LinhaArquivo = { numero: number; celulas: Celula[] }

/** Linha pronta para o RPC registrar_carga_faturamento. */
export type LinhaBase = {
  numero: number
  codigo: number
  nome: string
  faturamento_liquido: number
  participacao_pct: number
  margem_pct: number
  linha_original: Celula[]
}

export type ErroValidacao = {
  /** número da linha no arquivo; null para erros do arquivo inteiro */
  linha: number | null
  coluna: string | null
  mensagem: string
}

export type ResumoBase = {
  qtdDepartamentos: number
  faturamento: number
  /** Σ F × H / 100 — prévia; o valor oficial é recalculado pelo banco ao gravar */
  margem: number
  margemPct: number
  somaParticipacao: number
}

export type ResultadoValidacao = {
  linhas: LinhaBase[]
  erros: ErroValidacao[]
  resumo: ResumoBase
}

export { paraNumero }

function vazia(c: Celula | undefined) {
  return c == null || (typeof c === 'string' && c.trim() === '')
}

/** Lê a primeira aba do arquivo (.xls ou .xlsx) como linhas cruas, ignorando linhas totalmente vazias. */
export async function lerArquivo(arquivo: File): Promise<LinhaArquivo[]> {
  const XLSX = await import('xlsx')
  const wb: WorkBook = XLSX.read(await arquivo.arrayBuffer(), { type: 'array' })
  const aba = wb.Sheets[wb.SheetNames[0]]
  if (!aba || !aba['!ref']) return []

  const primeiraLinha = XLSX.utils.decode_range(aba['!ref']).s.r
  // blankrows: true mantém o índice alinhado ao número real da linha no Excel
  const linhas = XLSX.utils.sheet_to_json<Celula[]>(aba, { header: 1, raw: true, blankrows: true })

  const resultado: LinhaArquivo[] = []
  linhas.forEach((celulas, i) => {
    // células no meio da linha podem vir como "buracos" (undefined): normaliza para null
    const normalizadas = Array.from(celulas ?? [], (c) => (c === undefined ? null : c))
    if (normalizadas.every(vazia)) return
    resultado.push({ numero: primeiraLinha + i + 1, celulas: normalizadas })
  })
  return resultado
}

/** Aplica as validações bloqueantes e monta as linhas para gravação. */
export function validarBase(linhasArquivo: LinhaArquivo[]): ResultadoValidacao {
  const erros: ErroValidacao[] = []
  const linhas: LinhaBase[] = []
  const vistos = new Map<number, number>() // código → linha onde apareceu primeiro

  if (linhasArquivo.length === 0) {
    erros.push({ linha: null, coluna: null, mensagem: 'O arquivo não tem nenhuma linha preenchida na primeira aba.' })
  }

  for (const { numero, celulas } of linhasArquivo) {
    const errosLinha: ErroValidacao[] = []
    const erro = (coluna: string | null, mensagem: string) => errosLinha.push({ linha: numero, coluna, mensagem })

    if (celulas.length < COLUNAS_MINIMAS) {
      erro(null, `A linha tem ${celulas.length} colunas; o mínimo é ${COLUNAS_MINIMAS} (A até H).`)
    }

    const codigo = paraNumero(celulas[COL.codigo])
    if (codigo == null || !Number.isInteger(codigo)) {
      erro('A', `Código do departamento inválido: "${celulas[COL.codigo] ?? ''}" (precisa ser um número inteiro).`)
    }

    const nome = typeof celulas[COL.nome] === 'string' ? (celulas[COL.nome] as string).trim() : String(celulas[COL.nome] ?? '').trim()
    if (!nome) erro('B', 'Nome do departamento vazio.')

    const faturamento = paraNumero(celulas[COL.faturamento])
    if (faturamento == null) erro('F', `Faturamento líquido não é numérico: "${celulas[COL.faturamento] ?? ''}".`)

    const participacao = paraNumero(celulas[COL.participacao])
    if (participacao == null) erro('G', `Participação % não é numérica: "${celulas[COL.participacao] ?? ''}".`)

    const margem = paraNumero(celulas[COL.margem])
    if (margem == null) erro('H', `Margem % não é numérica: "${celulas[COL.margem] ?? ''}".`)

    if (codigo != null && Number.isInteger(codigo)) {
      const anterior = vistos.get(codigo)
      if (anterior != null) erro('A', `Código ${codigo} repetido (já aparece na linha ${anterior}).`)
      else vistos.set(codigo, numero)
    }

    if (errosLinha.length) {
      erros.push(...errosLinha)
      continue
    }
    linhas.push({
      numero,
      codigo: codigo!,
      nome,
      faturamento_liquido: faturamento!,
      participacao_pct: participacao!,
      margem_pct: margem!,
      linha_original: celulas,
    })
  }

  // prévia (somas simples das linhas do arquivo; o banco recalcula tudo ao gravar)
  const faturamento = linhas.reduce((s, l) => s + l.faturamento_liquido, 0)
  const margem = linhas.reduce((s, l) => s + (l.faturamento_liquido * l.margem_pct) / 100, 0)
  const somaParticipacao = linhas.reduce((s, l) => s + l.participacao_pct, 0)

  // só confere a soma da coluna G quando todas as linhas são válidas (senão a soma já estaria incompleta)
  if (linhasArquivo.length > 0 && erros.length === 0) {
    const soma = Math.round(somaParticipacao * 10000) / 10000
    if (soma < SOMA_PARTICIPACAO.min || soma > SOMA_PARTICIPACAO.max) {
      erros.push({
        linha: null,
        coluna: 'G',
        mensagem: `A soma da participação (coluna G) é ${soma.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}; deveria estar entre ${SOMA_PARTICIPACAO.min.toLocaleString('pt-BR')} e ${SOMA_PARTICIPACAO.max.toLocaleString('pt-BR')}. O arquivo pode estar incompleto ou ter uma linha de total.`,
      })
    }
  }

  return {
    linhas,
    erros,
    resumo: {
      qtdDepartamentos: linhas.length,
      faturamento,
      margem,
      margemPct: faturamento ? margem / faturamento : 0,
      somaParticipacao,
    },
  }
}

/** Remove acentos e caracteres que o Storage não aceita no nome do arquivo. */
export function nomeSeguroParaStorage(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
}

/** "2026-08-01", 2, 27/09/2026 14:30:00 → "dun-professional/2026-08/v2_20260927T143000_1464_prof_agosto.xls" */
export function caminhoNoStorage(slug: string, mesRef: string, versao: number, nomeArquivo: string, agora = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  const carimbo = `${agora.getFullYear()}${p(agora.getMonth() + 1)}${p(agora.getDate())}T${p(agora.getHours())}${p(agora.getMinutes())}${p(agora.getSeconds())}`
  return `${slug}/${mesRef.slice(0, 7)}/v${versao}_${carimbo}_${nomeSeguroParaStorage(nomeArquivo)}`
}
