// Definição da tabela do Relatório gerencial (colunas da grade, colunas do Excel e linha TOTAL).

import type { ColDef } from 'ag-grid-community'
import { classeNegativo, colunaFundo, colunaNumerica, fmtMoeda, fmtPct } from '@/lib/aggrid'
import type { ColunaExcel } from '@/lib/exportar-excel'

/** Formato comum às linhas mensais e anuais (e à linha TOTAL) exibido na tabela. */
export type LinhaTabela = {
  departamento_id: string | null
  codigo_winthor: number | null
  nome: string | null
  participacao: number | null
  faturamento_liquido: number | null
  rentabilidade: number | null
  rentabilidade_pct: number | null
  despesa_rateada: number | null
  lb: number | null
  lb_pct: number | null
}

/** Totais usados nos cards: mesmo formato em vw_gerencial_mensal_total e vw_gerencial_anual_total. */
export type Totais = {
  faturamento_liquido: number | null
  rentabilidade: number | null
  rentabilidade_pct: number | null
  despesa: number | null
  lb: number | null
  lb_pct: number | null
  custo_op_pct: number | null
}

/** Linha TOTAL da grade, montada a partir da view de total (nunca somada no front). */
export function linhaTotal(t: Totais | null | undefined): LinhaTabela[] {
  if (!t) return []
  return [
    {
      departamento_id: null,
      codigo_winthor: null,
      nome: 'TOTAL',
      participacao: 1, // por definição, o total é 100% do faturamento
      faturamento_liquido: t.faturamento_liquido,
      rentabilidade: t.rentabilidade,
      rentabilidade_pct: t.rentabilidade_pct,
      despesa_rateada: t.despesa,
      lb: t.lb,
      lb_pct: t.lb_pct,
    },
  ]
}

export const COLUNAS: ColDef<LinhaTabela>[] = [
  {
    field: 'codigo_winthor',
    headerName: 'CÓD.',
    headerTooltip: 'Código do departamento no Winthor',
    pinned: 'left',
    ...colunaNumerica,
    width: 80,
    minWidth: 70,
    maxWidth: 100,
  },
  {
    field: 'nome',
    headerName: 'DEPARTAMENTO',
    headerClass: 'ag-centro',
    pinned: 'left',
    minWidth: 260,
    flex: 2,
    // a busca olha só nome e código (as demais colunas devolvem '' no defaultColDef)
    getQuickFilterText: (p) => `${p.data?.nome ?? ''} ${p.data?.codigo_winthor ?? ''}`,
  },
  { field: 'faturamento_liquido', headerName: 'FAT LÍQ', ...colunaFundo('bege-2'), valueFormatter: fmtMoeda, sort: 'desc', minWidth: 150, flex: 1 },
  { field: 'rentabilidade', headerName: 'MARGEM', ...colunaFundo('bege-1'), valueFormatter: fmtMoeda, cellClassRules: classeNegativo, minWidth: 140, flex: 1 },
  { field: 'rentabilidade_pct', headerName: '%', ...colunaNumerica, valueFormatter: fmtPct, cellClassRules: classeNegativo, minWidth: 90, flex: 0.6 },
  { field: 'despesa_rateada', headerName: 'DESPESA', ...colunaNumerica, valueFormatter: fmtMoeda, minWidth: 140, flex: 1 },
  { field: 'lb', headerName: 'LB¹', ...colunaFundo('azul'), valueFormatter: fmtMoeda, cellClassRules: classeNegativo, minWidth: 140, flex: 1 },
  { field: 'lb_pct', headerName: '%', ...colunaNumerica, valueFormatter: fmtPct, cellClassRules: classeNegativo, minWidth: 90, flex: 0.6 },
]

export const COLUNAS_EXCEL: ColunaExcel<LinhaTabela>[] = [
  { titulo: 'Cód.', valor: (l) => l.codigo_winthor, formato: 'inteiro', largura: 8 },
  { titulo: 'DEPARTAMENTO', valor: (l) => l.nome, formato: 'texto' },
  { titulo: 'FAT LÍQ', valor: (l) => l.faturamento_liquido, formato: 'moeda' },
  { titulo: 'MARGEM', valor: (l) => l.rentabilidade, formato: 'moeda' },
  { titulo: '%', valor: (l) => l.rentabilidade_pct, formato: 'pct', largura: 10 },
  { titulo: 'DESPESA', valor: (l) => l.despesa_rateada, formato: 'moeda' },
  { titulo: 'LB¹', valor: (l) => l.lb, formato: 'moeda' },
  { titulo: '%', valor: (l) => l.lb_pct, formato: 'pct', largura: 10 },
]
