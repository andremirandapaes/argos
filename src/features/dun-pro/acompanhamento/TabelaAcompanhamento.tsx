import { useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { linhasExibidas, temaArgos } from '@/lib/aggrid'
import { exportarExcel } from '@/lib/exportar-excel'
import { Button } from '@/components/ui/button'
import { CampoBusca } from '../CampoBusca'
import {
  montarColunas,
  montarExcel,
  type ContextoAcompanhamento,
  type LinhaAcompanhamento,
  type Medida,
} from './acompanhamento-tabela'

/**
 * Tabela da aba Acompanhamento (genérica): meses lado a lado + Acumulado, busca e exportação.
 * Exporta o que está na tela (busca + ordenação); com busca, o total vira "TOTAL GERAL"
 * (total de todos os departamentos, vindo das views; não é a soma das linhas filtradas).
 */
export function TabelaAcompanhamento({
  titulo,
  linhas,
  total,
  meses,
  mesesComCarga,
  medidas,
  carregando,
  faixa,
  excel,
}: {
  titulo: string
  /** ex.: "Jan/26 a Ago/26" */
  faixa: string
  linhas: LinhaAcompanhamento[]
  total: LinhaAcompanhamento
  meses: string[]
  mesesComCarga: Set<string>
  medidas: Medida[]
  carregando: boolean
  excel: { arquivo: string; aba: string; titulo: string; rotuloTotalGeral: string }
}) {
  const gridRef = useRef<AgGridReact<LinhaAcompanhamento>>(null)
  const [busca, setBusca] = useState('')
  const [visiveis, setVisiveis] = useState<number | null>(null)
  const [exportando, setExportando] = useState(false)

  const colunas = useMemo(() => montarColunas(meses, medidas), [meses, medidas])
  const contexto: ContextoAcompanhamento = useMemo(() => ({ mesesComCarga }), [mesesComCarga])

  async function exportar() {
    const api = gridRef.current?.api
    if (!api) return
    const exibidas = linhasExibidas(api)
    const filtro = busca.trim()
    setExportando(true)
    try {
      const { colunas: colunasExcel, grupos } = montarExcel(meses, mesesComCarga, medidas)
      await exportarExcel({
        arquivo: excel.arquivo,
        aba: excel.aba,
        titulo: [
          excel.titulo,
          ...(filtro ? [`Filtro: "${filtro}" · ${exibidas.length} de ${linhas.length} departamentos`] : []),
        ],
        colunas: colunasExcel,
        grupos,
        linhas: exibidas,
        total: filtro ? { ...total, nome: excel.rotuloTotalGeral } : total,
      })
    } catch (e) {
      toast.error('Não foi possível exportar: ' + (e as Error).message)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgb(15_23_42/0.05),0_4px_14px_-4px_rgb(15_23_42/0.10)] dark:shadow-none">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
        <div className="text-sm font-medium">
          {titulo}
          {!carregando && (
            <span className="ml-2 font-normal text-muted-foreground">
              {busca && visiveis != null ? `${visiveis} de ${linhas.length}` : linhas.length} departamentos
              {faixa && ` · ${faixa}`}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <CampoBusca valor={busca} onMudar={setBusca} />
          <Button variant="outline" size="sm" onClick={exportar} disabled={carregando || exportando}>
            {exportando ? <Loader2 className="animate-spin" /> : <Download />}
            Exportar Excel
          </Button>
        </div>
      </div>
      <div className="h-[max(460px,calc(100svh-25rem))]">
        <AgGridReact<LinhaAcompanhamento>
          ref={gridRef}
          theme={temaArgos}
          rowData={linhas}
          pinnedBottomRowData={carregando ? [] : [total]}
          columnDefs={colunas}
          context={contexto}
          defaultColDef={{
            sortable: true,
            resizable: true,
            suppressMovable: true,
            getQuickFilterText: () => '',
          }}
          quickFilterText={busca}
          onModelUpdated={(e) => setVisiveis(e.api.getDisplayedRowCount())}
          // ao abrir, rola até o mês mais recente
          onFirstDataRendered={(e) => {
            const ultimo = meses[meses.length - 1]
            if (ultimo) e.api.ensureColumnVisible(`${ultimo}|${medidas[0].campo}`, 'start')
          }}
          localeText={{ noMatchingRows: 'Nenhum departamento encontrado.' }}
          getRowId={(p) => p.data.id}
          loading={carregando}
          overlayNoRowsTemplate="<span class='text-sm text-muted-foreground'>Sem departamentos no período.</span>"
          tooltipShowDelay={400}
          suppressCellFocus
        />
      </div>
    </div>
  )
}
