import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import { AlertTriangle, Banknote, Download, Loader2, Tags, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { linhasExibidas, temaArgos } from '@/lib/aggrid'
import { NOME_DUNO_PRO } from '@/lib/constantes'
import { exportarExcel } from '@/lib/exportar-excel'
import { formatarMes, formatarMoeda, formatarPct } from '@/lib/format'
import { rotuloTrimestre, trimestreDe } from '@/lib/periodo'
import { Indicador } from '@/components/Indicador'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useDistribuidora, useTotaisMensais } from '../api'
import { CampoBusca } from '../CampoBusca'
import { AbasRelatorio, SeletorAcompanhamento, type Aba, type PeriodoAcomp } from '../AbasRelatorio'
import { SeletorPeriodo, type Visao } from '../SeletorPeriodo'
import { AcompanhamentoProfessional } from './AcompanhamentoProfessional'
import {
  useExclusivos,
  useProfessional,
  viewsProfessionalAusentes,
  type FiltroProfessional,
  type LinhaProfessional,
} from './api-professional'
import { COLUNAS, COLUNAS_EXCEL, linhaTotal, montarLinhas } from './professional-tabela'

const MIGRATION = 'supabase/migrations/20260930000000_argos_professional_totais.sql'

/** PROFESSIONAL: só os departamentos exclusivos (participação sobre o total deles), sem despesa e sem LB. */
export default function ProfessionalPage() {
  const [params, setParams] = useSearchParams()
  const gridRef = useRef<AgGridReact<LinhaProfessional>>(null)
  const [busca, setBusca] = useState('')
  const [visiveis, setVisiveis] = useState<number | null>(null)
  const [exportando, setExportando] = useState(false)

  const distribuidora = useDistribuidora()
  const distId = distribuidora.data?.id
  const totais = useTotaisMensais(distId)
  const exclusivos = useExclusivos(distId)

  // ---- filtros (URL), mesmo comportamento do Relatório Gerencial ----
  const visaoParam = params.get('visao')
  const visao: Visao = visaoParam === 'anual' || visaoParam === 'trimestral' ? visaoParam : 'mensal'
  const meses = useMemo(() => (totais.data ?? []).map((t) => t.mes_ref!).reverse(), [totais.data])
  const anos = useMemo(() => [...new Set(meses.map((m) => Number(m.slice(0, 4))))], [meses])
  const trimestres = useMemo(() => [...new Set(meses.map((m) => `${m.slice(0, 4)}-${trimestreDe(m)}`))], [meses])
  const mesParam = params.get('mes')
  const mesRef = mesParam ? `${mesParam}-01` : meses[0]
  const ano = Number(params.get('ano')) || (mesRef ? Number(mesRef.slice(0, 4)) : undefined)
  const tri = Number(params.get('tri')) || (mesRef ? trimestreDe(mesRef) : undefined)

  // aba e período da aba Acompanhamento (URL)
  const aba: Aba = params.get('aba') === 'acompanhamento' ? 'acompanhamento' : 'padrao'
  const padrao = aba === 'padrao'
  const periodoAcomp: PeriodoAcomp = params.get('periodo') === 'trimestre' ? 'trimestre' : 'ano'
  const rotuloAcomp = periodoAcomp === 'trimestre' ? rotuloTrimestre(tri ?? 1, ano ?? 0) : String(ano ?? '')

  function mudarFiltro(novo: Record<string, string>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(novo)) p.set(k, v)
    setParams(p, { replace: true })
  }

  // (na aba Acompanhamento a consulta da aba Padrão fica desligada)
  const filtro: FiltroProfessional | undefined = !padrao
    ? undefined
    : visao === 'mensal'
      ? mesRef
        ? { visao, mesRef }
        : undefined
      : visao === 'trimestral'
        ? ano && tri
          ? { visao, ano, tri }
          : undefined
        : ano
          ? { visao, ano }
          : undefined
  const dados = useProfessional(distId, filtro)

  const linhas = useMemo(
    () => montarLinhas(exclusivos.data ?? [], dados.data?.linhas ?? []),
    [exclusivos.data, dados.data],
  )
  const t = dados.data?.total
  const comVenda = linhas.filter((l) => (l.faturamento_liquido ?? 0) !== 0).length
  const periodo =
    visao === 'mensal' ? formatarMes(mesRef) : visao === 'trimestral' ? rotuloTrimestre(tri ?? 1, ano ?? 0) : `Ano ${ano ?? ''}`

  const carregandoBase = distribuidora.isPending || totais.isPending || exclusivos.isPending
  const carregando = carregandoBase || dados.isPending
  const erro = distribuidora.error ?? totais.error ?? exclusivos.error ?? (padrao ? dados.error : null)

  async function exportar() {
    const api = gridRef.current?.api
    if (!api) return
    // exporta o que está na tela (busca + ordenação); com busca, o total vira "TOTAL GERAL"
    const exibidas = linhasExibidas(api)
    const total = linhaTotal(t)[0]
    const filtroBusca = busca.trim()
    setExportando(true)
    try {
      await exportarExcel({
        arquivo: `Professional_Duno_Pro_${visao === 'mensal' ? mesRef?.slice(0, 7) : visao === 'trimestral' ? `${ano}-T${tri}` : ano}.xlsx`,
        aba: `Professional ${periodo.replace('/', '-')}`,
        titulo: [
          `Professional Dpts ${NOME_DUNO_PRO} — ${periodo}`,
          ...(filtroBusca ? [`Filtro: "${filtroBusca}" · ${exibidas.length} de ${linhas.length} departamentos`] : []),
        ],
        colunas: COLUNAS_EXCEL,
        linhas: exibidas,
        total: total && filtroBusca ? { ...total, nome: 'TOTAL GERAL (todos os exclusivos)' } : total,
      })
    } catch (e) {
      toast.error('Não foi possível exportar: ' + (e as Error).message)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Professional Dpts</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {NOME_DUNO_PRO} · {padrao ? periodo : `Acompanhamento ${rotuloAcomp}`} · só os departamentos exclusivos
            PROFESSIONAL (sem despesa e sem LB¹)
          </p>
        </div>
        {padrao ? (
          <SeletorPeriodo
            visao={visao}
            meses={meses}
            mesRef={mesRef}
            trimestres={trimestres}
            ano={ano}
            tri={tri}
            anos={anos}
            carregando={carregandoBase}
            onMudar={mudarFiltro}
          />
        ) : (
          <SeletorAcompanhamento
            periodo={periodoAcomp}
            ano={ano}
            tri={tri}
            anos={anos}
            trimestres={trimestres}
            carregando={carregandoBase}
            onMudar={mudarFiltro}
          />
        )}
      </div>

      <AbasRelatorio aba={aba} onMudar={(a) => mudarFiltro({ aba: a })} />

      {!padrao && (
        <AcompanhamentoProfessional
          distribuidoraId={distId}
          periodo={!ano ? undefined : periodoAcomp === 'trimestre' && tri ? { tipo: 'trimestre', ano, tri } : { tipo: 'ano', ano }}
          rotuloPeriodo={rotuloAcomp}
          totaisMensais={totais.data ?? []}
        />
      )}

      {padrao && erro &&
        (viewsProfessionalAusentes(erro) ? (
          <Alert className="border-alerta-foreground/25 bg-alerta text-alerta-foreground">
            <AlertTriangle />
            <AlertTitle>As views de total do PROFESSIONAL ainda não foram aplicadas no banco</AlertTitle>
            <AlertDescription className="text-alerta-foreground/85">
              Rode no SQL Editor do Supabase o arquivo {MIGRATION} e recarregue a página.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Erro ao carregar o PROFESSIONAL</AlertTitle>
            <AlertDescription>{erro.message}</AlertDescription>
          </Alert>
        ))}

      {padrao && !erro && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Indicador
              rotulo="Faturamento líquido"
              tom="fat"
              icone={Banknote}
              carregando={carregando}
              valor={formatarMoeda(t?.faturamento_liquido)}
            />
            <Indicador
              rotulo="Margem"
              tom="margem"
              icone={TrendingUp}
              carregando={carregando}
              valor={formatarMoeda(t?.rentabilidade)}
              apoio={`${formatarPct(t?.rentabilidade_pct)} do faturamento`}
            />
            <Indicador
              rotulo="Departamentos com venda"
              tom="neutro"
              icone={Tags}
              carregando={carregando}
              valor={`${comVenda} de ${linhas.length}`}
              apoio="exclusivos marcados em Departamentos"
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgb(15_23_42/0.05),0_4px_14px_-4px_rgb(15_23_42/0.10)] dark:shadow-none">
            <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
              <div className="text-sm font-medium">
                Departamentos exclusivos
                {!carregando && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    {busca && visiveis != null ? `${visiveis} de ${linhas.length}` : linhas.length} departamentos
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
            <div className="h-[max(360px,calc(100svh-24rem))]">
              <AgGridReact<LinhaProfessional>
                ref={gridRef}
                theme={temaArgos}
                rowData={linhas}
                pinnedBottomRowData={linhaTotal(t)}
                columnDefs={COLUNAS}
                defaultColDef={{
                  sortable: true,
                  resizable: true,
                  suppressMovable: true,
                  cellClass: 'tabular-nums',
                  getQuickFilterText: () => '',
                }}
                quickFilterText={busca}
                onModelUpdated={(e) => setVisiveis(e.api.getDisplayedRowCount())}
                localeText={{ noMatchingRows: 'Nenhum departamento encontrado.' }}
                getRowId={(p) => p.data.departamento_id ?? 'total'}
                loading={carregando}
                overlayNoRowsTemplate="<span class='text-sm text-muted-foreground'>Nenhum departamento marcado como exclusivo PROFESSIONAL.</span>"
                suppressCellFocus
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
