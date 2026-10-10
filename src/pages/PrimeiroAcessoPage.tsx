import { KeyRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSessao } from '@/auth/sessao-context'
import { FormTrocarSenha } from '@/auth/FormTrocarSenha'
import { ArgosMarca } from '@/components/ArgosMarca'
import { TemaToggle } from '@/components/TemaToggle'
import { Button } from '@/components/ui/button'

/** Primeiro acesso (ou senha redefinida pelo admin): troca obrigatória da senha provisória. */
export function PrimeiroAcessoPage() {
  const { sessao } = useSessao()

  return (
    <div className="relative flex min-h-svh items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <TemaToggle />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <ArgosMarca className="text-foreground" />
        <div className="flex flex-col gap-2">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <KeyRound className="size-5 text-primary" />
            Crie a sua senha
          </h1>
          <p className="text-sm text-muted-foreground">
            Olá{sessao?.user.user_metadata?.nome ? `, ${sessao.user.user_metadata.nome}` : ''}! Você entrou com uma senha
            provisória. Para continuar, crie uma senha só sua.
          </p>
          <p className="text-xs text-muted-foreground">{sessao?.user.email}</p>
        </div>
        <FormTrocarSenha textoBotao="Salvar e entrar" />
        <Button variant="ghost" size="sm" className="self-center text-muted-foreground" onClick={() => supabase.auth.signOut()}>
          Sair
        </Button>
      </div>
    </div>
  )
}
