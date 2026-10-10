import { formatarMes } from '@/lib/format'
import { rotuloTrimestre } from '@/lib/periodo'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type Visao = 'mensal' | 'trimestral' | 'anual'

/** Mensal / Trimestral / Anual + o seletor do mês, trimestre ou ano (mesmo visual do Relatório Gerencial). */
export function SeletorPeriodo({
  visao,
  meses,
  mesRef,
  trimestres,
  ano,
  tri,
  anos,
  carregando,
  onMudar,
}: {
  visao: Visao
  /** meses com carga, do mais recente ao mais antigo ("AAAA-MM-01") */
  meses: string[]
  mesRef: string | undefined
  /** trimestres com carga, do mais recente ao mais antigo ("2026-3") */
  trimestres: string[]
  ano: number | undefined
  tri: number | undefined
  anos: number[]
  carregando: boolean
  /** parâmetros da URL a atualizar (visao, mes, ano, tri) */
  onMudar: (novo: Record<string, string>) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs value={visao} onValueChange={(v) => onMudar({ visao: v as Visao })}>
        <TabsList>
          <TabsTrigger value="mensal">Mensal</TabsTrigger>
          <TabsTrigger value="trimestral">Trimestral</TabsTrigger>
          <TabsTrigger value="anual">Anual</TabsTrigger>
        </TabsList>
      </Tabs>

      {carregando ? (
        <Skeleton className="h-8 w-28" />
      ) : visao === 'mensal' ? (
        <Select
          value={mesRef ?? null}
          onValueChange={(v) => v && onMudar({ mes: v.slice(0, 7) })}
          items={meses.map((m) => ({ value: m, label: formatarMes(m) }))}
        >
          <SelectTrigger className="w-28" aria-label="Mês">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {meses.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatarMes(m)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : visao === 'trimestral' ? (
        <Select
          value={`${ano}-${tri}`}
          onValueChange={(v) => {
            if (!v) return
            const [a, t] = v.split('-')
            onMudar({ ano: a, tri: t })
          }}
          items={trimestres.map((v) => {
            const [a, t] = v.split('-').map(Number)
            return { value: v, label: rotuloTrimestre(t, a) }
          })}
        >
          <SelectTrigger className="w-32" aria-label="Trimestre">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {trimestres.map((v) => {
                const [a, t] = v.split('-').map(Number)
                return (
                  <SelectItem key={v} value={v}>
                    {rotuloTrimestre(t, a)}
                  </SelectItem>
                )
              })}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : (
        <Select
          value={ano ?? null}
          onValueChange={(v) => v && onMudar({ ano: String(v) })}
          items={anos.map((a) => ({ value: a, label: String(a) }))}
        >
          <SelectTrigger className="w-28" aria-label="Ano">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {anos.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
