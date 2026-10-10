// Tabela do PROFESSIONAL: colunas da grade, colunas do Excel, linhas (todos os exclusivos) e linha TOTAL.

import type { ColDef } from 'ag-grid-community'
import { classeNegativo, colunaFundo, colunaNumerica, fmtMoeda, fmtPct } from '@/lib/aggrid'
import type { ColunaExcel } from '@/lib/exportar-excel'
import type { LinhaProfessional, TotalProfessional } from './api-professional'

/**
 * Todos os departamentos exclusivos, com os valores do período; quem não vendeu aparece zerado.
 * (a view traz só quem vendeu; o "left join" com a lista de exclusivos é só de exibição)
 */
export function montarLinhas(
  exclusivos: { id: string; codigo_winthor: number | null; nome: string }[],
  linhasView: LinhaProfessional[],
): LinhaProfessional[] {
  const porDepto = new Map(linhasView.map((l) => [l.departamento_id, l]))
  const linhas: LinhaProfessional[] = exclusivos.map(
    (d) =>
      porDepto.get(d.id) ?? {
        departamento_id: d.id,
        codigo_winthor: d.codigo_winthor,
        nome: d.nome,
        participacao: 0,
        faturamento_liquido: 0,
        rentabilidade: 0,
        rentabilidade_pct: 0,
      },
  )
  // segurança: alguma linha da view fora da lista de exclusivos (ex.: marcação mudou no meio da consulta)
  const ids = new Set(exclusivos.map((d) => d.id))
  for (const l of linhasView) if (!ids.has(l.departamento_id!)) linhas.push(l)
  return linhas
}

/** Linha TOTAL a partir da view de total (nunca somada aqui). */
export function linhaTotal(t: TotalProfessional | null | undefined): LinhaProfessional[] {
  if (!t) return []
  return [
    {
      departamento_id: null,
      codigo_winthor: null,
      nome: 'TOTAL',
      participacao: 1, // por definição, o total é 100% do faturamento dos exclusivos
      faturamento_liquido: t.faturamento_liquido,
      rentabilidade: t.rentabilidade,
      rentabilidade_pct: t.rentabilidade_pct,
    },
  ]
}

export const COLUNAS: ColDef<LinhaProfessional>[] = [
  { field: 'codigo_winthor', headerName: 'CÓD.', headerTooltip: 'Código do departamento no Winthor', pinned: 'left', ...colunaNumerica, width: 80 },
  {
    field: 'nome',
    headerName: 'DEPARTAMENTO',
    headerClass: 'ag-centro',
    pinned: 'left',
    minWidth: 260,
    flex: 2,
    getQuickFilterText: (p) => `${p.data?.nome ?? ''} ${p.data?.codigo_winthor ?? ''}`,
  },
  {
    field: 'participacao',
    headerName: '%',
    headerTooltip: 'Participação no faturamento dos exclusivos',
    ...colunaNumerica,
    valueFormatter: (p) => (p.node?.rowPinned ? '100%' : fmtPct(p)),
    minWidth: 90,
    flex: 0.6,
  },
  { field: 'faturamento_liquido', headerName: 'FAT LÍQ', ...colunaFundo('bege-2'), valueFormatter: fmtMoeda, sort: 'desc', minWidth: 150, flex: 1 },
  { field: 'rentabilidade', headerName: 'MARGEM', ...colunaFundo('bege-1'), valueFormatter: fmtMoeda, cellClassRules: classeNegativo, minWidth: 140, flex: 1 },
  { field: 'rentabilidade_pct', headerName: '%', ...colunaNumerica, valueFormatter: fmtPct, cellClassRules: classeNegativo, minWidth: 90, flex: 0.6 },
]

export const COLUNAS_EXCEL: ColunaExcel<LinhaProfessional>[] = [
  { titulo: 'Cód.', valor: (l) => l.codigo_winthor, formato: 'inteiro', largura: 8 },
  { titulo: 'DEPARTAMENTO', valor: (l) => l.nome, formato: 'texto' },
  { titulo: '%', valor: (l) => l.participacao, formato: 'pct', largura: 10 },
  { titulo: 'FAT LÍQ', valor: (l) => l.faturamento_liquido, formato: 'moeda' },
  { titulo: 'MARGEM', valor: (l) => l.rentabilidade, formato: 'moeda' },
  { titulo: '%', valor: (l) => l.rentabilidade_pct, formato: 'pct', largura: 10 },
]
