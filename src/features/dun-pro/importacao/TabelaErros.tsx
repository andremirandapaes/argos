import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { cn } from '@/lib/utils'
import { colunaNumerica, temaArgos } from '@/lib/aggrid'
import type { ErroValidacao } from './base-winthor'

/** Até aqui a grade cresce com o conteúdo; acima disso fica com altura fixa e rolagem. */
const LINHAS_SEM_ROLAGEM = 10

const COLUNAS: ColDef<ErroValidacao>[] = [
  {
    field: 'linha',
    headerName: 'LINHA',
    ...colunaNumerica,
    width: 90,
    valueFormatter: (p) => (p.value == null ? 'Arquivo' : String(p.value)),
  },
  { field: 'coluna', headerName: 'COLUNA', ...colunaNumerica, width: 100, valueFormatter: (p) => p.value ?? '—' },
  { field: 'mensagem', headerName: 'PROBLEMA', flex: 1, tooltipField: 'mensagem' },
]

/** Lista dos erros bloqueantes, com número da linha do arquivo. */
export function TabelaErros({ erros }: { erros: ErroValidacao[] }) {
  const autoAltura = erros.length <= LINHAS_SEM_ROLAGEM
  return (
    <div className={cn('overflow-hidden rounded-lg border', !autoAltura && 'h-[min(420px,55svh)]')}>
      <AgGridReact<ErroValidacao>
        theme={temaArgos}
        rowData={erros}
        columnDefs={COLUNAS}
        domLayout={autoAltura ? 'autoHeight' : 'normal'}
        defaultColDef={{ sortable: true, filter: true, resizable: true, suppressMovable: true }}
        tooltipShowDelay={300}
        suppressCellFocus
      />
    </div>
  )
}
