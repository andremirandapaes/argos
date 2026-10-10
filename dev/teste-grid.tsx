// Vitrine de desenvolvimento: a tabela do Gerencial com dados fictícios, sem login nem banco.
// Abrir em http://localhost:5173/dev/teste-grid.html (?tema=escuro para o tema escuro). Não entra no build.
import { createRoot } from 'react-dom/client'
import { AgGridReact } from 'ag-grid-react'
import { Banknote, Download, Gauge, CircleDollarSign, Search, TrendingUp, Wallet } from 'lucide-react'
import { Indicador } from '@/components/Indicador'
import { formatarMoeda, formatarPct } from '@/lib/format'
import '@/index.css'
import { temaArgos } from '@/lib/aggrid'
import { COLUNAS, linhaTotal, type LinhaTabela } from '@/features/dun-pro/gerencial-tabela'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

if (new URLSearchParams(location.search).get('tema') === 'escuro') document.documentElement.classList.add('dark')

const linhas: LinhaTabela[] = [
  ['SOFTYS - PROFESSIONAL', 91, 0.2477, 453131.7, 118033.58, 0.2605, 61022.06, 57011.51, 0.1258],
  ['KIMBERLY CLARK', 12, 0.1017, 186097.91, 52083.0, 0.2799, 25061.32, 27021.68, 0.1452],
  ['SANTHER', 45, 0.0907, 165909.14, 29270.58, 0.1764, 22342.55, 6928.03, 0.0418],
  ['BOMBRIL', 30, 0.09, 164636.23, 20142.48, 0.1223, 22171.13, -2028.66, -0.0123],
  ['BRINDES ROTA NORTE', null, 0.0476, 87035.54, 11390.73, 0.1309, 11720.85, -330.12, -0.0038],
].map(([nome, codigo_winthor, participacao, faturamento_liquido, rentabilidade, rentabilidade_pct, despesa_rateada, lb, lb_pct], i) => ({
  departamento_id: String(i),
  nome,
  codigo_winthor,
  participacao,
  faturamento_liquido,
  rentabilidade,
  rentabilidade_pct,
  despesa_rateada,
  lb,
  lb_pct,
})) as LinhaTabela[]

const total = linhaTotal({
  faturamento_liquido: 1829352.51,
  rentabilidade: 417257.29,
  rentabilidade_pct: 0.2281,
  despesa: 246354.13,
  lb: 170903.16,
  lb_pct: 0.0934,
  custo_op_pct: 0.1347,
})

function Vitrine() {
  return (
    <div className="flex flex-col gap-5 bg-background p-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Indicador rotulo="Faturamento líquido" tom="fat" icone={Banknote} valor={formatarMoeda(17682386.16)} />
        <Indicador rotulo="Margem" tom="margem" icone={TrendingUp} valor={formatarMoeda(3863005.77)} apoio={`${formatarPct(0.2185)} do faturamento`} />
        <Indicador rotulo="Despesa" tom="despesa" icone={Wallet} valor={formatarMoeda(1688057.21)} />
        <Indicador rotulo="Custo operacional" tom="custo" icone={Gauge} valor={formatarPct(0.0955)} />
        <Indicador rotulo="LB¹" tom="destaque" icone={CircleDollarSign} valor={formatarMoeda(2174948.56)} apoio={`${formatarPct(0.123)} do faturamento`} />
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-3 border-b px-4 py-2.5">
          <div className="text-sm font-medium">Por departamento</div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar departamento ou código" className="h-8 w-72 pr-8 pl-8 hover:border-ring/60" />
            </div>
            <Button variant="outline" size="sm" id="exportar">
              <Download /> Exportar Excel
            </Button>
          </div>
        </div>
        <div style={{ height: 320 }}>
          <AgGridReact<LinhaTabela>
            theme={temaArgos}
            rowData={linhas}
            pinnedBottomRowData={total}
            columnDefs={COLUNAS}
            defaultColDef={{ sortable: true, resizable: true, suppressMovable: true, cellClass: 'tabular-nums' }}
            suppressCellFocus
          />
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Vitrine />)
