import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { usePerfil } from '@/auth/usePerfil'
import { NOME_DUNO_PRO } from '@/lib/constantes'
import { formatarMes } from '@/lib/format'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useGerencialAnual, useGerencialMensalAno, useGerencialTrimestral, type TotalMensal } from '../api'
import { CardsGerencial } from '../CardsGerencial'
import {
  MEDIDAS_GERENCIAL,
  mesesDoPeriodo as calcularMesesDoPeriodo,
  montarLinhas,
  montarTotal,
  valoresDe,
  type Valores,
} from './acompanhamento-tabela'
import { TabelaAcompanhamento } from './TabelaAcompanhamento'

const ROTA_DESPESAS = '/dun-professional/despesas'

/** Período da aba: o ano inteiro ou um trimestre. */
export type PeriodoAcompanhamento = { tipo: 'ano'; ano: number } | { tipo: 'trimestre'; ano: number; tri: number }

/** Total (views de total) no formato das colunas: a despesa do total entra na coluna DESPESA. */
function valoresDoTotal(t: Record<string, unknown> & { despesa: number | null }): Valores {
  return { ...valoresDe(t, MEDIDAS_GERENCIAL), despesa_rateada: t.despesa }
}

/**
 * Aba Acompanhamento do Relatório Gerencial: mesma análise da tabela "Por departamento", com os meses
 * do período lado a lado (do primeiro mês do período até o último com carga) e o bloco Acumulado, com a
 * mesma regra da visão Anual ou Trimestral da aba Padrão (vem pronto das views; nada é somado aqui).
 */
export function AcompanhamentoGerencial({
  distribuidoraId,
  periodo,
  rotuloPeriodo,
  totaisMensais,
}: {
  distribuidoraId: string | undefined
  periodo: PeriodoAcompanhamento | undefined
  /** ex.: "2026" ou "3º TRI/26" */
  rotuloPeriodo: string
  totaisMensais: TotalMensal[]
}) {
  const { podeEditar } = usePerfil()
  const ano = periodo?.ano
  const tri = periodo?.tipo === 'trimestre' ? periodo.tri : undefined
  // acumulado: view anual ou trimestral (só a do período escolhido fica ligada)
  const anual = useGerencialAnual(distribuidoraId, periodo?.tipo === 'ano' ? ano : undefined)
  const trimestral = useGerencialTrimestral(distribuidoraId, tri ? ano : undefined, tri)
  const acumulado = periodo?.tipo === 'trimestre' ? trimestral : anual
  const mensais = useGerencialMensalAno(distribuidoraId, ano)

  const mesesDoPeriodo = useMemo(() => calcularMesesDoPeriodo(ano, tri), [ano, tri])
  const totaisDoPeriodo = useMemo(
    () => totaisMensais.filter((t) => t.mes_ref && mesesDoPeriodo.includes(t.mes_ref)),
    [totaisMensais, mesesDoPeriodo],
  )
  const mesesComCarga = useMemo(() => new Set(totaisDoPeriodo.map((t) => t.mes_ref!)), [totaisDoPeriodo])
  // exibidos: do primeiro mês do período até o último com carga (meses sem carga no meio mostram "—")
  const meses = useMemo(() => {
    const ultimo = totaisDoPeriodo.reduce((max, t) => (t.mes_ref! > max ? t.mes_ref! : max), '')
    return ultimo ? mesesDoPeriodo.filter((m) => m <= ultimo) : []
  }, [totaisDoPeriodo, mesesDoPeriodo])

  const linhas = useMemo(() => {
    const base = acumulado.data?.linhas ?? []
    const doPeriodo = (mensais.data ?? []).filter((m) => m.mes_ref && mesesDoPeriodo.includes(m.mes_ref))
    return montarLinhas(base, base, doPeriodo, MEDIDAS_GERENCIAL)
  }, [acumulado.data, mensais.data, mesesDoPeriodo])
  const total = useMemo(
    () =>
      montarTotal(
        Object.fromEntries(totaisDoPeriodo.map((t) => [t.mes_ref!, valoresDoTotal(t)])),
        acumulado.data?.total ? valoresDoTotal(acumulado.data.total) : null,
      ),
    [totaisDoPeriodo, acumulado.data],
  )

  const mesesSemDespesa = totaisDoPeriodo.filter((t) => t.despesa == null)
  const carregando = acumulado.isPending || mensais.isPending
  const erro = acumulado.error ?? mensais.error
  const faixa = meses.length ? `${formatarMes(meses[0])} a ${formatarMes(meses[meses.length - 1])}` : ''

  if (erro) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Erro ao carregar o acompanhamento</AlertTitle>
        <AlertDescription>{erro.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      {/* alerta: despesa não lançada em algum mês exibido */}
      {mesesSemDespesa.length > 0 && (
        <Alert className="border-alerta-foreground/25 bg-alerta text-alerta-foreground">
          <AlertTriangle />
          <AlertTitle>Despesa não lançada em {mesesSemDespesa.map((m) => formatarMes(m.mes_ref)).join(', ')}</AlertTitle>
          <AlertDescription className="text-alerta-foreground/85">
            O LB¹ desses meses (e do acumulado) considera despesa zero.
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

      {/* cards: acumulado do período exibido (total anual ou trimestral, pronto da view) */}
      <CardsGerencial totais={acumulado.data?.total} carregando={carregando} />

      <TabelaAcompanhamento
        titulo="Por departamento, mês a mês"
        linhas={linhas}
        total={total}
        meses={meses}
        mesesComCarga={mesesComCarga}
        medidas={MEDIDAS_GERENCIAL}
        carregando={carregando}
        faixa={faixa}
        excel={{
          arquivo: `Relatorio_Gerencial_Duno_Pro_Acompanhamento_${tri ? `${ano}-T${tri}` : ano}.xlsx`,
          aba: `Acompanhamento ${rotuloPeriodo.replace('/', '-')}`,
          titulo: `Relatório Gerencial ${NOME_DUNO_PRO} — Acompanhamento ${rotuloPeriodo} (${faixa})`,
          rotuloTotalGeral: 'TOTAL GERAL (todos os departamentos)',
        }}
      />
    </>
  )
}
