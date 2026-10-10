import { useRef, useState, type MouseEvent } from 'react'
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { formatarMoeda, formatarMoedaCompacta, formatarPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'

/** Um ponto por mês na linha do tempo (meses sem valor ficam null e viram lacuna na linha). */
export type PontoDespesa = {
  mesRef: string
  rotulo: string
  despesa: number | null
  /** fração (0.0955 = 9,55%); null quando o mês não tem base de faturamento */
  custoOp: number | null
}

/** Intervalo selecionado no gráfico, em índices de `pontos` (inicio <= fim). */
export type SelecaoMeses = { inicio: number; fim: number }

const configDespesa = { despesa: { label: 'Despesa', color: 'var(--kpi-despesa)' } } satisfies ChartConfig
const configCusto = { custoOp: { label: 'Custo operacional', color: 'var(--kpi-custo)' } } satisfies ChartConfig

/** Tooltip único para os dois gráficos: mostra as duas medidas do mês. */
function DicaMes({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  const p = payload?.[0]?.payload as PontoDespesa | undefined
  if (!active || !p) return null
  return (
    <div className="grid min-w-44 gap-1.5 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <div className="font-medium">{p.rotulo}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full bg-kpi-despesa" /> Despesa
        </span>
        <span className="font-medium tabular-nums">{p.despesa == null ? 'não lançada' : formatarMoeda(p.despesa)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full bg-kpi-custo" /> Custo operacional
        </span>
        <span className="font-medium tabular-nums">
          {p.custoOp == null ? (p.despesa == null ? '—' : 'sem base de faturamento') : formatarPct(p.custoOp)}
        </span>
      </div>
    </div>
  )
}

/** Rótulo de dado: texto neutro (nunca a cor da série), acima do ponto. */
const estiloRotulo = { position: 'top', offset: 10, className: 'fill-muted-foreground text-xs font-medium tabular-nums' } as const
const rotuloMoeda = (v: unknown) => (typeof v === 'number' ? formatarMoedaCompacta(v).replace('R$ ', '') : '')
const rotuloPct = (v: unknown) => (typeof v === 'number' ? formatarPct(v) : '')

/** Margem lateral do gráfico e folga do eixo de meses nas pontas (px) — usadas também para achar o mês sob o mouse. */
const MARGEM_X = 8
const FOLGA_X = 28

const eixoX = {
  dataKey: 'rotulo',
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  minTickGap: 12,
  // folga nas pontas: o primeiro/último ponto (e seu rótulo) não encostam na borda
  padding: { left: FOLGA_X, right: FOLGA_X },
} as const

/**
 * Mês (índice em `pontos`) sob o cursor, calculado pela posição do mouse.
 * Os pontos ficam igualmente espaçados entre as folgas; o eixo vertical está oculto (largura zero).
 */
function indiceNaPosicao(clientX: number, area: DOMRect, total: number) {
  if (total <= 1) return 0
  const inicio = area.left + MARGEM_X + FOLGA_X
  const largura = area.width - 2 * (MARGEM_X + FOLGA_X)
  const i = Math.round(((clientX - inicio) / largura) * (total - 1))
  return Math.min(total - 1, Math.max(0, i))
}

/**
 * Acompanhamento da despesa: dois gráficos de linha empilhados (sem eixo duplo),
 * com o mesmo eixo de meses, cursor sincronizado e seleção de meses por arraste.
 */
export function GraficoDespesas({
  pontos,
  rotulos = false,
  selecao,
  onSelecionar,
}: {
  pontos: PontoDespesa[]
  rotulos?: boolean
  selecao: SelecaoMeses | null
  onSelecionar: (selecao: SelecaoMeses) => void
}) {
  // arraste em andamento (índice onde começou e onde está o mouse); a ref é a fonte da verdade
  // durante o arraste, o estado só serve para redesenhar a faixa
  const [arraste, setArraste] = useState<{ de: number; ate: number } | null>(null)
  const arrasteAtual = useRef<{ de: number; ate: number } | null>(null)

  const faixa = arraste
    ? { inicio: Math.min(arraste.de, arraste.ate), fim: Math.max(arraste.de, arraste.ate) }
    : selecao

  function mudarArraste(novo: { de: number; ate: number } | null) {
    arrasteAtual.current = novo
    setArraste(novo)
  }
  function concluirArraste() {
    const a = arrasteAtual.current
    if (a) onSelecionar({ inicio: Math.min(a.de, a.ate), fim: Math.max(a.de, a.ate) })
    mudarArraste(null)
  }

  // eventos nativos na camada em volta do gráfico (não dependem dos eventos do Recharts)
  const eventos = {
    onMouseDown: (e: MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      const i = indiceNaPosicao(e.clientX, e.currentTarget.getBoundingClientRect(), pontos.length)
      mudarArraste({ de: i, ate: i })
    },
    onMouseMove: (e: MouseEvent<HTMLDivElement>) => {
      const a = arrasteAtual.current
      if (!a) return
      const i = indiceNaPosicao(e.clientX, e.currentTarget.getBoundingClientRect(), pontos.length)
      if (i !== a.ate) mudarArraste({ ...a, ate: i })
    },
    onMouseUp: concluirArraste,
    onMouseLeave: concluirArraste,
  }

  const margem = { top: rotulos ? 28 : 12, right: MARGEM_X, left: MARGEM_X, bottom: 0 }
  // faixa selecionada: área entre os meses; um mês só (área de largura zero) vira uma linha destacada
  const areaSelecao =
    faixa && pontos[faixa.inicio] && pontos[faixa.fim] ? (
      faixa.inicio === faixa.fim ? (
        <ReferenceLine
          x={pontos[faixa.inicio].rotulo}
          stroke="var(--primary)"
          strokeOpacity={0.18}
          strokeWidth={14}
          ifOverflow="extendDomain"
        />
      ) : (
        // cor passada por propriedade: o Recharts sobrescreve classes de fill/stroke
        <ReferenceArea
          x1={pontos[faixa.inicio].rotulo}
          x2={pontos[faixa.fim].rotulo}
          fill="var(--primary)"
          fillOpacity={0.08}
          stroke="var(--primary)"
          strokeOpacity={0.25}
          ifOverflow="extendDomain"
        />
      )
    ) : null

  const graficos = [
    {
      titulo: 'Despesa (R$)',
      config: configDespesa,
      chave: 'despesa' as const,
      altura: 'h-48',
      cor: 'var(--color-despesa)',
      formatar: rotuloMoeda,
    },
    {
      titulo: 'Custo operacional (% do faturamento)',
      config: configCusto,
      chave: 'custoOp' as const,
      altura: 'h-40',
      cor: 'var(--color-custoOp)',
      formatar: rotuloPct,
    },
  ]

  return (
    <div className="flex flex-col gap-4 select-none">
      {graficos.map((g) => (
        <figure key={g.chave} className="flex flex-col gap-1">
          <figcaption className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{g.titulo}</figcaption>
          <div {...eventos}>
          <ChartContainer config={g.config} className={cn('aspect-auto w-full cursor-crosshair', g.altura)}>
            <LineChart data={pontos} syncId="acompanhamento-despesa" margin={margem}>
              <CartesianGrid vertical={false} strokeOpacity={0.5} />
              <XAxis {...eixoX} />
              {/* eixo vertical oculto: os valores aparecem nos rótulos e na dica */}
              <YAxis hide domain={[0, 'auto']} />
              {areaSelecao}
              <ChartTooltip cursor={!arraste} content={arraste ? () => null : DicaMes} />
              <Line
                dataKey={g.chave}
                type="linear"
                stroke={g.cor}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
                connectNulls={false}
                isAnimationActive={false}
              >
                {rotulos && <LabelList dataKey={g.chave} {...estiloRotulo} formatter={g.formatar} />}
              </Line>
            </LineChart>
          </ChartContainer>
          </div>
        </figure>
      ))}
    </div>
  )
}