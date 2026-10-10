import { History } from 'lucide-react'
import { toast } from 'sonner'
import { formatarMes } from '@/lib/format'
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
import { Spinner } from '@/components/ui/spinner'
import { useTornarVigente, type Carga } from './api-versoes'
import { SeloDiferenca } from './Diferenca'

/**
 * Confirmação de "Tornar vigente". `alvo` = versão que vai virar vigente;
 * `atual` = a vigente hoje (para mostrar o que muda nos totais do mês).
 */
export function DialogTornarVigente({
  alvo,
  atual,
  onFechar,
}: {
  alvo: Carga | null
  atual: Carga | null
  onFechar: () => void
}) {
  const tornarVigente = useTornarVigente()

  function confirmar() {
    if (!alvo) return
    tornarVigente.mutate(alvo.id, {
      onSuccess: () => {
        toast.success(`v${alvo.versao} agora é a versão vigente de ${formatarMes(alvo.mes_ref)}.`)
        onFechar()
      },
      onError: (e) => toast.error(`Não foi possível trocar a versão: ${e.message}`),
    })
  }

  return (
    <AlertDialog open={!!alvo} onOpenChange={(aberto) => !aberto && !tornarVigente.isPending && onFechar()}>
      {alvo && (
        <AlertDialogContent className="data-[size=default]:sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Tornar a v{alvo.versao} de {formatarMes(alvo.mes_ref)} vigente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Os relatórios de {formatarMes(alvo.mes_ref)} passam a usar a v{alvo.versao}.
              {atual && ` A v${atual.versao} deixa de ser a vigente, mas continua guardada e pode voltar a qualquer momento.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {atual && (
            <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
              <span className="text-xs text-muted-foreground">
                Mudança nos totais do mês (v{atual.versao} → v{alvo.versao})
              </span>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Faturamento líquido</span>
                <SeloDiferenca dif={alvo.total_faturamento - atual.total_faturamento} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Margem</span>
                <SeloDiferenca dif={alvo.total_margem_valor - atual.total_margem_valor} />
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={tornarVigente.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmar} disabled={tornarVigente.isPending}>
              {tornarVigente.isPending ? <Spinner data-icon="inline-start" /> : <History data-icon="inline-start" />}
              {tornarVigente.isPending ? 'Trocando…' : `Tornar v${alvo.versao} vigente`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  )
}
