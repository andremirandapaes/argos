import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import type { GetRowIdParams } from 'ag-grid-community'
import { AlertTriangle, Download, FileUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { usePerfil } from '@/auth/usePerfil'
import { linhasExibidas, temaArgos } from '@/lib/aggrid'
import { NOME_DUNO_PRO } from '@/lib/constantes'
import { exportarExcel } from '@/lib/exportar-excel'
import { formatarMes } from '@/lib/format'
import { rotuloTrimestre, trimestreDe } from '@/lib/periodo'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  useDistribuidora,
  useGerencialAnual,
  useGerencialMensal,
  useGerencialTrimestral,
  useTotaisMensais,
  viewProfessionalAusente,
} from './api'
import { AcompanhamentoGerencial } from './acompanhamento/AcompanhamentoGerencial'
import { AbasRelatorio, SeletorAcompanhamento, type Aba, type PeriodoAcomp } from './AbasRelatorio'
import { CampoBusca } from './CampoBusca'
import { CardsGerencial } from './CardsGerencial'
import { COLUNAS, COLUNAS_EXCEL, linhaTotal, type LinhaTabela, type Totais } from './gerencial-tabela'
import { SeletorPeriodo, type Visao } from './SeletorPeriodo'

const ROTA_DESPESAS = '/dun-professional/despesas'

/** Altura máxima da tabela (com mais linhas, rola). */
const ALTURA_MAXIMA = 'max(420px, calc(100svh - 25rem))'
/** Cabeçalho 38px + linhas de 36px + TOTAL fixo + bordas (pelo menos 3 linhas, para a mensagem de vazio). */
const alturaDaGrade = (linhas: number) => 38 + Math.max(linhas, 3) * 36 + 36 + 4
const ROTA_IMPORTAR = '/dun-professional/importar'

/** A view trimestral vem de uma migration à parte; se ainda não foi aplicada, o PostgREST não a encontra. */
function viewTrimestralAusente(erro: { message?: string; code?: string } | null) {
  return !!erro && (erro.code === 'PGRST205' || /vw_gerencial_trimestral/.test(erro.message ?? ''))
}

export default function GerencialPage() {
  const { podeEditar } = usePerfil()
  const [params, setParams] = useSearchParams()
  const gridRef = useRef<AgGridReact<LinhaTabela>>(null)
  const [exportando, setExportando] = useState(false)
  const [busca, setBusca] = useState('')
  const [visiveis, setVisiveis] = useState<number | null>(null)

  const distribuidora = useDistribuidora()
  const distId = distribuidora.data?.id
  const totais = useTotaisMensais(distId)

  // ---- aba e filtros (guardados na URL para links diretos e para sobreviver ao refresh) ----
  // Só Professional: só departamentos exclusivos, com a despesa cheia re-rateada entre eles (vale para as duas abas)
  const professional = params.get('prof') === '1'
  const totaisProf = useTotaisMensais(distId, true, professional)
  // meses, períodos e alerta de despesa vêm sempre do total geral; cards e TOTAL, da visão escolhida
  const totaisVisao = professional ? totaisProf : totais
  const aba: Aba = params.get('aba') === 'acompanhamento' ? 'acompanhamento' : 'padrao'
  const padrao = aba === 'padrao'
  const visaoParam = params.get('visao')
  const visao: Visao = visaoParam === 'anual' || visaoParam === 'trimestral' ? visaoParam : 'mensal'
  const meses = useMemo(() => (totais.data ?? []).map((t) => t.mes_ref!).reverse(), [totais.data])
  const anos = useMemo(() => [...new Set(meses.map((m) => Number(m.slice(0, 4))))], [meses])
  // trimestres com carga, do mais recente para o mais antigo: "2026-3", "2026-2"...
  const trimestres = useMemo(
    () => [...new Set(meses.map((m) => `${m.slice(0, 4)}-${trimestreDe(m)}`))],
    [meses],
  )
  const mesParam = params.get('mes')
  const mesRef = mesParam ? `${mesParam}-01` : meses[0] // padrão: último mês com carga vigente
  const ano = Number(params.get('ano')) || (mesRef ? Number(mesRef.slice(0, 4)) : undefined)
  const tri = Number(params.get('tri')) || (mesRef ? trimestreDe(mesRef) : undefined)
  // período da aba Acompanhamento
  const periodoAcomp: PeriodoAcomp = params.get('periodo') === 'trimestre' ? 'trimestre' : 'ano'
  const rotuloAcomp = periodoAcomp === 'trimestre' ? rotuloTrimestre(tri ?? 1, ano ?? 0) : String(ano ?? '')

  function mudarFiltro(novo: Record<string, string>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(novo)) p.set(k, v)
    setParams(p, { replace: true })
  }

  // ---- dados ----
  // (na aba Acompanhamento as consultas da aba Padrão ficam desligadas)
  const mensal = useGerencialMensal(distId, padrao && visao === 'mensal' ? mesRef : undefined, professional)
  const trimestral = useGerencialTrimestral(distId, padrao && visao === 'trimestral' ? ano : undefined, tri, professional)
  const anual = useGerencialAnual(distId, padrao && visao === 'anual' ? ano : undefined, professional)
  const consulta = visao === 'mensal' ? mensal : visao === 'trimestral' ? trimestral : anual

  const totalMensal = totaisVisao.data?.find((t) => t.mes_ref === mesRef)
  const totaisExibidos: Totais | null | undefined =
    visao === 'mensal' ? totalMensal : visao === 'trimestral' ? trimestral.data?.total : anual.data?.total
  const linhas: LinhaTabela[] = useMemo(
    () =>
      (visao === 'mensal' ? mensal.data : visao === 'trimestral' ? trimestral.data?.linhas : anual.data?.linhas) ?? [],
    [visao, mensal.data, trimestral.data, anual.data],
  )
  // meses que compõem o período escolhido (para o badge e o alerta de despesa)
  const mesesDoPeriodo = (totais.data ?? []).filter((t) => {
    if (!t.mes_ref) return false
    if (visao === 'mensal') return t.mes_ref === mesRef
    if (visao === 'trimestral') return t.mes_ref.startsWith(`${ano}-`) && trimestreDe(t.mes_ref) === tri
    return t.mes_ref.startsWith(`${ano}-`)
  })
  const mesesSemDespesa = mesesDoPeriodo.filter((t) => t.despesa == null)

  const carregandoBase = distribuidora.isPending || totais.isPending || (professional && totaisProf.isPending)
  const carregandoDados = carregandoBase || consulta.isPending
  const erro = distribuidora.error ?? totais.error ?? (professional ? totaisProf.error : null) ?? (padrao ? consulta.error : null)
  const periodo =
    visao === 'mensal'
      ? formatarMes(mesRef)
      : visao === 'trimestral'
        ? rotuloTrimestre(tri ?? 1, ano ?? 0)
        : `Ano ${ano ?? ''}`

  async function exportar() {
    const api = gridRef.current?.api
    if (!api) return
    // exporta o que está na tela (busca + ordenação). Com busca, o total vira "TOTAL GERAL"
    // (é o total de todos os departamentos, vindo da view; não é a soma das linhas filtradas)
    const exibidas = linhasExibidas(api)
    const totalExcel = linhaTotal(totaisExibidos)[0]
    const filtro = busca.trim()
    setExportando(true)
    try {
      await exportarExcel({
        arquivo: `Relatorio_Gerencial_Duno_Pro_${professional ? 'Professional_' : ''}${
          visao === 'mensal' ? mesRef?.slice(0, 7) : visao === 'trimestral' ? `${ano}-T${tri}` : ano
        }.xlsx`,
        aba: `Gerencial ${periodo.replace('/', '-')}`,
        titulo: [
          `Relatório Gerencial ${NOME_DUNO_PRO} — ${periodo}${professional ? ' — Só Professional' : ''}`,
          ...(professional ? ['Só departamentos Professional; a despesa cheia do período é re-rateada entre eles.'] : []),
          ...(filtro ? [`Filtro: "${filtro}" · ${exibidas.length} de ${linhas.length} departamentos`] : []),
        ],
        colunas: COLUNAS_EXCEL,
        linhas: exibidas,
        total: totalExcel && filtro ? { ...totalExcel, nome: 'TOTAL GERAL (todos os departamentos)' } : totalExcel,
      })
    } catch (e) {
      toast.error('Não foi possível exportar: ' + (e as Error).message)
    } finally {
      setExportando(false)
    }
  }

  // ---- estados vazios ----
  if (professional && viewProfessionalAusente(totaisProf.error ?? consulta.error)) {
    return (
      <div className="p-6">
        <Alert className="border-alerta-foreground/25 bg-alerta text-alerta-foreground">
          <AlertTriangle />
          <AlertTitle>O filtro Só Professional ainda não foi aplicado no banco</AlertTitle>
          <AlertDescription className="text-alerta-foreground/85">
            Rode no SQL Editor do Supabase o arquivo supabase/migrations/20261021000000_argos_gerencial_professional.sql
            e recarregue a página.
          </AlertDescription>
          <AlertAction>
            <Button
              size="sm"
              variant="outline"
              className="border-alerta-foreground/30 bg-transparent"
              onClick={() => mudarFiltro({ prof: '0' })}
            >
              Ver todos os departamentos
            </Button>
          </AlertAction>
        </Alert>
      </div>
    )
  }

  if (padrao && visao === 'trimestral' && viewTrimestralAusente(trimestral.error)) {
    return (
      <div className="p-6">
        <Alert className="border-alerta-foreground/25 bg-alerta text-alerta-foreground">
          <AlertTriangle />
          <AlertTitle>A visão trimestral ainda não foi aplicada no banco</AlertTitle>
          <AlertDescription className="text-alerta-foreground/85">
            Rode no SQL Editor do Supabase o arquivo supabase/migrations/20260927120000_argos_gerencial_trimestral.sql
            e recarregue a página.
          </AlertDescription>
          <AlertAction>
            <Button
              size="sm"
              variant="outline"
              className="border-alerta-foreground/30 bg-transparent"
              onClick={() => mudarFiltro({ visao: 'mensal' })}
            >
              Voltar ao mensal
            </Button>
          </AlertAction>
        </Alert>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Erro ao carregar o relatório</AlertTitle>
          <AlertDescription>{erro.message}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!carregandoBase && meses.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-sm text-muted-foreground">Nenhuma base de faturamento foi importada ainda.</p>
        {podeEditar && (
          <Button render={<Link to={ROTA_IMPORTAR} />}>
            <FileUp /> Importar faturamento
          </Button>
        )}
      </div>
    )
  }

  const t = totaisExibidos
  const semCargaNoMes = visao === 'mensal' && !carregandoBase && !totalMensal

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      {/* cabeçalho + filtros */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Relatório Gerencial</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {NOME_DUNO_PRO} · {padrao ? periodo : `Acompanhamento ${rotuloAcomp}`}
            </span>
            {professional && (
              <Badge className="font-normal" title="Só departamentos Professional; a despesa cheia do período é re-rateada entre eles">
                Só Professional
              </Badge>
            )}
            {padrao && visao === 'mensal' && totalMensal && (
              <Badge variant="outline" className="font-normal">
                Faturamento v{totalMensal.versao_faturamento} · Despesa{' '}
                {totalMensal.versao_despesa != null ? `v${totalMensal.versao_despesa}` : '—'}
              </Badge>
            )}
            {padrao && visao !== 'mensal' && mesesDoPeriodo.length > 0 && (
              <Badge variant="outline" className="font-normal">
                {mesesDoPeriodo.length}
                {visao === 'trimestral' && mesesDoPeriodo.length < 3 ? ' de 3' : ''}{' '}
                {mesesDoPeriodo.length === 1 ? 'mês' : 'meses'} · {formatarMes(mesesDoPeriodo[0].mes_ref)}
                {mesesDoPeriodo.length > 1 && ` a ${formatarMes(mesesDoPeriodo[mesesDoPeriodo.length - 1].mes_ref)}`}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2" title="Só os departamentos Professional, com a despesa cheia do período re-rateada entre eles">
          <Switch id="so-professional" checked={professional} onCheckedChange={(v) => mudarFiltro({ prof: v ? '1' : '0' })} />
          <Label htmlFor="so-professional" className="text-sm font-normal whitespace-nowrap">
            Só Professional
          </Label>
        </div>
        {!padrao ? (
          // aba Acompanhamento: ano ou trimestre (a tabela mostra os meses do período até o último com carga)
          <SeletorAcompanhamento
            periodo={periodoAcomp}
            ano={ano}
            tri={tri}
            anos={anos}
            trimestres={trimestres}
            carregando={carregandoBase}
            onMudar={mudarFiltro}
          />
        ) : (
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
        )}
        </div>
      </div>

      <AbasRelatorio aba={aba} onMudar={(a) => mudarFiltro({ aba: a })} />

      {!padrao ? (
        <AcompanhamentoGerencial
          distribuidoraId={distId}
          periodo={
            !ano ? undefined : periodoAcomp === 'trimestre' && tri ? { tipo: 'trimestre', ano, tri } : { tipo: 'ano', ano }
          }
          rotuloPeriodo={rotuloAcomp}
          totaisMensais={totaisVisao.data ?? []}
          professional={professional}
        />
      ) : (
      <>
      {semCargaNoMes && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Sem base de faturamento vigente para {formatarMes(mesRef)}</AlertTitle>
          <AlertDescription>Escolha outro mês ou importe a base deste mês.</AlertDescription>
        </Alert>
      )}

      {/* alerta: despesa não lançada */}
      {mesesSemDespesa.length > 0 && (
        <Alert className="border-alerta-foreground/25 bg-alerta text-alerta-foreground">
          <AlertTriangle />
          <AlertTitle>
            {visao === 'mensal'
              ? 'Despesa não lançada'
              : `Despesa não lançada em ${mesesSemDespesa.map((m) => formatarMes(m.mes_ref)).join(', ')}`}
          </AlertTitle>
          <AlertDescription className="text-alerta-foreground/85">
            {visao === 'mensal'
              ? 'O LB¹ deste mês considera despesa zero.'
              : `O LB¹ do ${visao === 'trimestral' ? 'trimestre' : 'ano'} considera despesa zero nesses meses.`}
          </AlertDescription>
          {podeEditar && (
            <AlertAction>
              <Button
                size="sm"
                variant="outline"
                className="border-alerta-foreground/30 bg-transparent"
                render={<Link to={`${ROTA_DESPESAS}?ano=${ano}&mes=${(mesesSemDespesa[0].mes_ref ?? '').slice(0, 7)}`} />}
              >
                Lançar despesa
              </Button>
            </AlertAction>
          )}
        </Alert>
      )}

      {/* cards */}
      {!semCargaNoMes && <CardsGerencial totais={t} carregando={carregandoDados} />}

      {/* tabela */}
      {!semCargaNoMes && (
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-card">
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
            <div className="text-sm font-medium">
              Por departamento
              {!carregandoDados && (
                <span className="ml-2 font-normal text-muted-foreground">
                  {busca && visiveis != null ? `${visiveis} de ${linhas.length}` : linhas.length} departamentos
                </span>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <CampoBusca valor={busca} onMudar={setBusca} />
              <Button variant="outline" size="sm" onClick={exportar} disabled={carregandoDados || exportando}>
                {exportando ? <Loader2 className="animate-spin" /> : <Download />}
                Exportar Excel
              </Button>
            </div>
          </div>
          {/* altura: acompanha as linhas (TOTAL logo abaixo do último departamento), até o máximo da tela */}
          <div style={{ height: carregandoDados ? ALTURA_MAXIMA : `min(${ALTURA_MAXIMA}, ${alturaDaGrade(visiveis ?? linhas.length)}px)` }}>
            <AgGridReact<LinhaTabela>
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
              getRowId={(p: GetRowIdParams<LinhaTabela>) => p.data.departamento_id ?? 'total'}
              loading={carregandoDados}
              overlayNoRowsTemplate="<span class='text-sm text-muted-foreground'>Sem departamentos no período.</span>"
              tooltipShowDelay={400}
              suppressCellFocus
            />
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}