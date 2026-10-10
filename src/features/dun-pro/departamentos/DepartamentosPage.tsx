import { useMemo, useState } from 'react'
import { AlertTriangle, FileUp, Star, Tags, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { usePerfil } from '@/auth/usePerfil'
import { NOME_DUNO_PRO } from '@/lib/constantes'
import { Indicador } from '@/components/Indicador'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useDistribuidora } from '../api'
import { CampoBusca } from '../CampoBusca'
import { traduzirErroDepartamento, useAtualizarDepartamento, useDepartamentos } from './api-departamentos'
import { DialogImportarCodigos } from './DialogImportarCodigos'
import { TabelaDepartamentos, type ContextoDepartamentos } from './TabelaDepartamentos'

type Filtro = 'todos' | 'exclusivos' | 'sem-codigo'

/** Departamentos: código Winthor, nome e a marcação "exclusivo PROFESSIONAL" (que define a tela Professional Dpts). */
export default function DepartamentosPage() {
  const { podeEditar } = usePerfil()
  const distribuidora = useDistribuidora()
  const departamentos = useDepartamentos(distribuidora.data?.id)
  const atualizar = useAtualizarDepartamento()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')
  const [importando, setImportando] = useState(false)

  const todos = useMemo(() => departamentos.data ?? [], [departamentos.data])
  const exibidos = useMemo(
    () =>
      todos.filter((d) =>
        filtro === 'exclusivos' ? d.exclusivo_professional : filtro === 'sem-codigo' ? d.codigo_winthor == null : true,
      ),
    [todos, filtro],
  )
  const qtdExclusivos = todos.filter((d) => d.exclusivo_professional).length
  const qtdSemCodigo = todos.filter((d) => d.codigo_winthor == null).length

  const contexto: ContextoDepartamentos = useMemo(
    () => ({
      podeEditar,
      onExclusivo: (d, exclusivo) =>
        atualizar.mutate(
          { id: d.id, mudancas: { exclusivo_professional: exclusivo } },
          {
            onSuccess: () =>
              toast.success(`${d.nome} ${exclusivo ? 'agora é' : 'deixou de ser'} exclusivo PROFESSIONAL.`),
            onError: (e) => toast.error('Não foi possível alterar: ' + traduzirErroDepartamento(e)),
          },
        ),
      onCodigo: (d, codigo) =>
        atualizar
          .mutateAsync({ id: d.id, mudancas: { codigo_winthor: codigo } })
          .then(() => {
            toast.success(`${d.nome}: código ${codigo} gravado.`)
          })
          .catch((e: Error & { code?: string }) => {
            toast.error(`Não foi possível gravar o código de ${d.nome}: ${traduzirErroDepartamento(e)}`)
            throw e
          }),
    }),
    // mutate/mutateAsync são estáveis
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [podeEditar],
  )

  const erro = distribuidora.error ?? departamentos.error
  const carregando = distribuidora.isPending || departamentos.isPending

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Departamentos</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {NOME_DUNO_PRO} · criados automaticamente pelas bases do Winthor. Aqui se marca quem é exclusivo PROFESSIONAL e
            se completa o código de quem veio do histórico sem código.
          </p>
        </div>
        {podeEditar && (
          <Button variant="outline" onClick={() => setImportando(true)} disabled={carregando}>
            <FileUp data-icon="inline-start" />
            Importar códigos
          </Button>
        )}
      </div>

      {erro && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Erro ao carregar os departamentos</AlertTitle>
          <AlertDescription>{erro.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Indicador rotulo="Departamentos" tom="neutro" icone={Tags} carregando={carregando} valor={todos.length} />
        <Indicador
          rotulo="Exclusivos PROFESSIONAL"
          tom="fat"
          icone={Star}
          carregando={carregando}
          valor={qtdExclusivos}
          apoio="aparecem em Professional Dpts"
        />
        <Indicador
          rotulo="Sem código Winthor"
          tom="despesa"
          icone={TriangleAlert}
          carregando={carregando}
          valor={qtdSemCodigo}
          apoio={qtdSemCodigo ? 'vindos do histórico da planilha' : 'todos com código'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[filtro]}
          onValueChange={(v) => v[0] && setFiltro(v[0] as Filtro)}
          aria-label="Filtro"
        >
          {(
            [
              ['todos', `Todos (${todos.length})`],
              ['exclusivos', `Só exclusivos (${qtdExclusivos})`],
              ['sem-codigo', `Sem código (${qtdSemCodigo})`],
            ] as const
          ).map(([valor, rotulo]) => (
            <ToggleGroupItem
              key={valor}
              value={valor}
              className="text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              {rotulo}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="ml-auto">
          <CampoBusca valor={busca} onMudar={setBusca} />
        </div>
      </div>

      {podeEditar && qtdSemCodigo > 0 && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Para completar um código, clique em "sem código" e digite. O código também é preenchido sozinho quando o
          departamento aparecer numa base do Winthor.
        </p>
      )}

      <TabelaDepartamentos departamentos={exibidos} contexto={contexto} busca={busca} carregando={carregando} />

      <DialogImportarCodigos aberto={importando} onFechar={() => setImportando(false)} departamentos={todos} />
    </div>
  )
}
