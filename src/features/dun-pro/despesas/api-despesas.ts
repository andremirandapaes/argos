// Despesa mensal (valor total, versionada). Leitura direta (RLS); gravação só pelos RPCs.

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { SLUG_DUN_PROFESSIONAL } from '@/lib/constantes'
import type { Tabela } from '@/types/database'

export type LancamentoDespesa = Pick<
  Tabela<'lancamentos_despesa'>,
  'id' | 'mes_ref' | 'versao' | 'vigente' | 'valor_total' | 'origem' | 'observacao' | 'lancado_por' | 'lancado_em'
>

/** id do campo de valor no card de lançamento (a tabela foca nele ao clicar em Lançar/Corrigir). */
export const ID_CAMPO_VALOR = 'despesa-valor'

export type SituacaoMes = {
  /** despesa vigente do mês (null = ainda não lançada) */
  vigente: { versao: number; valor: number } | null
  /** o mês já tem base de faturamento vigente (entra no Relatório Gerencial) */
  temFaturamento: boolean
}

/** Recarrega tudo o que depende da despesa vigente (lançamentos e relatórios). */
function invalidarDespesa(queryClient: QueryClient) {
  for (const chave of [
    'lancamentos_despesa',
    'vw_gerencial_mensal_total',
    'vw_gerencial_mensal',
    'vw_gerencial_trimestral',
    'vw_gerencial_anual',
    'resumo_gerencial',
  ]) {
    queryClient.invalidateQueries({ queryKey: [chave] })
  }
}

/** Todos os lançamentos (todas as versões) de um ano. */
export function useDespesasDoAno(distribuidoraId: string | undefined, ano: number) {
  return useQuery({
    queryKey: ['lancamentos_despesa', distribuidoraId, ano],
    enabled: !!distribuidoraId,
    queryFn: async (): Promise<LancamentoDespesa[]> => {
      const { data, error } = await supabase
        .from('lancamentos_despesa')
        .select('id, mes_ref, versao, vigente, valor_total, origem, observacao, lancado_por, lancado_em')
        .eq('distribuidora_id', distribuidoraId!)
        .gte('mes_ref', `${ano}-01-01`)
        .lte('mes_ref', `${ano}-12-01`)
        .order('mes_ref')
        .order('versao', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** Despesa vigente de todos os meses (todos os anos): série do gráfico de acompanhamento. */
export function useDespesaVigenteTodas(distribuidoraId: string | undefined) {
  return useQuery({
    queryKey: ['lancamentos_despesa', 'vigentes', distribuidoraId],
    enabled: !!distribuidoraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_despesa_vigente')
        .select('mes_ref, valor_total, versao')
        .eq('distribuidora_id', distribuidoraId!)
        .order('mes_ref')
      if (error) throw error
      return data
    },
  })
}

/** Lança a despesa do mês: cria uma nova versão, já vigente. */
export function useRegistrarDespesa() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (e: { mesRef: string; valor: number; observacao: string | null }) => {
      const { data, error } = await supabase.rpc('registrar_despesa', {
        p_distribuidora_slug: SLUG_DUN_PROFESSIONAL,
        p_mes_ref: e.mesRef,
        p_valor_total: e.valor,
        p_observacao: e.observacao ?? undefined,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => invalidarDespesa(queryClient),
  })
}

/** Troca a versão vigente da despesa de um mês. */
export function useDespesaVigente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (lancamentoId: string) => {
      const { error } = await supabase.rpc('definir_despesa_vigente', { p_lancamento_id: lancamentoId })
      if (error) throw error
    },
    onSuccess: () => invalidarDespesa(queryClient),
  })
}
