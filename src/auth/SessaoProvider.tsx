import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { SessaoContext } from './sessao-context'

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setCarregando(false)
    })

    // Não chamar o Supabase dentro deste callback (pode travar o client);
    // só atualiza o estado, e as queries reagem à troca de usuário.
    const { data } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      setSessao(novaSessao)
      if (evento === 'SIGNED_OUT') queryClient.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  return <SessaoContext.Provider value={{ sessao, carregando }}>{children}</SessaoContext.Provider>
}
