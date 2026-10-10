import { useMemo, useState } from 'react'
import { AgGridReact, type CustomCellRendererProps } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { AlertTriangle, KeyRound, UserCheck, UserPlus, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { useSessao } from '@/auth/sessao-context'
import { usePerfil } from '@/auth/usePerfil'
import { colunaNumerica, temaArgos } from '@/lib/aggrid'
import { formatarDataHora } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Papel } from '@/types/database'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import {
  ErroFuncao,
  useDefinirAcesso,
  useRedefinirSenha,
  useUsuarios,
  type SenhaProvisoria,
  type Usuario,
} from './api-usuarios'
import { DialogNovoUsuario } from './DialogNovoUsuario'
import { DialogSenhaProvisoria } from './DialogSenhaProvisoria'
import { ROTULO_PAPEL } from './papeis'

type Contexto = {
  meuId: string | undefined
  onPapel: (u: Usuario, papel: Papel) => void
  onRedefinir: (u: Usuario) => void
  onAcesso: (u: Usuario, dar: boolean) => void
}
type Celula = CustomCellRendererProps<Usuario, unknown, Contexto>

function CelulaPapel({ data, context }: Celula) {
  if (!data) return null
  if (data.papel == null) return <span className="text-muted-foreground">—</span>
  if (data.id === context.meuId) {
    // o próprio admin não muda o próprio papel (evita ficar sem administrador)
    return (
      <div className="flex h-full items-center justify-center gap-1.5">
        {ROTULO_PAPEL[data.papel]} <Badge variant="secondary">você</Badge>
      </div>
    )
  }
  return (
    <div className="flex h-full items-center justify-center">
      <Select
        value={data.papel}
        onValueChange={(v) => v && v !== data.papel && context.onPapel(data, v as Papel)}
        items={(['admin', 'editor', 'leitor'] as Papel[]).map((p) => ({ value: p, label: ROTULO_PAPEL[p] }))}
      >
        <SelectTrigger size="sm" className="w-36" aria-label={`Papel de ${data.nome ?? data.email}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {(['admin', 'editor', 'leitor'] as Papel[]).map((p) => (
              <SelectItem key={p} value={p}>
                {ROTULO_PAPEL[p]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function CelulaSituacao({ data }: Celula) {
  if (!data) return null
  const [rotulo, classe] =
    data.papel == null
      ? ['Sem acesso', 'border-transparent bg-muted text-muted-foreground']
      : data.trocar_senha
        ? ['Aguardando 1º acesso', 'border-alerta-foreground/30 bg-alerta text-alerta-foreground']
        : ['Ativo', 'border-positivo/30 bg-positivo/12 text-positivo']
  return (
    <div className="flex h-full items-center justify-center">
      <Badge variant="outline" className={cn('font-medium', classe)}>
        {rotulo}
      </Badge>
    </div>
  )
}

function CelulaAcoes({ data, context }: Celula) {
  if (!data) return null
  const souEu = data.id === context.meuId
  return (
    <div className="flex h-full items-center justify-center gap-1.5">
      <Button variant="outline" size="xs" onClick={() => context.onRedefinir(data)} title="Gerar nova senha provisória">
        <KeyRound data-icon="inline-start" />
        Redefinir senha
      </Button>
      {!souEu &&
        (data.papel == null ? (
          <Button variant="outline" size="xs" onClick={() => context.onAcesso(data, true)}>
            <UserCheck data-icon="inline-start" />
            Dar acesso
          </Button>
        ) : (
          <Button variant="outline" size="xs" className="text-destructive" onClick={() => context.onAcesso(data, false)}>
            <UserX data-icon="inline-start" />
            Remover acesso
          </Button>
        ))}
    </div>
  )
}

const COLUNAS: ColDef<Usuario>[] = [
  { field: 'nome', headerName: 'NOME', minWidth: 150, flex: 0.8, valueFormatter: (p) => p.value ?? '—' },
  { field: 'email', headerName: 'E-MAIL', minWidth: 280, flex: 1.4, tooltipField: 'email' },
  { field: 'papel', headerName: 'PAPEL', headerClass: 'ag-centro', cellRenderer: CelulaPapel, width: 175 },
  { colId: 'situacao', headerName: 'SITUAÇÃO', headerClass: 'ag-centro', cellRenderer: CelulaSituacao, width: 180 },
  { field: 'ultimo_acesso', headerName: 'ÚLTIMO ACESSO', ...colunaNumerica, valueFormatter: (p) => (p.value ? formatarDataHora(p.value) : 'nunca'), width: 150 },
  { field: 'criado_em', headerName: 'CRIADO EM', ...colunaNumerica, valueFormatter: (p) => formatarDataHora(p.value), width: 150 },
  { colId: 'acoes', headerName: '', cellRenderer: CelulaAcoes, width: 300, sortable: false, resizable: false },
]

type Confirmacao = { tipo: 'redefinir'; usuario: Usuario } | { tipo: 'acesso'; usuario: Usuario; dar: boolean }

/** Administração de usuários (só admin): cadastro com senha provisória, papel e acesso. */
export default function UsuariosPage() {
  const { ehAdmin } = usePerfil()
  const { sessao } = useSessao()
  const usuarios = useUsuarios(ehAdmin)
  const redefinir = useRedefinirSenha()
  const definirAcesso = useDefinirAcesso()
  const [novo, setNovo] = useState(false)
  const [senha, setSenha] = useState<{ dados: SenhaProvisoria; titulo: string } | null>(null)
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)

  const contexto: Contexto = useMemo(
    () => ({
      meuId: sessao?.user.id,
      onPapel: (u, papel) =>
        definirAcesso.mutate(
          { userId: u.id, nome: u.nome, papel },
          {
            onSuccess: () => toast.success(`${u.nome ?? u.email} agora é ${ROTULO_PAPEL[papel]}.`),
            onError: (e) => toast.error('Não foi possível alterar o papel: ' + e.message),
          },
        ),
      onRedefinir: (u) => setConfirmacao({ tipo: 'redefinir', usuario: u }),
      onAcesso: (u, dar) => setConfirmacao({ tipo: 'acesso', usuario: u, dar }),
    }),
    // mutate é estável
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessao?.user.id],
  )

  function confirmar() {
    if (!confirmacao) return
    const u = confirmacao.usuario
    if (confirmacao.tipo === 'redefinir') {
      redefinir.mutate(u.id, {
        onSuccess: (dados) => {
          setConfirmacao(null)
          setSenha({ dados, titulo: 'Nova senha provisória' })
        },
        onError: (e) => {
          setConfirmacao(null)
          toast.error(e.message)
        },
      })
    } else {
      definirAcesso.mutate(
        { userId: u.id, nome: u.nome, papel: confirmacao.dar ? 'leitor' : null },
        {
          onSuccess: () => {
            setConfirmacao(null)
            toast.success(confirmacao.dar ? `${u.nome ?? u.email} agora tem acesso (Leitor).` : `Acesso de ${u.nome ?? u.email} removido.`)
          },
          onError: (e) => {
            setConfirmacao(null)
            toast.error(e.message)
          },
        },
      )
    }
  }

  const erro = usuarios.error
  const naoPublicada = erro instanceof ErroFuncao && erro.naoPublicada
  const ocupado = redefinir.isPending || definirAcesso.isPending

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Usuários</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Quem acessa o ARGOS e com qual papel. Novos usuários recebem uma senha provisória e criam a própria no primeiro
            acesso.
          </p>
        </div>
        <Button onClick={() => setNovo(true)} disabled={naoPublicada}>
          <UserPlus data-icon="inline-start" />
          Novo usuário
        </Button>
      </div>

      {naoPublicada ? (
        <Alert className="border-alerta-foreground/25 bg-alerta text-alerta-foreground">
          <AlertTriangle />
          <AlertTitle>A função de usuários ainda não foi publicada no Supabase</AlertTitle>
          <AlertDescription className="text-alerta-foreground/85">
            No painel do Supabase: Edge Functions → Deploy a new function → Via Editor, nome <strong>admin-usuarios</strong>,
            cole o conteúdo de supabase/functions/admin-usuarios/index.ts e clique em Deploy. Depois recarregue esta página.
          </AlertDescription>
        </Alert>
      ) : (
        erro && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Erro ao carregar os usuários</AlertTitle>
            <AlertDescription>{erro.message}</AlertDescription>
          </Alert>
        )
      )}

      <div className="overflow-hidden rounded-xl border bg-card [--ag-auto-height-min-body-height:132px]">
        <AgGridReact<Usuario>
          theme={temaArgos}
          rowData={usuarios.data ?? []}
          columnDefs={COLUNAS}
          context={contexto}
          getRowId={(p) => p.data.id}
          defaultColDef={{ sortable: true, resizable: true, suppressMovable: true }}
          rowHeight={44}
          domLayout="autoHeight"
          loading={usuarios.isPending && ehAdmin && !erro}
          overlayNoRowsTemplate="<span class='text-sm text-muted-foreground'>Nenhum usuário.</span>"
          suppressCellFocus
        />
      </div>

      <DialogNovoUsuario
        aberto={novo}
        onFechar={() => setNovo(false)}
        onCriado={(dados) => setSenha({ dados, titulo: 'Usuário criado' })}
      />
      <DialogSenhaProvisoria dados={senha?.dados ?? null} titulo={senha?.titulo ?? ''} onFechar={() => setSenha(null)} />

      <AlertDialog open={!!confirmacao} onOpenChange={(a) => !a && !ocupado && setConfirmacao(null)}>
        {confirmacao && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmacao.tipo === 'redefinir'
                  ? `Redefinir a senha de ${confirmacao.usuario.nome ?? confirmacao.usuario.email}?`
                  : confirmacao.dar
                    ? `Dar acesso a ${confirmacao.usuario.nome ?? confirmacao.usuario.email}?`
                    : `Remover o acesso de ${confirmacao.usuario.nome ?? confirmacao.usuario.email}?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmacao.tipo === 'redefinir'
                  ? 'A senha atual deixa de funcionar. O ARGOS gera uma senha provisória, e o usuário cria uma nova no próximo acesso.'
                  : confirmacao.dar
                    ? 'O usuário entra como Leitor; você pode mudar o papel depois.'
                    : 'O login continua existindo, mas o usuário não vê mais nada no ARGOS. Dá para devolver o acesso depois.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={ocupado}>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmar}
                disabled={ocupado}
                variant={confirmacao.tipo === 'acesso' && !confirmacao.dar ? 'destructive' : 'default'}
              >
                {ocupado && <Spinner data-icon="inline-start" />}
                {confirmacao.tipo === 'redefinir' ? 'Redefinir senha' : confirmacao.dar ? 'Dar acesso' : 'Remover acesso'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  )
}
