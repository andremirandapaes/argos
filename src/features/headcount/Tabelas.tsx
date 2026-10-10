import { useEffect, useMemo, useRef, useState } from 'react'
import { AgGridReact, type CustomCellRendererProps } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { temaArgos } from '@/lib/aggrid'
import { Button } from '@/components/ui/button'
import {
  achatarArvore,
  idsExpansiveis,
  rotuloMes,
  type Celula,
  type LinhaCargo,
  type NoArvore,
} from './regras'
import { CelulaDelta, CelulaEstrutura, CelulaMes } from './componentes'

type LinhaGrade = { id: string; label: string; __total?: boolean; __delta: number | null } & Record<string, unknown>

/** Δ só quando primeiro e último mês são números completos (nem "—" nem parcial). */
function delta(celulas: Record<string, Celula> | Celula[], primeiro: string | number, ultimo: string | number) {
  const a = (celulas as Record<string, Celula>)[primeiro]
  const b = (celulas as Record<string, Celula>)[ultimo]
  return typeof a === 'number' && typeof b === 'number' ? b - a : null
}

function colunasMeses(meses: string[]): ColDef<LinhaGrade>[] {
  return meses.map((c) => ({
    headerName: rotuloMes(c),
    field: c,
    width: 80,
    headerClass: 'ag-centro',
    cellClass: 'tabular-nums text-center',
    cellRenderer: CelulaMes,
    sortable: false,
  }))
}

const colunaDelta: ColDef<LinhaGrade> = {
  headerName: 'Δ período',
  field: '__delta',
  width: 100,
  pinned: 'right',
  headerClass: 'ag-centro',
  cellClass: 'tabular-nums text-center',
  cellRenderer: CelulaDelta,
  sortable: false,
  headerTooltip: 'Último mês menos o primeiro mês do período',
}

/**
 * Altura da grade calculada pelo número de linhas (cabeçalho 38px, linha 36px, barra de rolagem horizontal),
 * até um máximo; acima disso a tabela rola. Não usa domLayout="autoHeight" porque, com colunas fixas
 * (estrutura à esquerda, Δ à direita), o AG Grid corta a última linha.
 */
const ALTURA_MAXIMA = 640
const alturaGrade = (linhas: number, fixasNoRodape: number) => Math.min(ALTURA_MAXIMA, 38 + (linhas + fixasNoRodape) * 36 + 2 + 16)

/** Detalhamento mensal em árvore (área › estado › distribuidora › centro › cargo / departamento). */
export function TabelaDetalhamento({ nos, meses, totais }: { nos: NoArvore[]; meses: string[]; totais: Celula[] }) {
  const [abertos, setAbertos] = useState(() => new Set(idsExpansiveis(nos, 1)))
  const alternar = (id: string) =>
    setAbertos((a) => {
      const n = new Set(a)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const linhas = useMemo<LinhaGrade[]>(
    () =>
      achatarArvore(nos, abertos).map((n) => ({
        ...n,
        ...n.celulas,
        __delta: meses.length ? delta(n.celulas, meses[0], meses.at(-1)!) : null,
      })),
    [nos, abertos, meses],
  )
  const total = useMemo<LinhaGrade[]>(() => {
    const t: LinhaGrade = { id: '__total', label: 'Total', __total: true, __delta: null }
    meses.forEach((c, i) => {
      t[c] = totais[i]
    })
    const a = totais[0]
    const b = totais.at(-1)
    t.__delta = typeof a === 'number' && typeof b === 'number' ? b - a : null
    return [t]
  }, [totais, meses])

  const colunas = useMemo<ColDef<LinhaGrade>[]>(
    () => [
      { headerName: 'ESTRUTURA', field: 'label', pinned: 'left', width: 300, minWidth: 220, cellRenderer: CelulaEstrutura, sortable: false },
      ...colunasMeses(meses),
      colunaDelta,
    ],
    [meses],
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setAbertos(new Set(idsExpansiveis(nos)))}>
          <ChevronsUpDown data-icon="inline-start" /> Expandir tudo
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAbertos(new Set())}>
          <ChevronsDownUp data-icon="inline-start" /> Recolher tudo
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border" style={{ height: alturaGrade(linhas.length, 1) }}>
        <AgGridReact<LinhaGrade>
          theme={temaArgos}
          rowData={linhas}
          pinnedBottomRowData={total}
          columnDefs={colunas}
          defaultColDef={{ resizable: true, suppressMovable: true }}
          getRowId={(p) => p.data.id}
          context={{ alternar }}
          getRowClass={(p) => (p.data && !p.data.__total && p.data.prof === 0 ? 'bg-muted/50 font-medium' : undefined)}
          suppressCellFocus
          animateRows={false}
          tooltipShowDelay={300}
        />
      </div>
    </div>
  )
}

/** Evolução por cargo: cargos dos centros selecionados, linha de terceirizados e total. */
const linhaCargoNaGrade = (l: LinhaCargo, meses: string[]): LinhaGrade => ({
  id: l.id,
  label: l.label,
  tipo: l.tipo,
  ...l.celulas,
  __delta: meses.length ? delta(l.celulas, meses[0], meses.at(-1)!) : null,
})

/** Nome do cargo clicável: tira a linha da conta (ou devolve). */
function CelulaNomeCargo({
  data,
  context,
}: CustomCellRendererProps<LinhaGrade, unknown, { fora: Set<string>; alternar?: (id: string) => void }>) {
  if (!data) return null
  if (data.__total || !context.alternar) return <span className="hc-nome-cargo">{data.label}</span>
  const fora = context.fora.has(data.id)
  return (
    <button
      type="button"
      onClick={() => context.alternar!(data.id)}
      title={fora ? 'Fora da conta. Clique para voltar a contar.' : 'Clique para tirar da conta (total, gráfico e indicadores).'}
      className="hc-nome-cargo h-full w-full cursor-pointer truncate text-left hover:underline"
    >
      {data.label}
    </button>
  )
}

export function TabelaCargos({
  linhas,
  total,
  meses,
  fora = new Set<string>(),
  onAlternar,
}: {
  linhas: LinhaCargo[]
  total: Celula[]
  meses: string[]
  /** ids das linhas tiradas da conta (cargo ou "__terc") */
  fora?: Set<string>
  onAlternar?: (id: string) => void
}) {
  const cargos = useMemo(() => linhas.filter((l) => l.tipo !== 'terc').map((l) => linhaCargoNaGrade(l, meses)), [linhas, meses])
  // tirar/voltar um cargo não muda os números da linha, então o AG Grid não redesenha sozinho:
  // redesenha as linhas (estilo riscado e o nome clicável) sempre que a lista de fora mudar
  const api = useRef<GridApi<LinhaGrade> | null>(null)
  const chaveFora = [...fora].sort().join('|')
  useEffect(() => {
    api.current?.redrawRows()
  }, [chaveFora])
  const rodape = useMemo(() => {
    const t: LinhaGrade = { id: '__total', label: 'Total', tipo: 'total', __total: true, __delta: null }
    meses.forEach((c, i) => {
      t[c] = total[i]
    })
    const a = total[0]
    const b = total.at(-1)
    t.__delta = typeof a === 'number' && typeof b === 'number' ? b - a : null
    return [...linhas.filter((l) => l.tipo === 'terc').map((l) => linhaCargoNaGrade(l, meses)), t]
  }, [linhas, total, meses])

  const colunas = useMemo<ColDef<LinhaGrade>[]>(
    () => [
      {
        headerName: 'CARGO',
        field: 'label',
        pinned: 'left',
        width: 280,
        minWidth: 200,
        cellClass: (p) => (p.data?.tipo === 'terc' ? 'font-medium text-hc-terc' : p.data?.tipo === 'total' ? 'font-semibold' : undefined),
        cellRenderer: CelulaNomeCargo,
      },
      ...colunasMeses(meses),
      colunaDelta,
    ],
    [meses],
  )
  return (
    <div className="overflow-hidden rounded-lg border" style={{ height: alturaGrade(cargos.length, rodape.length) }}>
      <AgGridReact<LinhaGrade>
        theme={temaArgos}
        rowData={cargos}
        pinnedBottomRowData={rodape}
        columnDefs={colunas}
        defaultColDef={{ resizable: true, suppressMovable: true }}
        getRowId={(p) => p.data.id}
        context={{ fora, alternar: onAlternar }}
        getRowClass={(p) => (p.data && fora.has(p.data.id) ? 'hc-fora' : undefined)}
        onGridReady={(e) => {
          api.current = e.api
        }}
        suppressCellFocus
        animateRows={false}
        tooltipShowDelay={300}
      />
    </div>
  )
}

