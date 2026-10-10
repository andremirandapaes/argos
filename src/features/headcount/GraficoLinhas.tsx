import { CartesianGrid, LabelList, Line, LineChart, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { fmtPessoas } from './componentes'

export type SerieLinha = {
  nome: string
  /** cor CSS, ex.: "var(--hc-comercial)" */
  cor: string
  destaque?: boolean
  /** linha tracejada (ex.: ano anterior no comparativo) */
  tracejado?: boolean
  /** um valor por mês; null = mês sem ponto (base faltando) */
  valores: (number | null)[]
}

type Ponto = { rotulo: string; faltas: string[] } & Record<string, number | null | string | string[]>

/**
 * Evolução mensal em linhas. Mês com base faltando fica sem ponto (a linha quebra),
 * para não parecer queda de headcount; a dica mostra o que falta.
 */
export function GraficoLinhas({
  rotulos,
  series,
  faltas,
  mostrarRotulos = false,
  altura = 'h-72',
  compacto = false,
  escalaAjustada = false,
}: {
  rotulos: string[]
  series: SerieLinha[]
  faltas: string[][]
  mostrarRotulos?: boolean
  altura?: string
  /** versão pequena (gráficos por área): margens menores e menos marcas no eixo */
  compacto?: boolean
  /** escala vertical ajustada ao intervalo dos dados (não começa no zero), para comparar linhas próximas */
  escalaAjustada?: boolean
}) {
  const chaves = series.map((_, i) => `s${i}`)
  const config = Object.fromEntries(series.map((s, i) => [chaves[i], { label: s.nome, color: s.cor }])) satisfies ChartConfig
  const pontos: Ponto[] = rotulos.map((r, m) => {
    const p: Ponto = { rotulo: r, faltas: faltas[m] ?? [] }
    series.forEach((s, i) => {
      p[chaves[i]] = s.valores[m]
    })
    return p
  })

  function Dica({ active, payload }: TooltipContentProps<ValueType, NameType>) {
    const p = payload?.[0]?.payload as Ponto | undefined
    if (!active || !p) return null
    const linhas = series
      .map((s, i) => ({ s, v: p[chaves[i]] as number | null }))
      .sort((a, b) => Number(!!b.s.destaque) - Number(!!a.s.destaque) || (b.v ?? -1) - (a.v ?? -1))
    return (
      <div className="grid max-w-72 min-w-44 gap-1.5 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
        <div className="font-medium">{p.rotulo}</div>
        {linhas.map(({ s, v }) => (
          <div key={s.nome} className="flex items-center justify-between gap-4">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span className="size-2 shrink-0 rounded-full" style={{ background: s.cor }} />
              <span className="truncate">{s.nome}</span>
            </span>
            <span className="font-medium tabular-nums">{fmtPessoas(v)}</span>
          </div>
        ))}
        {p.faltas.length > 0 && (
          <div className="mt-1 border-t pt-1.5 text-alerta-foreground">
            <div className="font-medium">Base incompleta neste mês:</div>
            {p.faltas.slice(0, 6).map((f) => (
              <div key={f}>• {f}</div>
            ))}
            {p.faltas.length > 6 && <div>e mais {p.faltas.length - 6}</div>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <ChartContainer config={config} className={`aspect-auto w-full ${altura}`}>
        <LineChart
          data={pontos}
          margin={compacto ? { top: mostrarRotulos ? 20 : 8, right: 12, left: 12, bottom: 0 } : { top: mostrarRotulos ? 24 : 12, right: 16, left: 16, bottom: 0 }}
        >
          <CartesianGrid vertical={false} strokeOpacity={0.5} />
          <XAxis
            dataKey="rotulo"
            tickLine={false}
            axisLine={false}
            tickMargin={compacto ? 4 : 8}
            minTickGap={compacto ? 28 : 12}
            tick={compacto ? { fontSize: 10 } : undefined}
          />
          {/* compacto: escala própria da área (não começa no zero), para a variação aparecer */}
          <YAxis
            hide
            domain={
              compacto || escalaAjustada
                ? [(min: number) => Math.max(0, Math.floor(min * 0.95)), (max: number) => Math.ceil(max * 1.03)]
                : [0, 'auto']
            }
          />
          <ChartTooltip content={Dica} />
          {series.map((s, i) => (
            <Line
              key={s.nome}
              dataKey={chaves[i]}
              type="linear"
              stroke={s.cor}
              strokeWidth={s.destaque ? 2.75 : 2}
              strokeDasharray={s.tracejado ? '6 4' : undefined}
              dot={compacto ? { r: 2, strokeWidth: 1.5, fill: 'var(--card)' } : { r: s.destaque ? 3.5 : 3, strokeWidth: 2, fill: 'var(--card)' }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
              connectNulls={false}
              isAnimationActive={false}
            >
              {mostrarRotulos && (
                <LabelList
                  dataKey={chaves[i]}
                  position="top"
                  offset={8}
                  className={compacto ? 'fill-muted-foreground text-[10px] tabular-nums' : 'fill-muted-foreground text-[11px] font-medium tabular-nums'}
                  formatter={(v: unknown) => (typeof v === 'number' ? fmtPessoas(v) : '')}
                />
              )}
            </Line>
          ))}
        </LineChart>
      </ChartContainer>
      {/* legenda própria: só aparece com mais de uma série */}
      {series.length > 1 && (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {series.map((s) => (
            <li key={s.nome} className="flex items-center gap-1.5">
              {s.tracejado ? (
                <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: s.cor }} />
              ) : (
                <span className={s.destaque ? 'h-[3px] w-3.5 rounded-full' : 'h-0.5 w-3.5 rounded-full'} style={{ background: s.cor }} />
              )}
              <span className={s.destaque ? 'font-medium text-foreground' : undefined}>{s.nome}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
