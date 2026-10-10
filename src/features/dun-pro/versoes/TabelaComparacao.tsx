import { useMemo } from 'react'
import { AgGridReact, type CustomCellRendererProps } from 'ag-grid-react'
import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import { colunaFundo, colunaNumerica, fmtMoeda, temaArgos } from '@/lib/aggrid'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ROTULO_SITUACAO, type LinhaComparacao, type Situacao } from './api-versoes'
import { moedaComSinal, semDiferenca } from './diferenca-util'

// classes literais para o Tailwind enxergar
const COR_SITUACAO: Record<Situacao, string> = {
  alterado: 'border-alerta-foreground/30 bg-alerta text-alerta-foreground',
  novo: 'border-primary/25 bg-primary/10 text-primary',
  removido: 'border-destructive/30 bg-destructive/12 text-destructive',
  igual: 'border-transparent bg-muted text-muted-foreground',
}

export function SeloSituacao({ situacao, className }: { situacao: Situacao; className?: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium', COR_SITUACAO[situacao], className)}>
      {ROTULO_SITUACAO[situacao]}
    </Badge>
  )
}

function CelulaSituacao({ data }: CustomCellRendererProps<LinhaComparacao>) {
  if (!data) return null
  return (
    <div className="flex h-full items-center justify-center">
      <SeloSituacao situacao={data.situacao as Situacao} />
    </div>
  )
}

/** Δ: verde quando sobe, vermelho quando cai, apagado quando não muda. */
const colunaDelta = {
  ...colunaNumerica,
  valueFormatter: (p: ValueFormatterParams) => (semDiferenca(p.value ?? 0) ? '—' : moedaComSinal(p.value)),
  cellClassRules: {
    'text-positivo font-semibold': (p: { value: number }) => p.value > 0.005,
    'text-destructive font-semibold': (p: { value: number }) => p.value < -0.005,
    'text-muted-foreground': (p: { value: number }) => semDiferenca(p.value ?? 0),
  },
} satisfies Partial<ColDef>

export function TabelaComparacao({
  linhas,
  versaoA,
  versaoB,
  mensagemVazia,
}: {
  linhas: LinhaComparacao[]
  versaoA: number
  versaoB: number
  mensagemVazia: string
}) {
  const colunas = useMemo<ColDef<LinhaComparacao>[]>(
    () => [
      { field: 'codigo_winthor', headerName: 'CÓD.', ...colunaNumerica, width: 85, pinned: 'left' },
      { field: 'nome', headerName: 'DEPARTAMENTO', headerClass: 'ag-centro', minWidth: 240, flex: 2, pinned: 'left', filter: true },
      { field: 'situacao', headerName: 'SITUAÇÃO', headerClass: 'ag-centro', cellRenderer: CelulaSituacao, width: 130 },
      { field: 'faturamento_a', headerName: `FAT v${versaoA}`, ...colunaNumerica, valueFormatter: fmtMoeda, minWidth: 140, flex: 1 },
      { field: 'faturamento_b', headerName: `FAT v${versaoB}`, ...colunaFundo('bege-2'), valueFormatter: fmtMoeda, minWidth: 140, flex: 1 },
      { field: 'dif_faturamento', headerName: 'Δ FAT', ...colunaDelta, minWidth: 130, flex: 0.9 },
      { field: 'rentabilidade_a', headerName: `MARGEM v${versaoA}`, ...colunaNumerica, valueFormatter: fmtMoeda, minWidth: 140, flex: 1 },
      { field: 'rentabilidade_b', headerName: `MARGEM v${versaoB}`, ...colunaFundo('bege-1'), valueFormatter: fmtMoeda, minWidth: 140, flex: 1 },
      { field: 'dif_rentabilidade', headerName: 'Δ MARGEM', ...colunaDelta, minWidth: 130, flex: 0.9 },
    ],
    [versaoA, versaoB],
  )

  return (
    <div className="h-[max(380px,calc(100svh-30rem))] overflow-hidden rounded-xl border bg-card">
      <AgGridReact<LinhaComparacao>
        theme={temaArgos}
        rowData={linhas}
        columnDefs={colunas}
        getRowId={(p) => p.data.departamento_id}
        defaultColDef={{ sortable: true, resizable: true, suppressMovable: true, cellClass: 'tabular-nums' }}
        overlayNoRowsTemplate={`<span class="text-sm text-muted-foreground">${mensagemVazia}</span>`}
        suppressCellFocus
      />
    </div>
  )
}
