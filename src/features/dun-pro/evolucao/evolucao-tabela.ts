// Tabela da Evolução: uma linha por mês (vw_gerencial_mensal_total) e a linha TOTAL do ano
// (vw_gerencial_anual_total). Tudo vem pronto das views.

import type { ColDef } from 'ag-grid-community'
import { classeNegativo, colunaFundo, colunaNumerica, fmtMoeda, fmtPct } from '@/lib/aggrid'
import type { ColunaExcel } from '@/lib/exportar-excel'
import { formatarMes } from '@/lib/format'
import type { TotalMensal } from '../api'
import type { Totais } from '../gerencial-tabela'

export type LinhaEvolucao = {
  id: string
  mes: string
  faturamento_liquido: number | null
  rentabilidade: number | null
  rentabilidade_pct: number | null
  despesa: number | null
  custo_op_pct: number | null
  lb: number | null
  lb_pct: number | null
}

export function linhaDoMes(t: TotalMensal): LinhaEvolucao {
  return {
    id: t.mes_ref!,
    mes: formatarMes(t.mes_ref),
    faturamento_liquido: t.faturamento_liquido,
    rentabilidade: t.rentabilidade,
    rentabilidade_pct: t.rentabilidade_pct,
    despesa: t.despesa,
    // sem despesa lançada, o custo operacional não existe ("—")
    custo_op_pct: t.despesa == null ? null : t.custo_op_pct,
    lb: t.lb,
    lb_pct: t.lb_pct,
  }
}

/** Linha TOTAL: total do ano (vw_gerencial_anual_total) ou dos meses selecionados (resumo_gerencial_periodo). */
export function linhaTotal(t: Totais | null | undefined): LinhaEvolucao[] {
  if (!t) return []
  return [
    {
      id: 'total',
      mes: 'TOTAL',
      faturamento_liquido: t.faturamento_liquido,
      rentabilidade: t.rentabilidade,
      rentabilidade_pct: t.rentabilidade_pct,
      despesa: t.despesa,
      custo_op_pct: t.custo_op_pct,
      lb: t.lb,
      lb_pct: t.lb_pct,
    },
  ]
}

export const COLUNAS: ColDef<LinhaEvolucao>[] = [
  { field: 'mes', headerName: 'MÊS', headerClass: 'ag-centro', cellClass: 'font-medium', width: 110, pinned: 'left', sortable: false },
  { field: 'faturamento_liquido', headerName: 'FAT LÍQ', ...colunaFundo('bege-2'), valueFormatter: fmtMoeda, minWidth: 150, flex: 1 },
  { field: 'rentabilidade', headerName: 'MARGEM', ...colunaFundo('bege-1'), valueFormatter: fmtMoeda, cellClassRules: classeNegativo, minWidth: 140, flex: 1 },
  { field: 'rentabilidade_pct', headerName: '%', ...colunaNumerica, valueFormatter: fmtPct, cellClassRules: classeNegativo, minWidth: 85, flex: 0.6 },
  { field: 'despesa', headerName: 'DESPESA', ...colunaNumerica, valueFormatter: fmtMoeda, minWidth: 140, flex: 1 },
  { field: 'custo_op_pct', headerName: 'CUSTO OP.', headerTooltip: 'Despesa ÷ faturamento', ...colunaNumerica, valueFormatter: fmtPct, minWidth: 105, flex: 0.7 },
  { field: 'lb', headerName: 'LB¹', ...colunaFundo('azul'), valueFormatter: fmtMoeda, cellClassRules: classeNegativo, minWidth: 140, flex: 1 },
  { field: 'lb_pct', headerName: '%', ...colunaNumerica, valueFormatter: fmtPct, cellClassRules: classeNegativo, minWidth: 85, flex: 0.6 },
]

export const COLUNAS_EXCEL: ColunaExcel<LinhaEvolucao>[] = [
  { titulo: 'MÊS', valor: (l) => l.mes, formato: 'texto', largura: 10 },
  { titulo: 'FAT LÍQ', valor: (l) => l.faturamento_liquido, formato: 'moeda' },
  { titulo: 'MARGEM', valor: (l) => l.rentabilidade, formato: 'moeda' },
  { titulo: '%', valor: (l) => l.rentabilidade_pct, formato: 'pct', largura: 10 },
  { titulo: 'DESPESA', valor: (l) => l.despesa, formato: 'moeda' },
  { titulo: 'CUSTO OP.', valor: (l) => l.custo_op_pct, formato: 'pct', largura: 11 },
  { titulo: 'LB¹', valor: (l) => l.lb, formato: 'moeda' },
  { titulo: '%', valor: (l) => l.lb_pct, formato: 'pct', largura: 10 },
]
