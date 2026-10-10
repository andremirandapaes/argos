// Aba Acompanhamento (Relatório Gerencial e PROFESSIONAL): meses lado a lado por departamento.
// Genérica: cada tela informa as medidas (colunas) de um bloco. Todos os valores vêm prontos
// das views (mensal, total mensal e anual/trimestral); aqui só se organiza e formata.

import type { ColDef, ColGroupDef, ValueGetterParams } from 'ag-grid-community'
import { classeNegativo, fmtMoeda, fmtPct } from '@/lib/aggrid'
import type { ColunaExcel, FormatoExcel } from '@/lib/exportar-excel'
import { formatarMes } from '@/lib/format'

/** Valores de um bloco (mês ou acumulado): campo da medida → valor. */
export type Valores = Record<string, number | null>

/** Uma coluna dentro de cada bloco de mês. */
export type Medida = {
  campo: string
  titulo: string
  formato: FormatoExcel
  largura: number
  /** classe de fundo da coluna (ex.: ag-fundo-bege-2), igual à aba Padrão */
  classe: string
  /** pinta de vermelho quando negativo */
  negativo: boolean
  /** só na linha TOTAL: texto fixo (ex.: participação "100%") */
  textoTotal?: string
}

/** Colunas do bloco no Relatório Gerencial (iguais à aba Padrão). */
export const MEDIDAS_GERENCIAL: Medida[] = [
  { campo: 'faturamento_liquido', titulo: 'FAT LÍQ', formato: 'moeda', largura: 132, classe: 'ag-fundo-bege-2', negativo: false },
  { campo: 'rentabilidade', titulo: 'MARGEM', formato: 'moeda', largura: 124, classe: 'ag-fundo-bege-1', negativo: true },
  { campo: 'rentabilidade_pct', titulo: '%', formato: 'pct', largura: 82, classe: '', negativo: true },
  { campo: 'despesa_rateada', titulo: 'DESPESA', formato: 'moeda', largura: 120, classe: '', negativo: false },
  { campo: 'lb', titulo: 'LB¹', formato: 'moeda', largura: 124, classe: 'ag-fundo-azul', negativo: true },
  { campo: 'lb_pct', titulo: '%', formato: 'pct', largura: 82, classe: '', negativo: true },
]

/** Colunas do bloco no PROFESSIONAL (iguais à aba Padrão dele: sem despesa e sem LB). */
export const MEDIDAS_PROFESSIONAL: Medida[] = [
  { campo: 'participacao', titulo: '%', formato: 'pct', largura: 82, classe: '', negativo: false, textoTotal: '100%' },
  { campo: 'faturamento_liquido', titulo: 'FAT LÍQ', formato: 'moeda', largura: 136, classe: 'ag-fundo-bege-2', negativo: false },
  { campo: 'rentabilidade', titulo: 'MARGEM', formato: 'moeda', largura: 128, classe: 'ag-fundo-bege-1', negativo: true },
  { campo: 'rentabilidade_pct', titulo: '%', formato: 'pct', largura: 82, classe: '', negativo: true },
]

export type LinhaAcompanhamento = {
  id: string
  codigo_winthor: number | null
  nome: string | null
  /** mes_ref → valores do departamento no mês (ausente = sem venda no mês) */
  porMes: Record<string, Valores>
  acumulado: Valores | null
}

/** Chave do bloco acumulado nos ids de coluna. */
export const ACUMULADO = 'acumulado'

/** Pega só os campos das medidas de um registro de view. */
export function valoresDe(registro: Record<string, unknown>, medidas: Medida[]): Valores {
  return Object.fromEntries(
    medidas.map((m) => [m.campo, typeof registro[m.campo] === 'number' ? (registro[m.campo] as number) : null]),
  )
}

/** Valores zerados (departamento listado que não vendeu no período). */
function zerados(medidas: Medida[]): Valores {
  return Object.fromEntries(medidas.map((m) => [m.campo, 0]))
}

type RegistroDepto = { departamento_id: string | null; codigo_winthor: number | null; nome: string | null }
type RegistroMes = { departamento_id: string | null; mes_ref: string | null }

/**
 * Linhas por departamento.
 * - `deptos`: quem aparece (Gerencial: quem vendeu no período; PROFESSIONAL: todos os exclusivos)
 * - `acumulados`: linhas da view anual/trimestral; departamento listado sem linha → acumulado zerado
 * - `mensais`: linhas da view mensal do período
 */
export function montarLinhas(
  deptos: RegistroDepto[],
  acumulados: (RegistroDepto & Record<string, unknown>)[],
  mensais: (RegistroMes & Record<string, unknown>)[],
  medidas: Medida[],
): LinhaAcompanhamento[] {
  const porDepto = new Map<string, Record<string, Valores>>()
  for (const m of mensais) {
    const meses = porDepto.get(m.departamento_id!) ?? {}
    meses[m.mes_ref!] = valoresDe(m, medidas)
    porDepto.set(m.departamento_id!, meses)
  }
  const acumuladoPorDepto = new Map(acumulados.map((a) => [a.departamento_id, a]))
  return deptos.map((d) => {
    const a = acumuladoPorDepto.get(d.departamento_id)
    return {
      id: d.departamento_id!,
      codigo_winthor: d.codigo_winthor,
      nome: d.nome,
      porMes: porDepto.get(d.departamento_id!) ?? {},
      acumulado: a ? valoresDe(a, medidas) : zerados(medidas),
    }
  })
}

/** Linha TOTAL: total de cada mês (view de total mensal) e do acumulado (total anual/trimestral). */
export function montarTotal(totaisMes: Record<string, Valores>, totalPeriodo: Valores | null): LinhaAcompanhamento {
  return { id: 'total', codigo_winthor: null, nome: 'TOTAL', porMes: totaisMes, acumulado: totalPeriodo }
}

/**
 * Valor de uma célula. Mês sem carga → null ("—"); departamento sem venda num mês com carga → 0
 * (na linha TOTAL, mês com carga e sem total também vira 0).
 */
export function valorCelula(
  linha: LinhaAcompanhamento | undefined,
  bloco: string,
  campo: string,
  mesesComCarga: Set<string>,
): number | null {
  if (!linha) return null
  if (bloco === ACUMULADO) return linha.acumulado?.[campo] ?? null
  if (!mesesComCarga.has(bloco)) return null
  const v = linha.porMes[bloco]
  if (!v) return 0
  return v[campo] ?? 0
}

/** Contexto da grade: quais meses têm carga (define "—" × 0). */
export type ContextoAcompanhamento = { mesesComCarga: Set<string> }

function colunasDoBloco(bloco: string, medidas: Medida[]): ColDef<LinhaAcompanhamento>[] {
  return medidas.map((m, i) => {
    // borda mais forte na primeira coluna de cada bloco (separa um mês do outro)
    const inicio = i === 0 ? 'ag-inicio-bloco' : ''
    const formatar = m.formato === 'pct' ? fmtPct : fmtMoeda
    return {
      colId: `${bloco}|${m.campo}`,
      headerName: m.titulo,
      headerClass: ['ag-centro', m.classe, inicio].filter(Boolean).join(' '),
      cellClass: ['tabular-nums text-center', m.classe, inicio].filter(Boolean).join(' '),
      // no Acumulado os valores são maiores (período inteiro): colunas de moeda mais largas
      width: bloco === ACUMULADO && m.formato === 'moeda' ? m.largura + 28 : m.largura,
      valueGetter: (p: ValueGetterParams<LinhaAcompanhamento>) =>
        valorCelula(p.data, bloco, m.campo, (p.context as ContextoAcompanhamento).mesesComCarga),
      valueFormatter: (p) =>
        m.textoTotal && p.node?.rowPinned && p.value != null ? m.textoTotal : formatar(p),
      cellClassRules: m.negativo ? classeNegativo : undefined,
      // departamentos sem valor ficam no fim em qualquer direção de ordenação
      comparator: (a: number | null, b: number | null, _na, _nb, descendente) => {
        if (a == null && b == null) return 0
        if (a == null) return descendente ? -1 : 1
        if (b == null) return descendente ? 1 : -1
        return a - b
      },
    }
  })
}

/** Colunas: CÓD. e DEPARTAMENTO fixas, um grupo por mês e o grupo Acumulado. */
export function montarColunas(
  meses: string[],
  medidas: Medida[],
): (ColDef<LinhaAcompanhamento> | ColGroupDef<LinhaAcompanhamento>)[] {
  return [
    {
      field: 'codigo_winthor',
      headerName: 'CÓD.',
      headerClass: 'ag-centro',
      cellClass: 'tabular-nums text-center',
      pinned: 'left',
      width: 76,
    },
    {
      field: 'nome',
      headerName: 'DEPARTAMENTO',
      headerClass: 'ag-centro',
      pinned: 'left',
      width: 250,
      getQuickFilterText: (p) => `${p.data?.nome ?? ''} ${p.data?.codigo_winthor ?? ''}`,
    },
    ...meses.map((m) => ({
      groupId: m,
      headerName: formatarMes(m),
      headerClass: 'ag-grupo-bloco ag-inicio-bloco',
      marryChildren: true,
      children: colunasDoBloco(m, medidas),
    })),
    {
      groupId: ACUMULADO,
      headerName: 'Acumulado',
      headerClass: 'ag-grupo-bloco ag-grupo-acumulado ag-inicio-bloco',
      marryChildren: true,
      children: colunasDoBloco(ACUMULADO, medidas).map((c) =>
        // ordenação padrão: faturamento acumulado, maior primeiro (igual à aba Padrão)
        c.colId === `${ACUMULADO}|faturamento_liquido` ? { ...c, sort: 'desc' as const } : c,
      ),
    },
  ]
}

/** Colunas do Excel na mesma ordem da grade, com o cabeçalho agrupado por mês. */
export function montarExcel(meses: string[], mesesComCarga: Set<string>, medidas: Medida[]) {
  const colunas: ColunaExcel<LinhaAcompanhamento>[] = [
    { titulo: 'Cód.', valor: (l) => l.codigo_winthor, formato: 'inteiro', largura: 8 },
    { titulo: 'DEPARTAMENTO', valor: (l) => l.nome, formato: 'texto' },
  ]
  const grupos = [{ titulo: '', colunas: 2 }]
  for (const bloco of [...meses, ACUMULADO]) {
    for (const m of medidas) {
      colunas.push({
        titulo: m.titulo,
        valor: (l) => valorCelula(l, bloco, m.campo, mesesComCarga),
        formato: m.formato,
        largura: m.formato === 'pct' ? 10 : 15,
      })
    }
    grupos.push({ titulo: bloco === ACUMULADO ? 'Acumulado' : formatarMes(bloco), colunas: medidas.length })
  }
  return { colunas, grupos }
}

/** Meses do período (ano: jan–dez; trimestre: os 3 meses dele), "AAAA-MM-01". */
export function mesesDoPeriodo(ano: number | undefined, tri: number | undefined) {
  if (!ano) return []
  const primeiro = tri ? (tri - 1) * 3 + 1 : 1
  const ultimo = tri ? primeiro + 2 : 12
  return Array.from({ length: ultimo - primeiro + 1 }, (_, i) => `${ano}-${String(primeiro + i).padStart(2, '0')}-01`)
}
