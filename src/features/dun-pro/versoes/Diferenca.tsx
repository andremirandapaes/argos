import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatarMoeda } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { moedaComSinal, semDiferenca } from './diferenca-util'

/** Selo da diferença: verde "SEM DIFERENÇA" quando igual; vermelho com o valor (+/-) quando mudou. */
export function SeloDiferenca({ dif }: { dif: number }) {
  const igual = semDiferenca(dif)
  return (
    <Badge
      className={cn(
        'h-7 gap-1.5 px-3 text-sm font-semibold tabular-nums [&>svg]:size-3.5!',
        igual
          ? 'border-positivo/30 bg-positivo/15 text-positivo'
          : 'border-destructive/30 bg-destructive/12 text-destructive',
      )}
    >
      {igual ? <CheckCircle2 data-icon="inline-start" /> : <AlertTriangle data-icon="inline-start" />}
      {igual ? 'SEM DIFERENÇA' : moedaComSinal(dif)}
    </Badge>
  )
}

/** Card com o valor antes, o valor depois e o selo da diferença (ex.: v1 × v2). */
export function CardDiferenca({
  rotulo,
  antes,
  depois,
  rotuloAntes,
  rotuloDepois,
}: {
  rotulo: string
  antes: number
  depois: number
  rotuloAntes: string
  rotuloDepois: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{rotulo}</span>
        <SeloDiferenca dif={depois - antes} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm tabular-nums">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">{rotuloAntes}</span>
          <span>{formatarMoeda(antes)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">{rotuloDepois}</span>
          <span className="font-medium">{formatarMoeda(depois)}</span>
        </div>
      </div>
    </div>
  )
}
