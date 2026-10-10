import { useState, type FormEvent } from 'react'
import { UserPlus } from 'lucide-react'
import type { Papel } from '@/types/database'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useCriarUsuario, type SenhaProvisoria } from './api-usuarios'
import { DESCRICAO_PAPEL, ROTULO_PAPEL } from './papeis'

/** Cadastro de usuário: o ARGOS cria o login com senha provisória (troca obrigatória no 1º acesso). */
export function DialogNovoUsuario({
  aberto,
  onFechar,
  onCriado,
}: {
  aberto: boolean
  onFechar: () => void
  onCriado: (dados: SenhaProvisoria) => void
}) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<Papel>('leitor')
  const criar = useCriarUsuario()

  function fechar() {
    if (criar.isPending) return
    setNome('')
    setEmail('')
    setPapel('leitor')
    criar.reset()
    onFechar()
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    criar.mutate(
      { nome: nome.trim(), email: email.trim(), papel },
      {
        onSuccess: (dados) => {
          fechar()
          onCriado(dados)
        },
      },
    )
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && fechar()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>
              O ARGOS cria o acesso com uma senha provisória. No primeiro login, o usuário cria a própria senha.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="novo-nome">Nome</FieldLabel>
              <Input id="novo-nome" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
            </Field>
            <Field>
              <FieldLabel htmlFor="novo-email">E-mail</FieldLabel>
              <Input id="novo-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field>
              <FieldLabel>Papel</FieldLabel>
              <Select
                value={papel}
                onValueChange={(v) => v && setPapel(v as Papel)}
                items={(['leitor', 'editor', 'admin'] as Papel[]).map((p) => ({ value: p, label: ROTULO_PAPEL[p] }))}
              >
                <SelectTrigger className="w-full" aria-label="Papel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(['leitor', 'editor', 'admin'] as Papel[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {ROTULO_PAPEL[p]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>{DESCRICAO_PAPEL[papel]}</FieldDescription>
            </Field>
          </FieldGroup>

          {criar.error && (
            <Alert variant="destructive">
              <AlertDescription>{criar.error.message}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={fechar} disabled={criar.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={criar.isPending || !nome.trim() || !email.trim()}>
              {criar.isPending ? <Spinner data-icon="inline-start" /> : <UserPlus data-icon="inline-start" />}
              {criar.isPending ? 'Criando…' : 'Criar usuário'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
