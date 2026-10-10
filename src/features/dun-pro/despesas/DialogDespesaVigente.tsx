import { History } from 'lucide-react'
import { toast } from 'sonner'
import { formatarMes, formatarMoeda } from '@/lib/format'
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
import { SeloDiferenca } from '../versoes/Diferenca'
import { useDespesaVigente, type LancamentoDespesa } from './api-despesas'

/** Confirmação para voltar uma versão antiga da despesa a ser a vigente. */
export function DialogDespesaVigente({
  alvo,
  atual,
  onFechar,
}: {
  alvo: LancamentoDespesa | null
  atual: LancamentoDespesa | null
  onFechar: () => void
}) {
  const tornarVigente = useDespesaVigente()

  function confirmar() {
    if (!alvo) return
    tornarVigente.mutate(alvo.id, {
      onSuccess: () => {
        toast.success(`Despesa de ${formatarMes(alvo.mes_ref)}: v${alvo.versao} agora é a vigente.`)
        onFechar()
      },
      onError: (e) => toast.error(`Não foi possível trocar a versão: ${e.message}`),
    })
  }

  return (
    <AlertDialog open={!!alvo} onOpenChange={(aberto) => !aberto && !tornarVigente.isPending && onFechar()}>
      {alvo && (
        <AlertDialogContent className="data-[size=default]:sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Tornar a v{alvo.versao} da despesa de {formatarMes(alvo.mes_ref)} vigente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O Relatório Gerencial de {formatarMes(alvo.mes_ref)} passa a usar {formatarMoeda(alvo.valor_total)}.
              {atual && ` A v${atual.versao} continua no histórico.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {atual && (
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <span className="text-muted-foreground">
                v{atual.versao} {formatarMoeda(atual.valor_total)} → v{alvo.versao}
              </span>
              <SeloDiferenca dif={alvo.valor_total - atual.valor_total} />
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
