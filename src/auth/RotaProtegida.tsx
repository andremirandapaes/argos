import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import type { Papel } from '@/types/database'
import { PrimeiroAcessoPage } from '@/pages/PrimeiroAcessoPage'
import { SemAcessoPage } from '@/pages/SemAcessoPage'
import { useSessao } from './sessao-context'
import { papelAtende, usePerfil } from './usePerfil'

function Carregando() {
  return (
    <div className="flex min-h-svh items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  )
}

/** Exige sessão e perfil. Sem sessão → login; senha provisória → troca obrigatória; sem perfil → "Sem acesso". */
export function RotaProtegida({ children }: { children: ReactNode }) {
  const { sessao, carregando } = useSessao()
  const perfil = usePerfil()
  const location = useLocation()

  if (carregando) return <Carregando />
  if (!sessao) return <Navigate to="/login" replace state={{ de: location.pathname }} />
  // marca posta pelo admin ao criar o usuário ou redefinir a senha
  if (sessao.user.user_metadata?.trocar_senha === true) return <PrimeiroAcessoPage />
  if (perfil.isPending) return <Carregando />
  if (perfil.isError) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6 text-sm text-destructive">
        Erro ao carregar o perfil: {perfil.error.message}
      </div>
    )
  }
  if (!perfil.papel) return <SemAcessoPage />

  return children
}

/** Bloqueia a rota de uma tela quando o papel não atende o mínimo (o banco bloqueia de qualquer forma). */
export function ExigePapel({ minimo, children }: { minimo: Papel; children: ReactNode }) {
  const { papel } = usePerfil()
  if (!papelAtende(papel, minimo)) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
        Seu perfil não tem acesso a esta tela.
      </div>
    )
  }
  return children
}
