import { useState } from 'react'
import { Check, Copy, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { SenhaProvisoria } from './api-usuarios'

/** Mostra a senha provisória (uma única vez) para o admin entregar ao usuário. */
export function DialogSenhaProvisoria({
  dados,
  titulo,
  onFechar,
}: {
  dados: SenhaProvisoria | null
  titulo: string
  onFechar: () => void
}) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    if (!dados) return
    try {
      await navigator.clipboard.writeText(`ARGOS\nE-mail: ${dados.email}\nSenha provisória: ${dados.senha}`)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // sem permissão de área de transferência: o admin copia na mão
    }
  }

  return (
    <Dialog open={!!dados} onOpenChange={(a) => !a && onFechar()}>
      {dados && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" />
              {titulo}
            </DialogTitle>
            <DialogDescription>
              Entregue estes dados ao usuário. No primeiro acesso, o ARGOS pede para ele criar uma senha nova. Esta senha
              não aparece de novo depois que você fechar esta janela.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">E-mail</span>
              <span className="font-medium">{dados.email}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Senha provisória</span>
              <span className="font-mono text-lg font-semibold tracking-wider select-all">{dados.senha}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={copiar}>
              {copiado ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
              {copiado ? 'Copiado' : 'Copiar e-mail e senha'}
            </Button>
            <Button onClick={onFechar}>Pronto</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}
