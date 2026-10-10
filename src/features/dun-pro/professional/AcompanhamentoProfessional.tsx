import { useMemo } from 'react'
import { AlertTriangle, Banknote, Tags, TrendingUp } from 'lucide-react'
import { NOME_DUNO_PRO } from '@/lib/constantes'
import { formatarMes, formatarMoeda, formatarPct } from '@/lib/format'
import { Indicador } from '@/components/Indicador'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { TotalMensal } from '../api'
import {
  MEDIDAS_PROFESSIONAL,
  mesesDoPeriodo as calcularMesesDoPeriodo,
  montarLinhas,
  montarTotal,
  valoresDe,
  type Valores,
} from '../acompanhamento/acompanhamento-tabela'
import type { PeriodoAcompanhamento } from '../acompanhamento/AcompanhamentoGerencial'
import { TabelaAcompanhamento } from '../acompanhamento/TabelaAcompanhamento'
import {
  useExclusivos,
  useProfessional,
  useProfessionalMensalAno,
  useProfessionalTotaisAno,
  viewsProfessionalAusentes,
  type TotalProfessional,
} from './api-professional'

const MIGRATION = 'supabase/migrations/20260930000000_argos_professional_totais.sql'

/** Total no formato das colunas; no TOTAL a participação é 100% por definição. */
function valoresDoTotal(t: TotalProfessional): Valores {
  return { ...valoresDe(t, MEDIDAS_PROFESSIONAL), participacao: 1 }
}

/**
 * Aba Acompanhamento do PROFESSIONAL: meses lado a lado para os departamentos exclusivos
 * (todos aparecem, mesmo sem venda) e o bloco Acumulado com a regra da visão Anual/Trimestral
 * do PROFESSIONAL. Tudo vem pronto das views; nada é somado aqui.
 */
export function AcompanhamentoProfessional({
  distribuidoraId,
  periodo,
  rotuloPeriodo,
  totaisMensais,
}: {
  distribuidoraId: string | undefined
  periodo: PeriodoAcompanhamento | undefined
  rotuloPeriodo: string
  /** totais do Gerencial: definem quais meses têm base de faturamento */
  totaisMensais: TotalMensal[]
}) {
  const ano = periodo?.ano
  const tri = periodo?.tipo === 'trimestre' ? periodo.tri : undefined
  const exclusivos = useExclusivos(distribuidoraId)
  const acumulado = useProfessional(
    distribuidoraId,
    !ano ? undefined : tri ? { visao: 'trimestral', ano, tri } : { visao: 'anual', ano },
  )
  const mensais = useProfessionalMensalAno(distribuidoraId, ano)
  const totaisProf = useProfessionalTotaisAno(distribuidoraId, ano)

  // meses com carga vêm da base de faturamento (um mês com carga e sem venda de exclusivo mostra zero)
  const mesesDoPeriodo = useMemo(() => calcularMesesDoPeriodo(ano, tri), [ano, tri])
  const mesesComCarga = useMemo(
    () => new Set(totaisMensais.filter((t) => t.mes_ref && mesesDoPeriodo.includes(t.mes_ref)).map((t) => t.mes_ref!)),
    [totaisMensais, mesesDoPeriodo],
  )
  const meses = useMemo(() => {
    const ultimo = [...mesesComCarga].reduce((max, m) => (m > max ? m : max), '')
    return ultimo ? mesesDoPeriodo.filter((m) => m <= ultimo) : []
  }, [mesesComCarga, mesesDoPeriodo])

  const linhas = useMemo(() => {
    const deptos = (exclusivos.data ?? []).map((d) => ({ departamento_id: d.id, codigo_winthor: d.codigo_winthor, nome: d.nome }))
    const doPeriodo = (mensais.data ?? []).filter((m) => m.mes_ref && mesesDoPeriodo.includes(m.mes_ref))
    return montarLinhas(deptos, acumulado.data?.linhas ?? [], doPeriodo, MEDIDAS_PROFESSIONAL)
  }, [exclusivos.data, acumulado.data, mensais.data, mesesDoPeriodo])
  const total = useMemo(
    () =>
      montarTotal(
        Object.fromEntries((totaisProf.data ?? []).map((t) => [t.mes_ref!, valoresDoTotal(t)])),
        acumulado.data?.total ? valoresDoTotal(acumulado.data.total) : null,
      ),
    [totaisProf.data, acumulado.data],
  )

  const t = acumulado.data?.total
  const comVenda = linhas.filter((l) => (l.acumulado?.faturamento_liquido ?? 0) !== 0).length
  const carregando = exclusivos.isPending || acumulado.isPending || mensais.isPending || totaisProf.isPending
  const erro = exclusivos.error ?? acumulado.error ?? mensais.error ?? totaisProf.error
  const faixa = meses.length ? `${formatarMes(meses[0])} a ${formatarMes(meses[meses.length - 1])}` : ''

  if (erro) {
    return viewsProfessionalAusentes(erro) ? (
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
        <AlertTitle>Erro ao carregar o acompanhamento</AlertTitle>
        <AlertDescription>{erro.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      {/* cards: acumulado do período (total anual ou trimestral do PROFESSIONAL, pronto da view) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Indicador rotulo="Faturamento líquido" tom="fat" icone={Banknote} carregando={carregando} valor={formatarMoeda(t?.faturamento_liquido)} />
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
          apoio={`no período (${rotuloPeriodo})`}
        />
      </div>

      <TabelaAcompanhamento
        titulo="Departamentos exclusivos, mês a mês"
        linhas={linhas}
        total={total}
        meses={meses}
        mesesComCarga={mesesComCarga}
        medidas={MEDIDAS_PROFESSIONAL}
        carregando={carregando}
        faixa={faixa}
        excel={{
          arquivo: `Professional_Duno_Pro_Acompanhamento_${tri ? `${ano}-T${tri}` : ano}.xlsx`,
          aba: `Acompanhamento ${rotuloPeriodo.replace('/', '-')}`,
          titulo: `Professional Dpts ${NOME_DUNO_PRO} — Acompanhamento ${rotuloPeriodo} (${faixa})`,
          rotuloTotalGeral: 'TOTAL GERAL (todos os exclusivos)',
        }}
      />
    </>
  )
}
