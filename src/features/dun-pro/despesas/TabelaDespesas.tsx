import { useEffect, useRef } from 'react'
import { AgGridReact, type CustomCellRendererProps } from 'ag-grid-react'
import type { ColDef, RowClassParams } from 'ag-grid-community'
import { ChevronRight, History, Pencil, Plus } from 'lucide-react'
import { colunaFundo, colunaNumerica, temaArgos } from '@/lib/aggrid'
import { formatarDataHora, formatarMes, formatarMoeda } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { LancamentoDespesa } from './api-despesas'

/** Linha da tabela: um mês ou, quando o mês está expandido, uma versão dele. */
export type LinhaDespesa =
  | {
      tipo: 'mes'
      id: string
      mesRef: string
      vigente: LancamentoDespesa | null
      versoes: LancamentoDespesa[]
      temFaturamento: boolean
      futuro: boolean
    }
  | { tipo: 'versao'; id: string; mesRef: string; lancamento: LancamentoDespesa }

export type ContextoDespesas = {
  nomes: Map<string, string | null> | undefined
  podeEditar: boolean
  expandidos: Set<string>
  onAlternar: (mesRef: string) => void
  onLancar: (mesRef: string) => void
  onTornarVigente: (lancamento: LancamentoDespesa) => void
}

type Celula = CustomCellRendererProps<LinhaDespesa, unknown, ContextoDespesas>

/** Lançamento que a linha representa (vigente do mês ou a versão). */
function lancamentoDa(l: LinhaDespesa | undefined) {
  if (!l) return null
  return l.tipo === 'mes' ? l.vigente : l.lancamento
}

function CelulaMes({ data, context }: Celula) {
  if (!data) return null
  if (data.tipo === 'versao') {
    return <span className="pl-9 text-muted-foreground">↳ versão {data.lancamento.versao}</span>
  }
  const expansivel = data.versoes.length > 1
  const aberto = context.expandidos.has(data.mesRef)
  return (
    <div className="flex h-full items-center gap-1">
      {expansivel ? (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={aberto ? 'Esconder versões' : 'Ver versões'}
          aria-expanded={aberto}
          onClick={() => context.onAlternar(data.mesRef)}
        >
          <ChevronRight className={cn('transition-transform', aberto && 'rotate-90')} />
        </Button>
      ) : (
        <span className="w-6" />
      )}
      <span className={cn('font-medium', data.futuro && 'text-muted-foreground')}>{formatarMes(data.mesRef)}</span>
      {expansivel && (
        <Badge variant="secondary" className="ml-1 font-normal">
          {data.versoes.length} versões
        </Badge>
      )}
    </div>
  )
}

function CelulaVersao({ data }: Celula) {
  const l = lancamentoDa(data)
  if (!data || !l) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex h-full items-center justify-center gap-2">
      <span className="font-semibold">v{l.versao}</span>
      {data.tipo === 'versao' && l.vigente && <Badge className="h-5 px-2 text-[11px]">VIGENTE</Badge>}
    </div>
  )
}

function CelulaRelatorio({ data }: Celula) {
  if (!data || data.tipo !== 'mes' || !data.vigente) return null
  return (
    <div className="flex h-full items-center justify-center">
      {data.temFaturamento ? (
        <Badge variant="outline" className="border-positivo/30 bg-positivo/10 font-normal text-positivo">
          No relatório
        </Badge>
      ) : (
        <Badge variant="outline" className="border-alerta-foreground/30 bg-alerta font-normal text-alerta-foreground">
          Aguardando base
        </Badge>
      )}
    </div>
  )
}

function CelulaAcoes({ data, context }: Celula) {
  if (!data || !context.podeEditar) return null
  if (data.tipo === 'versao') {
    if (data.lancamento.vigente) return null
    return (
      <div className="flex h-full items-center justify-center">
        <Button variant="outline" size="xs" onClick={() => context.onTornarVigente(data.lancamento)}>
          <History data-icon="inline-start" />
          Tornar vigente
        </Button>
      </div>
    )
  }
  if (data.futuro) return null
  return (
    <div className="flex h-full items-center justify-center">
      <Button variant={data.vigente ? 'outline' : 'default'} size="xs" onClick={() => context.onLancar(data.mesRef)}>
        {data.vigente ? <Pencil data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
        {data.vigente ? 'Corrigir' : 'Lançar'}
      </Button>
    </div>
  )
}

const COLUNAS: ColDef<LinhaDespesa>[] = [
  { headerName: 'MÊS', colId: 'mes', cellRenderer: CelulaMes, width: 190, sortable: false },
  {
    headerName: 'DESPESA',
    colId: 'valor',
    ...colunaFundo('bege-2'),
    width: 170,
    valueGetter: (p) => lancamentoDa(p.data)?.valor_total ?? null,
    valueFormatter: (p) => (p.value == null ? 'Não lançada' : formatarMoeda(p.value)),
    cellClassRules: { 'text-muted-foreground italic': (p) => p.value == null },
  },
  { headerName: 'VERSÃO', colId: 'versao', headerClass: 'ag-centro', cellRenderer: CelulaVersao, width: 140 },
  {
    headerName: 'LANÇADO POR',
    colId: 'lancado_por',
    minWidth: 140,
    flex: 0.8,
    valueGetter: (p) => {
      const l = lancamentoDa(p.data)
      if (!l) return ''
      if (!l.lancado_por) return l.origem === 'manual' ? '—' : 'Importação inicial'
      return (p.context as ContextoDespesas).nomes?.get(l.lancado_por) ?? 'Usuário'
    },
  },
  {
    headerName: 'EM',
    colId: 'lancado_em',
    ...colunaNumerica,
    width: 150,
    valueGetter: (p) => lancamentoDa(p.data)?.lancado_em ?? null,
    valueFormatter: (p) => (p.value ? formatarDataHora(p.value) : ''),
  },
  {
    headerName: 'OBSERVAÇÃO',
    colId: 'observacao',
    minWidth: 160,
    flex: 1,
    valueGetter: (p) => lancamentoDa(p.data)?.observacao ?? '',
    tooltipValueGetter: (p) => lancamentoDa(p.data)?.observacao ?? undefined,
    cellClass: 'text-muted-foreground',
  },
  { headerName: 'RELATÓRIO', colId: 'relatorio', headerClass: 'ag-centro', cellRenderer: CelulaRelatorio, width: 150 },
  { headerName: '', colId: 'acoes', cellRenderer: CelulaAcoes, width: 150, resizable: false },
]

/** Os 12 meses do ano com a despesa vigente; cada mês expande para mostrar as versões. */
export function TabelaDespesas({ linhas, contexto }: { linhas: LinhaDespesa[]; contexto: ContextoDespesas }) {
  const grade = useRef<AgGridReact<LinhaDespesa>>(null)

  // nomes/expansão/permissão mudam fora do rowData: redesenha as células que dependem deles
  useEffect(() => {
    grade.current?.api?.refreshCells({ columns: ['mes', 'lancado_por', 'acoes'], force: true })
  }, [contexto.nomes, contexto.expandidos, contexto.podeEditar])

  return (
    <div className="overflow-hidden rounded-lg border">
      <AgGridReact<LinhaDespesa>
        ref={grade}
        theme={temaArgos}
        rowData={linhas}
        columnDefs={COLUNAS}
        context={contexto}
        domLayout="autoHeight"
        getRowId={(p) => p.data.id}
        getRowClass={(p: RowClassParams<LinhaDespesa>) => (p.data?.tipo === 'versao' ? 'bg-muted/50 text-sm' : undefined)}
        defaultColDef={{ sortable: false, resizable: true, suppressMovable: true }}
        tooltipShowDelay={300}
        suppressCellFocus
      />
    </div>
  )
}
