import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Cor do card. Cada tom tem faixa lateral e chip do ícone na mesma cor;
 * "destaque" é o card cheio no gradiente da marca, marinho → petróleo (resultado principal, ex.: LB¹).
 */
export type TomIndicador = 'fat' | 'margem' | 'despesa' | 'custo' | 'neutro' | 'destaque'

// classes literais (o Tailwind precisa enxergá-las no código)
const TONS: Record<Exclude<TomIndicador, 'destaque'>, { faixa: string; chip: string }> = {
  fat: { faixa: 'bg-kpi-fat', chip: 'bg-kpi-fat/15 text-kpi-fat' },
  margem: { faixa: 'bg-kpi-margem', chip: 'bg-kpi-margem/18 text-kpi-margem' },
  despesa: { faixa: 'bg-kpi-despesa', chip: 'bg-kpi-despesa/12 text-kpi-despesa' },
  custo: { faixa: 'bg-kpi-custo', chip: 'bg-kpi-custo/14 text-kpi-custo' },
  neutro: { faixa: 'bg-border', chip: 'bg-muted text-muted-foreground' },
}

/** Card de indicador (KPI): rótulo, valor principal e uma linha de apoio opcional. */
export function Indicador({
  rotulo,
  valor,
  apoio,
  icone: Icone,
  tom = 'neutro',
  negativo = false,
  carregando = false,
  extra,
}: {
  rotulo: string
  valor: ReactNode
  apoio?: ReactNode
  icone?: LucideIcon
  tom?: TomIndicador
  /** pinta o valor de vermelho (ex.: LB¹ negativo) */
  negativo?: boolean
  carregando?: boolean
  /** conteúdo livre abaixo do valor (ex.: barra de composição, aviso) */
  extra?: ReactNode
}) {
  const destaque = tom === 'destaque'
  const cores = destaque ? null : TONS[tom]

  return (
    <div
      className={cn(
        'group relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl p-4 pl-5 transition-all duration-200',
        'shadow-card hover:-translate-y-0.5 hover:shadow-card-hover',
        destaque
          ? 'bg-linear-to-br from-kpi-destaque-de to-kpi-destaque-ate text-kpi-destaque-texto ring-1 ring-kpi-destaque-texto/10'
          : 'border bg-card',
      )}
    >
      {/* faixa de cor à esquerda */}
      <span
        aria-hidden
        className={cn('absolute inset-y-0 left-0 w-1', destaque ? 'bg-kpi-destaque-brilho' : cores!.faixa)}
      />
      {/* brilho decorativo no card de destaque */}
      {destaque && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-kpi-destaque-brilho opacity-20 blur-2xl"
        />
      )}

      <div className="relative flex items-center justify-between gap-2">
        <span
          className={cn(
            'truncate text-[11px] font-semibold tracking-wider uppercase',
            destaque ? 'text-kpi-destaque-texto/75' : 'text-muted-foreground',
          )}
        >
          {rotulo}
        </span>
        {Icone && (
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg',
              destaque ? 'bg-kpi-destaque-texto/12 text-kpi-destaque-texto' : cores!.chip,
            )}
          >
            <Icone className="size-4" strokeWidth={2.25} />
          </span>
        )}
      </div>

      {carregando ? (
        <div className="relative flex flex-col gap-2">
          <Skeleton className={cn('h-7 w-3/4', destaque && 'bg-kpi-destaque-texto/15')} />
          <Skeleton className={cn('h-4 w-1/3', destaque && 'bg-kpi-destaque-texto/15')} />
        </div>
      ) : (
        <div className="relative flex flex-col gap-1">
          <div
            className={cn(
              'truncate text-[22px] leading-tight font-semibold tracking-tight tabular-nums',
              negativo && (destaque ? 'text-kpi-destaque-negativo' : 'text-destructive'),
            )}
          >
            {valor}
          </div>
          {/* altura reservada mesmo sem apoio, para os cards ficarem alinhados */}
          <div
            className={cn(
              'min-h-5 truncate text-sm font-medium tabular-nums',
              destaque ? 'text-kpi-destaque-texto/80' : 'text-muted-foreground',
            )}
          >
            {apoio}
          </div>
          {extra}
        </div>
      )}
    </div>
  )
}
