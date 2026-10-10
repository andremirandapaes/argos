import { useRef, useState, type MouseEvent } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceArea,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { formatarMoeda, formatarMoedaCompacta, formatarPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'

/** Um ponto por mês do ano (null = mês sem base de faturamento). */
export type PontoEvolucao = {
  mesRef: string
  rotulo: string
  faturamento: number | null
  margemPct: number | null
  lbPct: number | null
  /** null quando o mês não tem despesa lançada */
  custoOp: number | null
  temDespesa: boolean
}

const configFaturamento = { faturamento: { label: 'Faturamento líquido', color: 'var(--kpi-fat)' } } satisfies ChartConfig
// cores das séries validadas com o dataviz validate_palette (todos os pares, claro e escuro)
const configPercentuais = {
  margemPct: { label: 'Margem %', color: 'var(--serie-margem)' },
  lbPct: { label: 'LB¹ %', color: 'var(--serie-lb)' },
  custoOp: { label: 'Custo operacional %', color: 'var(--kpi-custo)' },
} satisfies ChartConfig

/** Linha da dica; cor é uma classe de fundo do tema (ex.: bg-kpi-fat). */
function LinhaDica({ cor, rotulo, valor }: { cor: string; rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className={cn('size-2 rounded-full', cor)} /> {rotulo}
      </span>
      <span className="font-medium tabular-nums">{valor}</span>
    </div>
  )
}

/** Dica única para os dois gráficos: todas as medidas do mês. */
function DicaMes({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  const p = payload?.[0]?.payload as PontoEvolucao | undefined
  if (!active || !p) return null
  if (p.faturamento == null) {
    return (
      <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md">
        <span className="font-medium text-popover-foreground">{p.rotulo}</span> · sem base de faturamento
      </div>
    )
  }
  return (
    <div className="grid min-w-52 gap-1.5 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <div className="font-medium">{p.rotulo}</div>
      <LinhaDica cor="bg-kpi-fat" rotulo="Faturamento" valor={formatarMoeda(p.faturamento)} />
      <LinhaDica cor="bg-serie-margem" rotulo="Margem %" valor={formatarPct(p.margemPct)} />
      <LinhaDica cor="bg-serie-lb" rotulo="LB¹ %" valor={formatarPct(p.lbPct)} />
      <LinhaDica cor="bg-kpi-custo" rotulo="Custo operacional %" valor={p.temDespesa ? formatarPct(p.custoOp) : '—'} />
      {!p.temDespesa && <div className="text-alerta-foreground">Despesa não lançada: LB¹ considera despesa zero.</div>}
    </div>
  )
}

const eixoX = { dataKey: 'rotulo', tickLine: false, axisLine: false, tickMargin: 8, minTickGap: 12 } as const
const estiloRotulo = { position: 'top', offset: 8, className: 'fill-muted-foreground text-xs font-medium tabular-nums' } as const
const rotuloMoeda = (v: unknown) => (typeof v === 'number' ? formatarMoedaCompacta(v).replace('R$ ', '') : '')
const rotuloPct = (v: unknown) => (typeof v === 'number' ? formatarPct(v) : '')

type PropsRotulo = { x?: number | string; y?: number | string; value?: unknown; index?: number }

/**
 * Rótulo das linhas de %. LB¹ % e custo operacional % costumam ficar próximos e às vezes se cruzam:
 * em cada mês, o maior dos dois leva o rótulo acima do ponto e o menor, abaixo. Margem % (a mais alta) fica acima.
 */
function RotuloPct({
  x,
  y,
  value,
  index,
  chave,
  pontos,
}: PropsRotulo & { chave: 'margemPct' | 'lbPct' | 'custoOp'; pontos: PontoEvolucao[] }) {
  if (typeof value !== 'number' || index == null) return null
  const p = pontos[index]
  const outro = chave === 'lbPct' ? p?.custoOp : chave === 'custoOp' ? p?.lbPct : null
  const abaixo = outro != null && value < outro
  return (
    <text
      x={Number(x)}
      y={Number(y) + (abaixo ? 18 : -10)}
      textAnchor="middle"
      className="fill-muted-foreground text-xs font-medium tabular-nums"
    >
      {rotuloPct(value)}
    </text>
  )
}

/** Intervalo de meses escolhido no gráfico, em índices de `pontos` (inicio <= fim). */
export type SelecaoMeses = { inicio: number; fim: number }

/** Margens laterais do gráfico (px) — usadas também para achar o mês sob o mouse. */
const MARGEM_X = 12

/**
 * Mês (índice em `pontos`) sob o cursor. O eixo de meses usa faixas iguais (uma por mês),
 * então basta ver em qual faixa o mouse está; o eixo vertical está oculto (largura zero).
 */
function indiceNaFaixa(clientX: number, area: DOMRect, total: number) {
  const largura = area.width - 2 * MARGEM_X
  const i = Math.floor(((clientX - area.left - MARGEM_X) / largura) * total)
  return Math.min(total - 1, Math.max(0, i))
}

/**
 * Evolução: faturamento em barras (R$) e, embaixo, margem %, LB¹ % e custo operacional % em linhas
 * (um eixo por gráfico, nunca eixo duplo), com o mesmo eixo de meses e cursor sincronizado.
 * Arrastar (ou clicar) sobre qualquer um dos dois escolhe os meses.
 */
export function GraficoEvolucao({
  pontos,
  rotulos,
  onSelecionar,
}: {
  pontos: PontoEvolucao[]
  rotulos: boolean
  onSelecionar: (selecao: SelecaoMeses) => void
}) {
  const margem = { top: rotulos ? 26 : 10, right: MARGEM_X, left: MARGEM_X, bottom: 0 }

  // arraste em andamento: a ref é a fonte da verdade, o estado só redesenha a faixa
  const [arraste, setArraste] = useState<{ de: number; ate: number } | null>(null)
  const arrasteAtual = useRef<{ de: number; ate: number } | null>(null)
  function mudarArraste(novo: { de: number; ate: number } | null) {
    arrasteAtual.current = novo
    setArraste(novo)
  }
  function concluirArraste() {
    const a = arrasteAtual.current
    if (a) onSelecionar({ inicio: Math.min(a.de, a.ate), fim: Math.max(a.de, a.ate) })
    mudarArraste(null)
  }
  const eventos = {
    onMouseDown: (e: MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      const i = indiceNaFaixa(e.clientX, e.currentTarget.getBoundingClientRect(), pontos.length)
      mudarArraste({ de: i, ate: i })
    },
    onMouseMove: (e: MouseEvent<HTMLDivElement>) => {
      const a = arrasteAtual.current
      if (!a) return
      const i = indiceNaFaixa(e.clientX, e.currentTarget.getBoundingClientRect(), pontos.length)
      if (i !== a.ate) mudarArraste({ ...a, ate: i })
    },
    onMouseUp: concluirArraste,
    onMouseLeave: concluirArraste,
  }

  // gráfico sob o mouse: a dica aparece só nele (o mês continua destacado nos dois, pelo syncId)
  const [sobre, setSobre] = useState<'barras' | 'linhas' | null>(null)
  const eventosDe = (g: 'barras' | 'linhas') => ({
    ...eventos,
    onMouseEnter: () => setSobre(g),
    onMouseLeave: () => {
      setSobre(null)
      concluirArraste()
    },
  })

  // faixa destacada enquanto arrasta (ao soltar, o gráfico passa a mostrar só esses meses)
  const faixa =
    arraste && pontos.length ? (
      <ReferenceArea
        x1={pontos[Math.min(arraste.de, arraste.ate)].rotulo}
        x2={pontos[Math.max(arraste.de, arraste.ate)].rotulo}
        fill="var(--primary)"
        fillOpacity={0.1}
        stroke="var(--primary)"
        strokeOpacity={0.3}
        ifOverflow="extendDomain"
      />
    ) : null

  return (
    <div className="flex flex-col gap-5 select-none">
      <figure className="flex flex-col gap-1">
        <figcaption className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Faturamento líquido (R$)
        </figcaption>
        <div {...eventosDe('barras')}>
          <ChartContainer config={configFaturamento} className="aspect-auto h-52 w-full cursor-crosshair">
            <BarChart data={pontos} syncId="evolucao" margin={margem} barCategoryGap="22%">
              <CartesianGrid vertical={false} strokeOpacity={0.5} />
              <XAxis {...eixoX} />
              {/* eixo vertical oculto (como em Despesas): valores nos rótulos e na dica */}
              <YAxis hide domain={[0, 'auto']} />
              {faixa}
              <ChartTooltip cursor={arraste ? false : { fill: 'var(--muted)', opacity: 0.6 }} content={arraste || sobre !== 'barras' ? () => null : DicaMes} />
              <Bar dataKey="faturamento" fill="var(--color-faturamento)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {rotulos && <LabelList dataKey="faturamento" {...estiloRotulo} formatter={rotuloMoeda} />}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      </figure>

      <figure className="flex flex-col gap-1">
        <figcaption className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Percentuais sobre o faturamento
        </figcaption>
        <div {...eventosDe('linhas')}>
          <ChartContainer config={configPercentuais} className="aspect-auto h-60 w-full cursor-crosshair">
            <LineChart data={pontos} syncId="evolucao" margin={margem}>
              <CartesianGrid vertical={false} strokeOpacity={0.5} />
              {/* escala em faixas, como a das barras: cada ponto fica no centro do mês, alinhado com a barra acima */}
              <XAxis {...eixoX} scale="band" />
              <YAxis hide domain={[0, 'auto']} />
              {faixa}
              <ChartTooltip cursor={!arraste} content={arraste || sobre !== 'linhas' ? () => null : DicaMes} />
              <ChartLegend content={<ChartLegendContent />} verticalAlign="top" />
              {(['margemPct', 'lbPct', 'custoOp'] as const).map((chave) => (
                <Line
                  key={chave}
                  dataKey={chave}
                  type="linear"
                  stroke={`var(--color-${chave})`}
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
                  connectNulls={false}
                  isAnimationActive={false}
                >
                  {rotulos && (
                    <LabelList
                      dataKey={chave}
                      content={(p) => <RotuloPct {...(p as PropsRotulo)} chave={chave} pontos={pontos} />}
                    />
                  )}
                </Line>
              ))}
            </LineChart>
          </ChartContainer>
        </div>
      </figure>
    </div>
  )
}