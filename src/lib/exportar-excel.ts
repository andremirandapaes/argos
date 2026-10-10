// Exportação de tabelas para .xlsx (SheetJS, carregado só quando o usuário exporta).
// Os valores vão como números, com formato de célula do Excel, para o usuário poder somar/filtrar.

export type FormatoExcel = 'texto' | 'inteiro' | 'moeda' | 'pct'

export type ColunaExcel<T> = {
  titulo: string
  valor: (linha: T) => string | number | null | undefined
  formato: FormatoExcel
  largura?: number
}

const FORMATO_CELULA: Record<FormatoExcel, string | undefined> = {
  texto: undefined,
  inteiro: '0',
  moeda: '"R$" #,##0.00;[Red]-"R$" #,##0.00',
  pct: '0.00%;[Red]-0.00%',
}

export async function exportarExcel<T>(opcoes: {
  arquivo: string
  aba: string
  /** linhas de título acima da tabela (ex.: "Gerencial DUN PRO — Ago/26") */
  titulo?: string[]
  colunas: ColunaExcel<T>[]
  /**
   * cabeçalho agrupado (opcional): uma linha acima dos títulos das colunas, com cada grupo mesclado
   * sobre as suas colunas (ex.: "Jan/26" sobre FAT LÍQ | MARGEM | %...). A soma de `colunas` deve cobrir todas.
   */
  grupos?: { titulo: string; colunas: number }[]
  linhas: T[]
  /** linha TOTAL (vinda da view de total, nunca somada aqui) */
  total?: T
}) {
  const XLSX = await import('xlsx')
  const { arquivo, aba, titulo = [], colunas, grupos, linhas, total } = opcoes

  const aoa: (string | number | null)[][] = []
  for (const t of titulo) aoa.push([t])
  if (titulo.length) aoa.push([])

  const mesclas: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []
  if (grupos?.length) {
    const linhaGrupos = aoa.length
    const celulas: (string | null)[] = []
    for (const g of grupos) {
      const inicio = celulas.length
      celulas.push(g.titulo, ...Array<null>(g.colunas - 1).fill(null))
      if (g.colunas > 1 && g.titulo) {
        mesclas.push({ s: { r: linhaGrupos, c: inicio }, e: { r: linhaGrupos, c: inicio + g.colunas - 1 } })
      }
    }
    aoa.push(celulas)
  }
  const linhaCabecalho = aoa.length
  aoa.push(colunas.map((c) => c.titulo))
  const primeiraLinhaDados = aoa.length
  for (const l of [...linhas, ...(total ? [total] : [])]) {
    aoa.push(colunas.map((c) => c.valor(l) ?? null))
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // formato numérico por coluna
  for (let r = primeiraLinhaDados; r < aoa.length; r++) {
    colunas.forEach((c, ci) => {
      const z = FORMATO_CELULA[c.formato]
      const cel = ws[XLSX.utils.encode_cell({ r, c: ci })]
      if (z && cel && cel.t === 'n') cel.z = z
    })
  }

  ws['!cols'] = colunas.map((c) => ({ wch: c.largura ?? (c.formato === 'texto' ? 38 : 16) }))
  if (mesclas.length) ws['!merges'] = mesclas
  // filtro só sobre os departamentos: a linha TOTAL fica fora para não ser reordenada
  const ultimaLinhaFiltro = aoa.length - 1 - (total ? 1 : 0)
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: linhaCabecalho, c: 0 }, e: { r: ultimaLinhaFiltro, c: colunas.length - 1 } }),
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, aba.slice(0, 31))
  XLSX.writeFile(wb, arquivo, { compression: true })
}
