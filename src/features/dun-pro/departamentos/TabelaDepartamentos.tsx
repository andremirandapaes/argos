import { AgGridReact, type CustomCellRendererProps } from 'ag-grid-react'
import type { CellValueChangedEvent, ColDef } from 'ag-grid-community'
import { Pencil } from 'lucide-react'
import { colunaNumerica, temaArgos } from '@/lib/aggrid'
import { formatarDataHora } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import type { Departamento } from './api-departamentos'

export type ContextoDepartamentos = {
  podeEditar: boolean
  onExclusivo: (depto: Departamento, exclusivo: boolean) => void
  /** grava o código; se rejeitar, a célula volta ao valor anterior */
  onCodigo: (depto: Departamento, codigo: number) => Promise<void>
}

type Celula = CustomCellRendererProps<Departamento, unknown, ContextoDepartamentos>

/** Código Winthor; "sem código" vira campo editável (um clique) para quem pode editar. */
function CelulaCodigo({ data, context }: Celula) {
  if (!data) return null
  if (data.codigo_winthor != null) return <span className="tabular-nums">{data.codigo_winthor}</span>
  return (
    <div className="flex h-full items-center justify-center gap-1.5">
      <Badge variant="outline" className="border-alerta-foreground/30 bg-alerta font-normal text-alerta-foreground">
        sem código
      </Badge>
      {context.podeEditar && <Pencil className="size-3.5 text-muted-foreground" aria-label="Clique para definir o código" />}
    </div>
  )
}

function CelulaExclusivo({ data, context }: Celula) {
  if (!data) return null
  return (
    <div className="flex h-full items-center justify-center">
      <Switch
        size="sm"
        checked={data.exclusivo_professional}
        disabled={!context.podeEditar}
        aria-label={`Exclusivo PROFESSIONAL: ${data.nome}`}
        onCheckedChange={(ligado) => context.onExclusivo(data, ligado)}
      />
    </div>
  )
}

const COLUNAS: ColDef<Departamento>[] = [
  {
    field: 'codigo_winthor',
    headerName: 'CÓD. WINTHOR',
    headerTooltip: 'Departamentos do histórico sem código: clique para digitar o código',
    ...colunaNumerica,
    cellRenderer: CelulaCodigo,
    width: 170,
    // só "sem código" é editável (código existente vem do Winthor e não se troca aqui)
    editable: (p) => !!(p.context as ContextoDepartamentos).podeEditar && p.data?.codigo_winthor == null,
    cellEditor: 'agNumberCellEditor',
    cellEditorParams: { min: 1, precision: 0, showStepperButtons: false },
  },
  {
    field: 'nome',
    headerName: 'DEPARTAMENTO',
    headerClass: 'ag-centro',
    minWidth: 280,
    flex: 2,
    getQuickFilterText: (p) => `${p.data?.nome ?? ''} ${p.data?.codigo_winthor ?? ''}`,
  },
  {
    field: 'exclusivo_professional',
    headerName: 'EXCLUSIVO PROFESSIONAL',
    headerClass: 'ag-centro',
    cellRenderer: CelulaExclusivo,
    width: 210,
  },
  {
    field: 'atualizado_em',
    headerName: 'ATUALIZADO EM',
    ...colunaNumerica,
    valueFormatter: (p) => formatarDataHora(p.value),
    width: 170,
  },
]

export function TabelaDepartamentos({
  departamentos,
  contexto,
  busca,
  carregando,
}: {
  departamentos: Departamento[]
  contexto: ContextoDepartamentos
  busca: string
  carregando: boolean
}) {
  function aoEditar(e: CellValueChangedEvent<Departamento>) {
    const codigo = Number(e.newValue)
    if (e.oldValue === e.newValue || !Number.isInteger(codigo) || codigo <= 0) {
      e.node.setDataValue('codigo_winthor', e.oldValue) // valor inválido: desfaz
      return
    }
    // grava; se der erro (ex.: código já usado), desfaz a edição na tela
    contexto
      .onCodigo({ ...e.data, codigo_winthor: e.oldValue }, codigo)
      .catch(() => e.node.setDataValue('codigo_winthor', e.oldValue))
  }

  return (
    <div className="h-[max(420px,calc(100svh-22rem))] overflow-hidden rounded-xl border bg-card">
      <AgGridReact<Departamento>
        theme={temaArgos}
        rowData={departamentos}
        columnDefs={COLUNAS}
        context={contexto}
        getRowId={(p) => p.data.id}
        defaultColDef={{ sortable: true, resizable: true, suppressMovable: true, cellClass: 'tabular-nums', getQuickFilterText: () => '' }}
        quickFilterText={busca}
        singleClickEdit
        stopEditingWhenCellsLoseFocus
        onCellValueChanged={aoEditar}
        loading={carregando}
        localeText={{ noMatchingRows: 'Nenhum departamento encontrado.' }}
        overlayNoRowsTemplate="<span class='text-sm text-muted-foreground'>Nenhum departamento.</span>"
        tooltipShowDelay={300}
      />
    </div>
  )
}
