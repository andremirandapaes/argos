import { Banknote, CircleDollarSign, Gauge, TrendingUp, Wallet } from 'lucide-react'
import { formatarMoeda, formatarPct } from '@/lib/format'
import { Indicador } from '@/components/Indicador'
import type { Totais } from './gerencial-tabela'

/** Cards de KPI do Relatório Gerencial (valores prontos das views de total; só formata). */
export function CardsGerencial({ totais: t, carregando }: { totais: Totais | null | undefined; carregando: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
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
        rotulo="Despesa"
        tom="despesa"
        icone={Wallet}
        carregando={carregando}
        valor={t?.despesa == null ? 'Não lançada' : formatarMoeda(t.despesa)}
      />
      <Indicador
        rotulo="Custo operacional"
        tom="custo"
        icone={Gauge}
        carregando={carregando}
        valor={formatarPct(t?.custo_op_pct)}
      />
      <Indicador
        rotulo="LB¹"
        tom="destaque"
        icone={CircleDollarSign}
        carregando={carregando}
        negativo={(t?.lb ?? 0) < 0}
        valor={formatarMoeda(t?.lb)}
        apoio={`${formatarPct(t?.lb_pct)} do faturamento`}
      />
    </div>
  )
}
