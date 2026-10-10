// Usuários do ARGOS. Criar login, listar com e-mail e redefinir senha exigem a chave service_role:
// isso roda na Edge Function "admin-usuarios" (supabase/functions/admin-usuarios), que só atende admin.
// Papel e acesso (tabela perfis) são gravados direto: o RLS permite insert/update/delete para admin.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Papel } from '@/types/database'

export type Usuario = {
  id: string
  email: string | null
  nome: string | null
  /** null = sem perfil (sem acesso ao ARGOS) */
  papel: Papel | null
  criado_em: string
  ultimo_acesso: string | null
  /** ainda não trocou a senha provisória */
  trocar_senha: boolean
}

export type SenhaProvisoria = { id: string; email: string; senha: string }

const FUNCAO = 'admin-usuarios'

/** Erro da função publicado com o texto que ela devolveu (ou "função não publicada"). */
export class ErroFuncao extends Error {
  readonly naoPublicada: boolean
  constructor(mensagem: string, naoPublicada = false) {
    super(mensagem)
    this.naoPublicada = naoPublicada
  }
}

async function chamar<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FUNCAO, { body: corpo })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const status = error.context.status
      const json = await error.context.json().catch(() => null)
      if (status === 404 && !json?.erro) throw new ErroFuncao('A função admin-usuarios ainda não foi publicada no Supabase.', true)
      throw new ErroFuncao(json?.erro ?? `Erro ${status} na função admin-usuarios.`)
    }
    // falha de rede/CORS costuma ser a função inexistente
    throw new ErroFuncao('Não foi possível falar com a função admin-usuarios (ela já foi publicada no Supabase?).', true)
  }
  return data as T
}

export function useUsuarios(habilitado: boolean) {
  return useQuery({
    queryKey: ['usuarios'],
    enabled: habilitado,
    retry: false,
    queryFn: async () => (await chamar<{ usuarios: Usuario[] }>({ acao: 'listar' })).usuarios,
  })
}

export function useCriarUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (e: { email: string; nome: string; papel: Papel }) => chamar<SenhaProvisoria>({ acao: 'criar', ...e }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  })
}

export function useRedefinirSenha() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => chamar<SenhaProvisoria>({ acao: 'redefinir_senha', user_id: userId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  })
}

/** Papel/acesso no ARGOS (tabela perfis). papel null = remove o acesso (o login continua existindo). */
export function useDefinirAcesso() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (e: { userId: string; nome: string | null; papel: Papel | null }) => {
      const { error } =
        e.papel == null
          ? await supabase.from('perfis').delete().eq('user_id', e.userId)
          : await supabase.from('perfis').upsert({ user_id: e.userId, nome: e.nome, papel: e.papel })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      queryClient.invalidateQueries({ queryKey: ['perfis'] })
    },
  })
}
