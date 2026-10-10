import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type SessaoContexto = {
  sessao: Session | null
  /** true enquanto a sessão salva no navegador ainda está sendo lida */
  carregando: boolean
}

export const SessaoContext = createContext<SessaoContexto | null>(null)

export function useSessao() {
  const ctx = useContext(SessaoContext)
  if (!ctx) throw new Error('useSessao precisa estar dentro de <SessaoProvider>')
  return ctx
}
