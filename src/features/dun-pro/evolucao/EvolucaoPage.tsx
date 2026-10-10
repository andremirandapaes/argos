import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import { AlertTriangle, Download, Loader2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { linhasExibidas, temaArgos } from '@/lib/aggrid'
import { NOME_DUNO_PRO } from '@/lib/constantes'
import { exportarExcel } from '@/lib/exportar-excel'
import { formatarMes } from '@/lib/format'
import { mesesDoAno } from '@/lib/periodo'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { funcaoResumoAusente, useDistribuidora, useGerencialAnual, useResumoPeriodo, useTotaisMensais } from '../api'
import { CardsGerencial } from '../CardsGerencial'
import type { Totais } from '../gerencial-tabela'
import { COLUNAS, COLUNAS_EXCEL, linhaDoMes, linhaTotal, type LinhaEvolucao } from './evolucao-tabela'
import { GraficoEvolucao, type PontoEvolucao, type SelecaoMeses } from './GraficoEvolucao'

// preferência de "Rótulos de dados" guardada no navegador (conveniência; pode não existir)
const CHAVE_ROTULOS = 'argos-evolucao-rotulos'
function lerRotulos() {
  try {
    return localStorage.getItem(CHAVE_ROTULOS) === '1'
  } catch {
    return false
  }
}
function salvarRotulos(ligado: boolean) {
  try {
    localStorage.setItem(CHAVE_ROTULOS, ligado ? '1' : '0')
  } catch {
    // sem armazenamento disponível: vale só nesta visita
  }
}

/** Evolução mês a mês do ano (substitui a aba "Base Gráficos" da planilha). Fonte: vw_gerencial_mensal_total. */
export default function EvolucaoPage() {
  const [params, setParams] = useSearchParams()
  const gridRef = useRef<AgGridReact<LinhaEvolucao>>(null)
  const [rotulos, setRotulos] = useState(lerRotulos)
  const [exportando, setExportando] = useState(false)

  const distribuidora = useDistribuidora()
  const distId = distribuidora.data?.id
  const totais = useTotaisMensais(distId)

  // anos com carga (mais recente primeiro); padrão: o do último mês com carga
  const anos = useMemo(
    () => [...new Set((totais.data ?? []).map((t) => Number(t.mes_ref!.slice(0, 4))))].sort((a, b) => b - a),
    [totais.data],
  )
  const ano = Number(params.get('ano')) || anos[0]
  const anual = useGerencialAnual(distId, ano)

  const totaisDoAno = useMemo(
    () => (totais.data ?? []).filter((t) => t.mes_ref?.startsWith(`${ano}-`)),
    [totais.data, ano],
  )
  const pontos: PontoEvolucao[] = useMemo(() => {
    const porMes = new Map(totaisDoAno.map((t) => [t.mes_ref!, t]))
    return mesesDoAno(ano ?? 0).map((m) => {
      const t = porMes.get(m)
      return {
        mesRef: m,
        rotulo: formatarMes(m),
        faturamento: t?.faturamento_liquido ?? null,
        margemPct: t?.rentabilidade_pct ?? null,
        lbPct: t?.lb_pct ?? null,
        custoOp: t && t.despesa != null ? t.custo_op_pct : null,
        temDespesa: !!t && t.despesa != null,
      }
    })
  }, [totaisDoAno, ano])
  // ---- seleção de meses no gráfico (arraste/clique): gráfico, cards e tabela passam a mostrar só esses meses ----
  const [selecao, setSelecao] = useState<SelecaoMeses | null>(null)
  const selecaoValida = selecao && selecao.fim < pontos.length ? selecao : null
  const pontosVisiveis = selecaoValida ? pontos.slice(selecaoValida.inicio, selecaoValida.fim + 1) : pontos
  const inicioSel = selecaoValida ? pontos[selecaoValida.inicio].mesRef : undefined
  const fimSel = selecaoValida ? pontos[selecaoValida.fim].mesRef : undefined
  // resumo dos meses selecionados vem pronto do banco (mesma lógica do total anual)
  const resumo = useResumoPeriodo(inicioSel, fimSel)
  const totaisCards: Totais | null | undefined = selecaoValida ? resumo.data : anual.data?.total

  const linhas = useMemo(
    () =>
      totaisDoAno
        .filter((t) => !inicioSel || (t.mes_ref! >= inicioSel && t.mes_ref! <= fimSel!))
        .map(linhaDoMes),
    [totaisDoAno, inicioSel, fimSel],
  )

  const carregando = distribuidora.isPending || totais.isPending
  const erro = distribuidora.error ?? totais.error ?? anual.error
  const faixa = totaisDoAno.length
    ? `${formatarMes(totaisDoAno[0].mes_ref)} a ${formatarMes(totaisDoAno[totaisDoAno.length - 1].mes_ref)}`
    : ''
  const rotuloSelecao = selecaoValida
    ? `${formatarMes(inicioSel)}${fimSel !== inicioSel ? ` a ${formatarMes(fimSel)}` : ''}`
    : null

  function mudarAno(novo: string) {
    setParams({ ano: novo }, { replace: true })
    setSelecao(null) // os índices da seleção valem só para o ano anterior
  }

  async function exportar() {
    const api = gridRef.current?.api
    if (!api) return
    setExportando(true)
    try {
      await exportarExcel({
        arquivo: `Evolucao_Duno_Pro_${ano}${inicioSel ? `_${inicioSel.slice(0, 7)}_a_${fimSel!.slice(0, 7)}` : ''}.xlsx`,
        aba: `Evolução ${ano}`,
        titulo: [`Evolução ${NOME_DUNO_PRO} — ${rotuloSelecao ?? `${ano} (${faixa})`}`],
        colunas: COLUNAS_EXCEL,
        linhas: linhasExibidas(api),
        total: linhaTotal(totaisCards)[0],
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
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Evolução - {NOME_DUNO_PRO}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {rotuloSelecao ? `Seleção: ${rotuloSelecao}` : `${ano ?? ''}${faixa ? ` · ${faixa}` : ''}`} · mês a mês
          </p>
        </div>
        {anos.length > 0 && (
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[String(ano)]}
            onValueChange={(v) => v[0] && mudarAno(v[0])}
            aria-label="Ano"
          >
            {[...anos].reverse().map((a) => (
              <ToggleGroupItem
                key={a}
                value={String(a)}
                className="text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                {a}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </div>

      {erro && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Erro ao carregar a evolução</AlertTitle>
          <AlertDescription>{erro.message}</AlertDescription>
        </Alert>
      )}

      {selecaoValida && funcaoResumoAusente(resumo.error) && (
        <Alert className="border-alerta-foreground/25 bg-alerta text-alerta-foreground">
          <AlertTriangle />
          <AlertTitle>O resumo por seleção ainda não foi aplicado no banco</AlertTitle>
          <AlertDescription className="text-alerta-foreground/85">
            Rode no SQL Editor do Supabase o arquivo supabase/migrations/20260930120000_argos_resumo_periodo.sql e recarregue
            a página. Sem ele, os cards não conseguem somar a seleção.
          </AlertDescription>
        </Alert>
      )}

      {/* cards: acumulado do ano ou, com seleção, dos meses selecionados (sempre prontos do banco) */}
      <CardsGerencial
        totais={totaisCards}
        carregando={carregando || (selecaoValida ? resumo.isPending : anual.isPending)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Evolução mensal</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            {rotuloSelecao ? (
              <Badge variant="outline" className="h-7 gap-1.5 border-primary/30 bg-primary/10 pr-1 pl-2.5 text-sm text-primary">
                Seleção: {rotuloSelecao}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Limpar seleção"
                  title="Limpar seleção"
                  className="text-primary hover:bg-primary/15"
                  onClick={() => setSelecao(null)}
                >
                  <X />
                </Button>
              </Badge>
            ) : (
              'Arraste sobre o gráfico para filtrar os meses (ou clique em um mês). Os cards acompanham.'
            )}
          </CardDescription>
          <CardAction className="flex items-center gap-2">
            <Switch
              id="rotulos-evolucao"
              size="sm"
              checked={rotulos}
              onCheckedChange={(ligado) => {
                setRotulos(ligado)
                salvarRotulos(ligado)
              }}
            />
            <Label htmlFor="rotulos-evolucao" className="text-sm font-normal text-muted-foreground">
              Rótulos de dados
            </Label>
          </CardAction>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <Skeleton className="h-[30rem] w-full" />
          ) : (
            // com seleção, o gráfico mostra só esses meses (zoom); arrastar de novo aproxima mais.
            // A seleção feita no gráfico ampliado vem em índices dele: soma o início para voltar ao ano inteiro.
            <GraficoEvolucao
              pontos={pontosVisiveis}
              rotulos={rotulos}
              onSelecionar={(s) => {
                const base = selecaoValida?.inicio ?? 0
                setSelecao({ inicio: base + s.inicio, fim: base + s.fim })
              }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mês a mês</CardTitle>
          <CardDescription>
            Os mesmos números do gráfico. O TOTAL é o acumulado {rotuloSelecao ? 'dos meses selecionados' : 'do ano'}.
          </CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={exportar} disabled={carregando || exportando}>
              {exportando ? <Loader2 className="animate-spin" /> : <Download />}
              Exportar Excel
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <AgGridReact<LinhaEvolucao>
              ref={gridRef}
              theme={temaArgos}
              rowData={linhas}
              pinnedBottomRowData={linhaTotal(totaisCards)}
              columnDefs={COLUNAS}
              domLayout="autoHeight"
              defaultColDef={{ sortable: false, resizable: true, suppressMovable: true, cellClass: 'tabular-nums' }}
              getRowId={(p) => p.data.id}
              loading={carregando}
              overlayNoRowsTemplate="<span class='text-sm text-muted-foreground'>Nenhum mês com base de faturamento neste ano.</span>"
              tooltipShowDelay={300}
              suppressCellFocus
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
