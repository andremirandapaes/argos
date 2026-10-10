// Importação da lista "código Winthor × departamento": leitura do arquivo e casamento com os
// departamentos cadastrados. Funções puras (a tela só exibe a prévia e grava o que o usuário confirmar).

import { paraNumero } from '../../../lib/numero'

export type ItemLista = { linha: number; codigo: number; nome: string }

export type SituacaoCodigo =
  | 'preencher' // departamento sem código; o código está livre → será gravado
  | 'ja-correto' // departamento já tem exatamente esse código
  | 'codigo-diferente' // departamento já tem outro código → mantém o atual
  | 'codigo-em-uso' // o código já pertence a outro departamento
  | 'nao-encontrado' // nenhum departamento com esse nome

export type ResultadoItem = ItemLista & {
  situacao: SituacaoCodigo
  departamentoId: string | null
  codigoAtual: number | null
  /** nome do departamento que já usa o código (situação codigo-em-uso) */
  donoDoCodigo: string | null
}

/** Normaliza nomes para comparar: maiúsculas, sem acentos, espaços simples. */
export function normalizarNome(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Lê a lista da primeira aba (.xlsx/.xls/.csv). Duas colunas, em qualquer ordem: a numérica é o código,
 * a outra é o nome. Linha de cabeçalho e linhas vazias são ignoradas.
 */
export async function lerLista(arquivo: File): Promise<{ itens: ItemLista[]; ignoradas: number[] }> {
  const XLSX = await import('xlsx')
  const texto = arquivo.name.toLowerCase().endsWith('.csv') ? await arquivo.text() : null
  const wb = texto != null
    ? XLSX.read(texto, { type: 'string', FS: texto.includes(';') ? ';' : ',' })
    : XLSX.read(await arquivo.arrayBuffer(), { type: 'array' })
  const aba = wb.Sheets[wb.SheetNames[0]]
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: true, blankrows: true })

  const itens: ItemLista[] = []
  const ignoradas: number[] = []
  linhas.forEach((celulas, i) => {
    const valores = (celulas ?? []).filter((c) => c != null && String(c).trim() !== '')
    if (valores.length === 0) return
    const codigo = valores.map((v) => paraNumero(v as string | number)).find((n) => n != null && Number.isInteger(n))
    const nome = valores.find((v) => paraNumero(v as string | number) == null)
    if (codigo == null || nome == null) {
      // cabeçalho ("nome;codigo") ou linha incompleta
      ignoradas.push(i + 1)
      return
    }
    itens.push({ linha: i + 1, codigo, nome: String(nome).trim() })
  })
  return { itens, ignoradas }
}

/** Casa cada item da lista com os departamentos cadastrados (pelo nome normalizado). */
export function casarLista(
  itens: ItemLista[],
  departamentos: { id: string; nome: string; codigo_winthor: number | null }[],
): ResultadoItem[] {
  const porNome = new Map(departamentos.map((d) => [normalizarNome(d.nome), d]))
  const porCodigo = new Map(
    departamentos.filter((d) => d.codigo_winthor != null).map((d) => [d.codigo_winthor!, d]),
  )
  // códigos que esta própria lista vai gravar (evita gravar o mesmo código em dois departamentos)
  const reservados = new Set<number>()

  return itens.map((item) => {
    const depto = porNome.get(normalizarNome(item.nome))
    const base = { ...item, departamentoId: depto?.id ?? null, codigoAtual: depto?.codigo_winthor ?? null, donoDoCodigo: null }
    if (!depto) return { ...base, situacao: 'nao-encontrado' as const }
    if (depto.codigo_winthor === item.codigo) return { ...base, situacao: 'ja-correto' as const }
    if (depto.codigo_winthor != null) return { ...base, situacao: 'codigo-diferente' as const }
    const dono = porCodigo.get(item.codigo)
    if ((dono && dono.id !== depto.id) || reservados.has(item.codigo)) {
      return { ...base, situacao: 'codigo-em-uso' as const, donoDoCodigo: dono?.nome ?? 'outra linha desta lista' }
    }
    reservados.add(item.codigo)
    return { ...base, situacao: 'preencher' as const }
  })
}
