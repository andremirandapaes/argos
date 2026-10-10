import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { fmtPessoas } from './componentes'
import type { SerieLinha } from './GraficoLinhas'

type Ponto = { rotulo: string; dica: string; faltas: string[] } & Record<string, number | null | string | string[]>

/**
 * Colunas mensais (uma série = total; várias = colunas agrupadas lado a lado).
 * Mês com base faltando fica sem coluna, para não parecer queda de headcount; a dica mostra o que falta.
 */
export function GraficoBarras({
  rotulos,
  dicas,
  series,
  faltas,
  mostrarRotulos = false,
}: {
  /** texto do eixo (ex.: "Jan") */
  rotulos: string[]
  /** título da dica (ex.: "Jan/26") */
  dicas: string[]
  series: SerieLinha[]
  faltas: string[][]
  mostrarRotulos?: boolean
}) {
  const chaves = series.map((_, i) => `s${i}`)
  const config = Object.fromEntries(series.map((s, i) => [chaves[i], { label: s.nome, color: s.cor }])) satisfies ChartConfig
  const pontos: Ponto[] = rotulos.map((r, m) => {
    const p: Ponto = { rotulo: r, dica: dicas[m] ?? r, faltas: faltas[m] ?? [] }
    series.forEach((s, i) => {
      p[chaves[i]] = s.valores[m]
    })
    return p
  })
  const varias = series.length > 1

  function Dica({ active, payload }: TooltipContentProps<ValueType, NameType>) {
    const p = payload?.[0]?.payload as Ponto | undefined
    if (!active || !p) return null
    return (
      <div className="grid max-w-72 min-w-44 gap-1.5 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
        <div className="font-medium">{p.dica}</div>
        {series.map((s, i) => (
          <div key={s.nome} className="flex items-center justify-between gap-4">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span className="size-2 shrink-0 rounded-[2px]" style={{ background: s.cor }} />
              <span className="truncate">{s.nome}</span>
            </span>
            <span className="font-medium tabular-nums">{fmtPessoas(p[chaves[i]] as number | null)}</span>
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
      <ChartContainer config={config} className="aspect-auto h-72 w-full">
        <BarChart
          data={pontos}
          margin={{ top: mostrarRotulos ? 24 : 12, right: 8, left: 8, bottom: 0 }}
          barCategoryGap={varias ? '18%' : '30%'}
          barGap={2}
        >
          <CartesianGrid vertical={false} strokeOpacity={0.5} />
          <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} />
          {/* eixo vertical oculto (como no Duno Pro): valores na dica e nos rótulos */}
          <YAxis hide domain={[0, 'auto']} />
          <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} content={Dica} />
          {series.map((s, i) => (
            <Bar key={s.nome} dataKey={chaves[i]} fill={s.cor} radius={[4, 4, 0, 0]} maxBarSize={varias ? 28 : 56} isAnimationActive={false}>
              {mostrarRotulos && (
                <LabelList
                  dataKey={chaves[i]}
                  position="top"
                  offset={6}
                  className="fill-muted-foreground text-[11px] font-medium tabular-nums"
                  formatter={(v: unknown) => (typeof v === 'number' ? fmtPessoas(v) : '')}
                />
              )}
            </Bar>
          ))}
        </BarChart>
      </ChartContainer>
      {varias && (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {series.map((s) => (
            <li key={s.nome} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px]" style={{ background: s.cor }} />
              {s.nome}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
