import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { colunaFundo, colunaNumerica, fmtMoeda, temaArgos } from '@/lib/aggrid'
import { formatarPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { LinhaBase } from './base-winthor'

/** Percentual como veio do Winthor (25.2195 = 25,22%). */
const pctWinthor = (v: number | null | undefined) => (v == null ? '—' : formatarPct(v / 100))

const COLUNAS: ColDef<LinhaBase>[] = [
  { field: 'numero', headerName: 'LINHA', ...colunaNumerica, width: 80, cellClass: 'tabular-nums text-center text-muted-foreground' },
  { field: 'codigo', headerName: 'CÓD.', ...colunaNumerica, width: 85 },
  { field: 'nome', headerName: 'DEPARTAMENTO', headerClass: 'ag-centro', minWidth: 240, flex: 2, filter: true },
  {
    field: 'faturamento_liquido',
    headerName: 'FAT LÍQ',
    ...colunaFundo('bege-2'),
    valueFormatter: fmtMoeda,
    sort: 'desc',
    minWidth: 150,
    flex: 1,
  },
  { field: 'participacao_pct', headerName: 'PART. %', ...colunaNumerica, valueFormatter: (p) => pctWinthor(p.value), minWidth: 100, flex: 0.6 },
  { field: 'margem_pct', headerName: 'MARGEM %', ...colunaNumerica, valueFormatter: (p) => pctWinthor(p.value), minWidth: 110, flex: 0.6 },
]

/** Até aqui a grade cresce com o conteúdo; acima disso fica com altura fixa e rolagem. */
const LINHAS_SEM_ROLAGEM = 12

/** Prévia das linhas lidas do arquivo, antes de gravar. */
export function TabelaPrevia({ linhas }: { linhas: LinhaBase[] }) {
  const autoAltura = linhas.length <= LINHAS_SEM_ROLAGEM
  return (
    <div className={cn('overflow-hidden rounded-lg border', !autoAltura && 'h-[min(460px,60svh)]')}>
      <AgGridReact<LinhaBase>
        theme={temaArgos}
        rowData={linhas}
        columnDefs={COLUNAS}
        domLayout={autoAltura ? 'autoHeight' : 'normal'}
        defaultColDef={{ sortable: true, resizable: true, suppressMovable: true, cellClass: 'tabular-nums' }}
        getRowId={(p) => String(p.data.codigo)}
        suppressCellFocus
      />
    </div>
  )
}
