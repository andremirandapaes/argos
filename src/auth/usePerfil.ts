import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Papel } from '@/types/database'
import { useSessao } from './sessao-context'

export type Perfil = {
  papel: Papel | null
  nome: string | null
}

/**
 * Papel e nome do usuário logado. `papel` null = usuário sem perfil (não vê nada).
 * Serve só para usabilidade (esconder botões); quem bloqueia de fato é o banco.
 */
export function usePerfil() {
  const { sessao } = useSessao()
  const userId = sessao?.user.id

  const query = useQuery({
    queryKey: ['perfil', userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Perfil> => {
      const { data: papel, error } = await supabase.rpc('papel_atual')
      if (error) throw error
      if (!papel) return { papel: null, nome: null }

      const { data: perfil, error: erroPerfil } = await supabase
        .from('perfis')
        .select('nome')
        .eq('user_id', userId!)
        .maybeSingle()
      if (erroPerfil) throw erroPerfil

      return { papel: papel as Papel, nome: perfil?.nome ?? null }
    },
  })

  const papel = query.data?.papel ?? null
  return {
    ...query,
    papel,
    nome: query.data?.nome ?? null,
    podeEditar: papel === 'admin' || papel === 'editor',
    ehAdmin: papel === 'admin',
  }
}

/** Hierarquia usada pelo menu: admin ⊃ editor ⊃ leitor. */
const NIVEL: Record<Papel, number> = { leitor: 1, editor: 2, admin: 3 }

export function papelAtende(papel: Papel | null, minimo: Papel): boolean {
  return papel != null && NIVEL[papel] >= NIVEL[minimo]
}
