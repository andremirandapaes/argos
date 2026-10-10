import { ShieldOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSessao } from '@/auth/sessao-context'
import { ArgosMarca } from '@/components/ArgosMarca'
import { Button } from '@/components/ui/button'

/** Usuário autenticado, mas sem linha em `perfis`: o banco não mostra nada para ele. */
export function SemAcessoPage() {
  const { sessao } = useSessao()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
      <ArgosMarca className="text-foreground" />
      <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border bg-card p-8">
        <ShieldOff className="size-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Sem acesso</h1>
        <p className="text-sm text-muted-foreground">
          O usuário <strong className="text-foreground">{sessao?.user.email}</strong> ainda não tem perfil no ARGOS.
          Peça ao administrador para vincular seu perfil.
        </p>
        <Button variant="outline" className="mt-2" onClick={() => supabase.auth.signOut()}>
          Sair
        </Button>
      </div>
    </div>
  )
}
