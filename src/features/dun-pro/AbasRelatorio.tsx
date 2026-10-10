import { rotuloTrimestre } from '@/lib/periodo'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type Aba = 'padrao' | 'acompanhamento'
export type PeriodoAcomp = 'ano' | 'trimestre'

/** Abas da página (Padrão / Acompanhamento): texto, sublinhado na cor de destaque na ativa, linha fina embaixo. */
export function AbasRelatorio({ aba, onMudar }: { aba: Aba; onMudar: (aba: Aba) => void }) {
  return (
    <Tabs value={aba} onValueChange={(v) => onMudar(v as Aba)} className="-mt-1 border-b">
      <TabsList variant="line" className="h-auto gap-6 p-0">
        {(
          [
            ['padrao', 'Padrão'],
            ['acompanhamento', 'Acompanhamento'],
          ] as const
        ).map(([valor, rotulo]) => (
          <TabsTrigger
            key={valor}
            value={valor}
            className="h-auto flex-none px-0.5 pt-1 pb-2.5 text-sm font-medium text-muted-foreground hover:text-foreground data-active:text-foreground group-data-horizontal/tabs:after:bottom-[-1px] after:bg-primary"
          >
            {rotulo}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

/** Seletor da aba Acompanhamento: Ano | Trimestre + o ano ou o trimestre. */
export function SeletorAcompanhamento({
  periodo,
  ano,
  tri,
  anos,
  trimestres,
  carregando,
  onMudar,
}: {
  periodo: PeriodoAcomp
  ano: number | undefined
  tri: number | undefined
  anos: number[]
  /** trimestres com carga, do mais recente ao mais antigo ("2026-3") */
  trimestres: string[]
  carregando: boolean
  /** parâmetros da URL a atualizar (periodo, ano, tri) */
  onMudar: (novo: Record<string, string>) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs value={periodo} onValueChange={(v) => onMudar({ periodo: v as PeriodoAcomp })}>
        <TabsList>
          <TabsTrigger value="ano">Ano</TabsTrigger>
          <TabsTrigger value="trimestre">Trimestre</TabsTrigger>
        </TabsList>
      </Tabs>
      {carregando ? (
        <Skeleton className="h-8 w-28" />
      ) : periodo === 'trimestre' ? (
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
