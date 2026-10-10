import { useMemo, useState } from 'react'
import { AlertTriangle, UserPlus } from 'lucide-react'
import { usePerfil } from '@/auth/usePerfil'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { tabelasAusentes, useFontesHeadcount, useLinhasHeadcount, useMesesTerceirizados } from './api'
import { AREAS, competencias, rotuloMes, type Area } from './regras'
import { VisaoGeral } from './VisaoGeral'
import { VisaoArea } from './VisaoArea'
import { SobreOsDados } from './SobreOsDados'
import { ComparativoYoY } from './ComparativoYoY'
import { EditorTerceirizados } from './terceirizados/EditorTerceirizados'

type Aba = 'geral' | Area | 'yoy'
const ABAS: { value: Aba; label: string }[] = [
  { value: 'geral', label: 'Visão geral' },
  ...AREAS.map((a) => ({ value: a, label: a })),
  { value: 'yoy', label: 'Comparativo YoY' },
]

/** Painel do HeadCount: colaboradores ativos no último dia de cada mês. */
export default function PainelPage() {
  const linhas = useLinhasHeadcount()
  const fontes = useFontesHeadcount()
  const terc = useMesesTerceirizados()
  const [aba, setAba] = useState<Aba>('geral')
  const [editandoTerc, setEditandoTerc] = useState(false)
  const { podeEditar } = usePerfil()
  const comps = useMemo(() => competencias(linhas.data ?? []), [linhas.data])
  const ultimaImportacao = (fontes.data ?? [])
    .map((f) => f.importadoEm)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1)

  const erro = linhas.error ?? fontes.error ?? terc.error
  if (erro) {
    return (
      <div className="p-6">
        <Alert variant={tabelasAusentes(erro) ? 'default' : 'destructive'}>
          <AlertTriangle />
          <AlertTitle>{tabelasAusentes(erro) ? 'O HeadCount ainda não foi instalado no banco' : 'Erro ao carregar o HeadCount'}</AlertTitle>
          <AlertDescription>
            {tabelasAusentes(erro)
              ? 'Rode no SQL Editor do Supabase as migrations 20261004000000_headcount.sql e 20261004000100_headcount_carga_inicial.sql, nessa ordem.'
              : (erro as Error).message}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const carregando = linhas.isPending || fontes.isPending || terc.isPending

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Headcount</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {carregando || !comps.length ? (
              'Colaboradores ativos no último dia de cada mês'
            ) : (
              <>
                Colaboradores ativos no último dia de cada mês, de {rotuloMes(comps[0])} a {rotuloMes(comps.at(-1)!)}. Comercial, Logística e
                Backoffice em AM e RR.
              </>
            )}
          </p>
        </div>
        {!carregando && (
          <div className="flex flex-col items-end gap-2">
            {podeEditar && comps.length > 0 && (
              <Button variant="outline" onClick={() => setEditandoTerc(true)}>
                <UserPlus data-icon="inline-start" /> Terceirizados
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              {ultimaImportacao ? `Última importação em ${new Date(ultimaImportacao).toLocaleDateString('pt-BR')}` : 'Base inicial (migrada do artefato)'}
            </p>
          </div>
        )}
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)} className="-mt-1 border-b">
        <TabsList variant="line" className="h-auto gap-6 p-0">
          {ABAS.map((a) => (
            <TabsTrigger
              key={a.value}
              value={a.value}
              className="h-auto flex-none px-0.5 pt-1 pb-2.5 text-sm font-medium text-muted-foreground hover:text-foreground data-active:text-foreground group-data-horizontal/tabs:after:bottom-[-1px] after:bg-primary"
            >
              {a.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {carregando ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      ) : !comps.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma base carregada.</p>
      ) : aba === 'geral' ? (
        <VisaoGeral linhas={linhas.data!} comps={comps} />
      ) : aba === 'yoy' ? (
        <ComparativoYoY linhas={linhas.data!} comps={comps} />
      ) : (
        <VisaoArea key={aba} area={aba} linhas={linhas.data!} comps={comps} />
      )}

      {!carregando && comps.length > 0 && (
        <SobreOsDados fontes={fontes.data!} linhas={linhas.data!} mesesTerceirizados={(terc.data ?? []).map((t) => t.competencia)} />
      )}

      {podeEditar && !carregando && comps.length > 0 && (
        <EditorTerceirizados
          aberto={editandoTerc}
          onFechar={() => setEditandoTerc(false)}
          linhas={linhas.data!}
          comps={comps}
          // abre na área da aba (na Visão geral, Logística: o Depósito concentra os terceirizados)
          areaInicial={aba === 'geral' || aba === 'yoy' ? 'Logística' : aba}
        />
      )}
    </div>
  )
}
