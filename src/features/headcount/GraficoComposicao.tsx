import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Composicao } from './regras'
import { fmtPct1, fmtPessoas } from './componentes'

const PARTES = [
  { chave: 'CLT', rotulo: 'CLT', classe: 'bg-hc-clt' },
  { chave: 'Terceirizado', rotulo: 'Terceirizados', classe: 'bg-hc-terc' },
  { chave: 'Não informado', rotulo: 'Não informado', classe: 'hc-hachura' },
] as const

/** Barras horizontais empilhadas (CLT, terceirizados e não informado) por grupo, na mesma escala. */
export function GraficoComposicao({ grupos, mostrarNaoInformado }: { grupos: Composicao; mostrarNaoInformado: boolean }) {
  const partes = PARTES.filter((p) => p.chave !== 'Não informado' || mostrarNaoInformado)
  const totais = grupos.map(([, v]) => partes.reduce((s, p) => s + v[p.chave], 0))
  const maximo = Math.max(1, ...totais)
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {grupos.map(([nome, v], i) => (
          <li key={nome} className="grid grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-3 text-sm">
            <span className="truncate text-muted-foreground" title={nome}>
              {nome}
            </span>
            <div className="flex h-5 overflow-hidden rounded-sm" style={{ width: `${(totais[i] / maximo) * 100}%` }}>
              {partes.map((p) =>
                v[p.chave] > 0 ? (
                  <Tooltip key={p.chave}>
                    <TooltipTrigger
                      render={<div className={cn('h-full', p.classe)} style={{ width: `${(v[p.chave] / totais[i]) * 100}%` }} />}
                    />
                    <TooltipContent>
                      {nome} · {p.rotulo}: {fmtPessoas(v[p.chave])} ({fmtPct1(v[p.chave] / totais[i])})
                    </TooltipContent>
                  </Tooltip>
                ) : null,
              )}
            </div>
            <span className="text-right font-medium tabular-nums">{fmtPessoas(totais[i])}</span>
          </li>
        ))}
      </ul>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {partes.map((p) => (
          <li key={p.chave} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-sm', p.classe)} />
            {p.rotulo}
          </li>
        ))}
      </ul>
    </div>
  )
}
