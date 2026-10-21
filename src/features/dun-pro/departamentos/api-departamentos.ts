// Departamentos: leitura e edição direta da tabela (o RLS permite update para admin e editor).
// Só dois campos são editados aqui: a marcação "exclusivo PROFESSIONAL" e o código Winthor
// dos departamentos que vieram do histórico sem código.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { invalidarFaturamento } from '../api'

export type Departamento = {
  id: string
  codigo_winthor: number | null
  nome: string
  exclusivo_professional: boolean
  atualizado_em: string
}

export function useDepartamentos(distribuidoraId: string | undefined) {
  return useQuery({
    queryKey: ['departamentos', 'lista', distribuidoraId],
    enabled: !!distribuidoraId,
    queryFn: async (): Promise<Departamento[]> => {
      const { data, error } = await supabase
        .from('departamentos')
        .select('id, codigo_winthor, nome, exclusivo_professional, atualizado_em')
        .eq('distribuidora_id', distribuidoraId!)
        .order('nome')
      if (error) throw error
      return data
    },
  })
}

/** Mensagem amigável para os erros mais comuns ao editar departamentos. */
export function traduzirErroDepartamento(e: { message?: string; code?: string }) {
  // unique (distribuidora_id, codigo_winthor)
  if (e.code === '23505') return 'Esse código já pertence a outro departamento.'
  return e.message ?? 'Erro desconhecido.'
}

/** Atualiza um departamento (exclusivo PROFESSIONAL e/ou código Winthor). */
export function useAtualizarDepartamento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (e: { id: string; mudancas: Partial<Pick<Departamento, 'exclusivo_professional' | 'codigo_winthor'>> }) => {
      const { error } = await supabase.from('departamentos').update(e.mudancas).eq('id', e.id)
      if (error) throw error
    },
    onSuccess: () => {
      // exclusivo muda o toggle Só Professional do Gerencial (mesmas chaves); código aparece em todos os relatórios
      invalidarFaturamento(queryClient)
    },
  })
}

/** Aplica vários códigos de uma vez (importação da lista); continua mesmo se algum falhar. */
export function useAplicarCodigos() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (itens: { id: string; codigo: number }[]) => {
      const falhas: { id: string; mensagem: string }[] = []
      for (const item of itens) {
        const { error } = await supabase.from('departamentos').update({ codigo_winthor: item.codigo }).eq('id', item.id)
        if (error) falhas.push({ id: item.id, mensagem: traduzirErroDepartamento(error) })
      }
      return { aplicados: itens.length - falhas.length, falhas }
    },
    onSettled: () => {
      invalidarFaturamento(queryClient)
    },
  })
}
