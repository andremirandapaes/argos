import { useEffect, useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ColGroupDef, GridApi } from 'ag-grid-community'
import { Search } from 'lucide-react'
import { temaArgos } from '@/lib/aggrid'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AREAS, cargoMacro, numeroDaCelula, rotuloMes, tabelaCargos, type Celula, type FiltroVinculo, type Linha, type LinhaCargo } from './regras'
import { CelulaDelta, CelulaMes, fmtVariacao } from './componentes'

type VerPor = 'cargo' | 'familia'
type LinhaGrade = { id: string; label: string; tipo: 'cargo' | 'terc' | 'total' } & Record<string, unknown>

const anoAnterior = (c: string) => `${Number(c.slice(0, 4)) - 1}${c.slice(4)}`

/** Soma células com a mesma regra da tabela por cargo: "—" contamina, parcial continua parcial, vazio só se todos vazios. */
function somarCelulas(cs: Celula[]): Celula {
  if (cs.some((c) => c === null)) return null
  if (cs.every((c) => c === '')) return ''
  let v = 0
  let parcial = false
  for (const c of cs) {
    if (typeof c === 'number') v += c
    else if (c && typeof c === 'object') {
      v += c.v
      parcial = true
    }
  }
  return parcial ? { v, parcial: true } : v
}

/**
 * Mesmo cargo em áreas diferentes. Se a área principal do cargo (a que mais tem gente com ele) está sem
 * detalhamento no mês, fica "—" (ex.: Auxiliar de depósito com a Logística sem cargo). Se só falta uma área
 * secundária, o número conhecido aparece como parcial (*) (ex.: Promotores com o Backoffice sem cargo).
 */
function juntarAreas(cs: Celula[], principal: number): Celula {
  const conhecidas = cs.filter((c) => c !== null)
  if (!conhecidas.length || cs[principal] === null) return cs.length ? null : 0
  const soma = somarCelulas(conhecidas)
  if (conhecidas.length === cs.length) return soma
  if (soma === '') return null
  return { v: typeof soma === 'number' ? soma : soma!.v, parcial: true }
}

/** Célula de um mês que a linha não tem: 0 (null é "—" e precisa continuar "—"). */
const celula = (c: Celula | undefined): Celula => (c === undefined ? 0 : c)

/** Cargos de um ano, opcionalmente somados por família (Promotores, Auxiliares…). */
function porFamilia(linhas: LinhaCargo[], meses: string[]): LinhaCargo[] {
  const grupos = new Map<string, LinhaCargo[]>()
  for (const l of linhas) {
    const k = l.tipo === 'terc' ? l.id : (cargoMacro(l.label) ?? l.label)
    grupos.set(k, [...(grupos.get(k) ?? []), l])
  }
  return [...grupos].map(([k, ls]) =>
    ls.length === 1 && ls[0].tipo === 'terc'
      ? ls[0]
      : { id: k, label: k, tipo: 'cargo', celulas: Object.fromEntries(meses.map((m) => [m, somarCelulas(ls.map((l) => celula(l.celulas[m])))])) },
  )
}

/** Diferença: parcial (*) quando um dos lados é parcial; "—" quando falta um dos lados. */
type Dif = number | { v: number; parcial: true } | null
const dif = (a: Celula | undefined, b: Celula | undefined): Dif => {
  const na = numeroDaCelula(a)
  const nb = numeroDaCelula(b)
  if (na == null || nb == null || a === '' || b === '') return null
  return typeof a === 'object' || typeof b === 'object' ? { v: nb - na, parcial: true } : nb - na
}

function CelulaDif({ value }: { value: Dif | undefined }) {
  if (value && typeof value === 'object') {
    return (
      <span className="font-medium text-alerta-foreground" title="Parcial: um dos meses tem parte das bases sem detalhamento por cargo">
        {fmtVariacao(value.v)}*
      </span>
    )
  }
  return <CelulaDelta value={value} />
}

const ALTURA_MAXIMA = 620
// cabeçalho em duas linhas (mês e ano), 36px por linha, barra de rolagem horizontal
const alturaGrade = (linhas: number) => Math.min(ALTURA_MAXIMA, 2 * 38 + linhas * 36 + 2 + 16)

/**
 * Cargos mês a mês, ano anterior × ano de referência: uma linha por cargo e, em cada mês, as duas
 * quantidades e a diferença. Segue os filtros da aba (área, filial, centro de custo, vínculo).
 */
export function TabelaCargosYoY({
  filtradas,
  escopo,
  vinculo,
  mes,
  ultimo,
  comps,
  semCentro,
}: {
  filtradas: readonly Linha[]
  /** linhas antes do filtro de centro de custo (base para saber se o mês está completo) */
  escopo: readonly Linha[]
  vinculo: FiltroVinculo
  mes: string
  ultimo: string | undefined
  comps: string[]
  semCentro: Set<string>
}) {
  const [verPor, setVerPor] = useState<VerPor>('cargo')
  const [busca, setBusca] = useState('')
  // linhas exibidas depois da busca (a altura da tabela acompanha)
  const [visiveis, setVisiveis] = useState<number | null>(null)
  const ano = mes.slice(0, 4)
  const anoAnt = String(Number(ano) - 1)

  // meses do ano de referência em que algum dos dois anos tem base
  const meses = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`).filter(
        (c) => comps.includes(c) || comps.includes(anoAnterior(c)),
      ),
    [ano, comps],
  )

  const { linhas, rodape } = useMemo(() => {
    const mesesAnt = meses.map(anoAnterior)
    const semDetalhe = (t: ReturnType<typeof tabelaCargos>, ms: string[]) => {
      const ls = t.linhas.map((l) => ({ ...l, celulas: { ...l.celulas } }))
      const total = [...t.total]
      ms.forEach((m, i) => {
        if (!semCentro.has(m)) return
        for (const l of ls) l.celulas[m] = null
        total[i] = null
      })
      return { linhas: ls, total }
    }
    // Por área: o "parcial" de um cargo depende só da base da área dele (Promotor não fica parcial porque
    // o Backoffice daquele mês veio sem cargo). Depois soma o mesmo nome de cargo entre as áreas.
    // Cargo ausente num mês: 0 se a área tem detalhamento por cargo completo, "—" se parcial ou sem detalhe.
    // Para saber, entra na regra uma linha de referência com quantidade 0 (não muda nenhuma conta).
    const REF = '__ref__'
    const tabela = (ls: Linha[], base: Linha[], ms: string[]) => {
      const t = semDetalhe(tabelaCargos([...ls, ...ms.map((m) => [m, '', '', null, null, null, REF, 'CLT', 0] as unknown as Linha)], vinculo, ms, ultimo, base), ms)
      const ref = t.linhas.find((l) => l.id === REF)?.celulas
      const vazio = (m: string): Celula => (!comps.includes(m) ? '' : typeof ref?.[m] === 'number' ? 0 : null)
      return { linhas: t.linhas.filter((l) => l.id !== REF), vazio }
    }
    const porId = new Map<string, { label: string; tipo: 'cargo' | 'terc'; a: Celula[][]; b: Celula[][]; peso: number[] }>()
    for (const area of AREAS) {
      const ls = filtradas.filter((l) => l[2] === area)
      if (!ls.length) continue
      const base = escopo.filter((l) => l[2] === area)
      const agora = tabela(ls, base, meses)
      const antes = tabela(ls, base, mesesAnt)
      const lsAgora = verPor === 'familia' ? porFamilia(agora.linhas, meses) : agora.linhas
      const lsAntes = verPor === 'familia' ? porFamilia(antes.linhas, mesesAnt) : antes.linhas
      const mapaAntes = new Map(lsAntes.map((l) => [l.id, l]))
      const mapaAgora = new Map(lsAgora.map((l) => [l.id, l]))
      for (const id of new Set([...mapaAgora.keys(), ...mapaAntes.keys()])) {
        const a = mapaAntes.get(id)
        const b = mapaAgora.get(id)
        const r = porId.get(id) ?? { label: (b ?? a)!.label, tipo: (b ?? a)!.tipo, a: meses.map(() => []), b: meses.map(() => []), peso: [] as number[] }
        meses.forEach((m, i) => {
          r.a[i].push(a ? celula(a.celulas[mesesAnt[i]]) : antes.vazio(mesesAnt[i]))
          r.b[i].push(b ? celula(b.celulas[m]) : agora.vazio(m))
        })
        r.peso.push(meses.reduce((t, _m, i) => t + (numeroDaCelula(r.a[i].at(-1)) ?? 0) + (numeroDaCelula(r.b[i].at(-1)) ?? 0), 0))
        porId.set(id, r)
      }
    }
    const todas = [...porId].map(([id, x]): LinhaGrade => {
      const r: LinhaGrade = { id, label: x.label, tipo: x.tipo }
      const principal = x.peso.indexOf(Math.max(...x.peso))
      meses.forEach((m, i) => {
        const va = juntarAreas(x.a[i], principal)
        const vb = juntarAreas(x.b[i], principal)
        r[`${m}|a`] = va
        r[`${m}|b`] = vb
        r[`${m}|d`] = dif(va, vb)
      })
      return r
    })
    const agora = semDetalhe(tabelaCargos(filtradas, vinculo, meses, ultimo, escopo), meses)
    const antes = semDetalhe(tabelaCargos(filtradas, vinculo, mesesAnt, ultimo, escopo), mesesAnt)
    const valorRef = (l: LinhaGrade) => {
      const v = l[`${mes}|b`]
      return typeof v === 'number' ? v : v && typeof v === 'object' ? (v as { v: number }).v : -1
    }
    const linhas = todas.filter((l) => l.tipo === 'cargo').sort((x, y) => valorRef(y) - valorRef(x) || x.label.localeCompare(y.label))
    const total: LinhaGrade = { id: '__total', label: 'Total', tipo: 'total' }
    meses.forEach((m, i) => {
      total[`${m}|a`] = antes.total[i]
      total[`${m}|b`] = agora.total[i]
      total[`${m}|d`] = dif(antes.total[i], agora.total[i])
    })
    return { linhas, rodape: [...todas.filter((l) => l.tipo === 'terc'), total] }
  }, [filtradas, escopo, vinculo, meses, ultimo, semCentro, verPor, mes, comps])

  const colunas = useMemo<(ColDef<LinhaGrade> | ColGroupDef<LinhaGrade>)[]>(() => {
    const ref = (m: string) => (m === mes ? ' hc-mes-ref' : '')
    return [
      {
        headerName: verPor === 'familia' ? 'FAMÍLIA DE CARGO' : 'CARGO',
        field: 'label',
        pinned: 'left',
        width: 260,
        minWidth: 180,
        cellClass: (p) => (p.data?.tipo === 'terc' ? 'font-medium text-hc-terc' : p.data?.tipo === 'total' ? 'font-semibold' : undefined),
        tooltipField: 'label',
      },
      ...meses.map<ColGroupDef<LinhaGrade>>((m) => ({
        headerName: rotuloMes(m).slice(0, 3),
        headerClass: `ag-centro ag-inicio-bloco${ref(m)}`,
        groupId: m,
        children: [
          {
            colId: `${m}|a`,
            field: `${m}|a`,
            headerName: anoAnt,
            width: 66,
            headerClass: `ag-centro ag-inicio-bloco${ref(m)}`,
            cellClass: `tabular-nums text-center text-muted-foreground ag-inicio-bloco${ref(m)}`,
            cellRenderer: CelulaMes,
            getQuickFilterText: () => '',
            headerTooltip: `${rotuloMes(anoAnterior(m))}`,
          },
          {
            colId: `${m}|b`,
            field: `${m}|b`,
            headerName: ano,
            width: 66,
            headerClass: `ag-centro${ref(m)}`,
            cellClass: `tabular-nums text-center font-medium${ref(m)}`,
            cellRenderer: CelulaMes,
            getQuickFilterText: () => '',
            headerTooltip: rotuloMes(m),
          },
          {
            colId: `${m}|d`,
            field: `${m}|d`,
            headerName: 'Δ',
            width: 58,
            headerClass: `ag-centro${ref(m)}`,
            cellClass: `tabular-nums text-center${ref(m)}`,
            cellRenderer: CelulaDif,
            getQuickFilterText: () => '',
            headerTooltip: `${rotuloMes(m)} menos ${rotuloMes(anoAnterior(m))}`,
          },
        ],
      })),
    ]
  }, [meses, mes, ano, anoAnt, verPor])

  // abre a tabela já no mês de referência
  const api = useRef<GridApi<LinhaGrade> | null>(null)
  useEffect(() => {
    api.current?.ensureColumnVisible(`${mes}|d`, 'end')
  }, [mes, colunas])

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Cargos mês a mês: {anoAnt} × {ano}
        </CardTitle>
        <CardDescription>
          Cada mês mostra {anoAnt}, {ano} e a diferença. Role a tabela para o lado para passar os meses; o mês de referência fica destacado.
        </CardDescription>
        <CardAction>
          <Tabs value={verPor} onValueChange={(v) => setVerPor(v as VerPor)}>
            <TabsList>
              <TabsTrigger value="cargo" className="px-3">
                Cargo
              </TabsTrigger>
              <TabsTrigger value="familia" className="px-3" title="Soma os níveis do mesmo cargo (ex.: Promotor JR, PL e SR viram Promotores)">
                Família
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <InputGroup className="h-9 w-full sm:w-72">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cargo… (ex.: promotor)" aria-label="Buscar cargo" />
        </InputGroup>
        {linhas.length === 0 && rodape.length <= 1 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem cargos para os filtros escolhidos.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border" style={{ height: alturaGrade((visiveis ?? linhas.length) + rodape.length) }}>
            <AgGridReact<LinhaGrade>
              theme={temaArgos}
              rowData={linhas}
              pinnedBottomRowData={rodape}
              columnDefs={colunas}
              defaultColDef={{ resizable: true, suppressMovable: true, sortable: false }}
              getRowId={(p) => p.data.id}
              quickFilterText={busca}
              onModelUpdated={(e) => setVisiveis(e.api.getDisplayedRowCount())}
              includeHiddenColumnsInQuickFilter={false}
              onGridReady={(e) => {
                api.current = e.api
                e.api.ensureColumnVisible(`${mes}|d`, 'end')
              }}
              suppressCellFocus
              animateRows={false}
              tooltipShowDelay={300}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          — = mês sem base ou sem detalhamento por cargo · * = parcial (parte das bases sem dado) · Δ com * usa número parcial.
        </p>
      </CardContent>
    </Card>
  )
}
