import { useEffect, useRef } from 'react'
import { AgGridReact, type CustomCellRendererProps } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { Download, History } from 'lucide-react'
import { colunaFundo, colunaNumerica, fmtMoeda, temaArgos } from '@/lib/aggrid'
import { formatarDataHora } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Carga } from './api-versoes'

/** O que a tabela precisa da página (passado pelo context do AG Grid). */
export type ContextoVersoes = {
  nomes: Map<string, string | null> | undefined
  podeEditar: boolean
  onBaixar: (carga: Carga) => void
  onTornarVigente: (carga: Carga) => void
}

type Celula = CustomCellRendererProps<Carga, unknown, ContextoVersoes>

function CelulaVersao({ data }: Celula) {
  if (!data) return null
  return (
    <div className="flex h-full items-center gap-2 pl-3">
      <span className="font-semibold">v{data.versao}</span>
      {data.vigente && <Badge className="h-5 px-2 text-[11px]">VIGENTE</Badge>}
    </div>
  )
}

function CelulaOrigem({ data }: Celula) {
  if (!data) return null
  return (
    <div className="flex h-full items-center justify-center">
      <Badge variant={data.origem === 'upload' ? 'outline' : 'secondary'} className="font-normal">
        {data.origem === 'upload' ? 'Upload' : 'Planilha histórica'}
      </Badge>
    </div>
  )
}

function CelulaArquivo({ data, context }: Celula) {
  if (!data) return null
  if (!data.arquivo_path) return <span className="text-muted-foreground">—</span>
  return (
    <Button
      variant="link"
      size="sm"
      className="h-auto max-w-full justify-start px-0"
      title={`Baixar ${data.arquivo_nome ?? 'arquivo original'}`}
      onClick={() => context.onBaixar(data)}
    >
      <Download data-icon="inline-start" />
      <span className="truncate">{data.arquivo_nome ?? 'arquivo original'}</span>
    </Button>
  )
}

function CelulaAcoes({ data, context }: Celula) {
  if (!data || data.vigente || !context.podeEditar) return null
  return (
    <div className="flex h-full items-center justify-center">
      <Button variant="outline" size="sm" onClick={() => context.onTornarVigente(data)}>
        <History data-icon="inline-start" />
        Tornar vigente
      </Button>
    </div>
  )
}

const COLUNAS: ColDef<Carga>[] = [
  { headerName: 'VERSÃO', field: 'versao', cellRenderer: CelulaVersao, width: 125 },
  { headerName: 'ORIGEM', field: 'origem', headerClass: 'ag-centro', cellRenderer: CelulaOrigem, width: 145 },
  { headerName: 'ARQUIVO', field: 'arquivo_nome', cellRenderer: CelulaArquivo, minWidth: 150, flex: 1 },
  {
    headerName: 'ENVIADO POR',
    colId: 'enviado_por',
    minWidth: 140,
    flex: 0.7,
    valueGetter: (p) => {
      if (!p.data) return ''
      if (!p.data.enviado_por) return p.data.origem === 'upload' ? '—' : 'Importação inicial'
      return (p.context as ContextoVersoes).nomes?.get(p.data.enviado_por) ?? 'Usuário'
    },
  },
  { headerName: 'EM', field: 'enviado_em', ...colunaNumerica, valueFormatter: (p) => formatarDataHora(p.value), width: 140 },
  { headerName: 'DEPTOS', field: 'qtd_linhas', ...colunaNumerica, width: 80 },
  { headerName: 'FAT LÍQ', field: 'total_faturamento', ...colunaFundo('bege-2'), valueFormatter: fmtMoeda, width: 140 },
  { headerName: 'MARGEM', field: 'total_margem_valor', ...colunaFundo('bege-1'), valueFormatter: fmtMoeda, width: 130 },
  {
    headerName: 'OBSERVAÇÃO',
    field: 'observacao',
    tooltipField: 'observacao',
    minWidth: 130,
    flex: 1,
    valueFormatter: (p) => p.value ?? '—',
    cellClass: 'text-muted-foreground',
  },
  { headerName: '', colId: 'acoes', cellRenderer: CelulaAcoes, width: 145, sortable: false, resizable: false },
]

/** Versões de um mês. */
export function TabelaVersoes({ versoes, contexto }: { versoes: Carga[]; contexto: ContextoVersoes }) {
  const grade = useRef<AgGridReact<Carga>>(null)

  // os nomes de "enviado por" chegam numa consulta à parte: redesenha quando carregarem
  useEffect(() => {
    grade.current?.api?.refreshCells({ columns: ['enviado_por', 'acoes'], force: true })
  }, [contexto.nomes, contexto.podeEditar])

  return (
    <div className="overflow-hidden rounded-lg border">
      <AgGridReact<Carga>
        ref={grade}
        theme={temaArgos}
        rowData={versoes}
        columnDefs={COLUNAS}
        context={contexto}
        domLayout="autoHeight"
        getRowId={(p) => p.data.id}
        defaultColDef={{ sortable: true, resizable: true, suppressMovable: true }}
        tooltipShowDelay={300}
        suppressCellFocus
      />
    </div>
  )
}
