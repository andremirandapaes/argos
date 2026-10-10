// Leitura das views do módulo DUN PRO. Tudo o que é financeiro vem pronto do banco.

import { useQuery, type QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { SLUG_DUN_PROFESSIONAL } from '@/lib/constantes'
import type { View } from '@/types/database'

export type LinhaMensal = View<'vw_gerencial_mensal'>
export type TotalMensal = View<'vw_gerencial_mensal_total'>
export type LinhaAnual = View<'vw_gerencial_anual'>
export type TotalAnual = View<'vw_gerencial_anual_total'>

/**
 * Recarrega tudo o que depende da versão vigente do faturamento
 * (depois de importar uma base ou trocar a versão vigente).
 */
export function invalidarFaturamento(queryClient: QueryClient) {
  for (const chave of [
    'cargas_faturamento',
    'comparacao',
    'vw_gerencial_mensal_total',
    'vw_gerencial_mensal',
    'vw_gerencial_trimestral',
    'vw_gerencial_anual',
    'resumo_gerencial',
    'departamentos',
  ]) {
    queryClient.invalidateQueries({ queryKey: [chave] })
  }
}

/** Distribuidora do módulo (as views filtram por id, não por slug). */
export function useDistribuidora() {
  return useQuery({
    queryKey: ['distribuidora', SLUG_DUN_PROFESSIONAL],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribuidoras')
        .select('id, nome')
        .eq('slug', SLUG_DUN_PROFESSIONAL)
        .single()
      if (error) throw error
      return data
    },
  })
}

/**
 * Totais de todos os meses com carga vigente, em ordem cronológica.
 * Serve para: lista de meses do filtro, mês padrão, linha TOTAL mensal e gráfico de evolução.
 */
export function useTotaisMensais(distribuidoraId: string | undefined) {
  return useQuery({
    queryKey: ['vw_gerencial_mensal_total', distribuidoraId],
    enabled: !!distribuidoraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_gerencial_mensal_total')
        .select('*')
        .eq('distribuidora_id', distribuidoraId!)
        .order('mes_ref')
      if (error) throw error
      return data
    },
  })
}

/** Linhas por departamento de um mês (mes_ref = "AAAA-MM-01"). */
export function useGerencialMensal(distribuidoraId: string | undefined, mesRef: string | undefined) {
  return useQuery({
    queryKey: ['vw_gerencial_mensal', distribuidoraId, mesRef],
    enabled: !!distribuidoraId && !!mesRef,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_gerencial_mensal')
        .select('*')
        .eq('distribuidora_id', distribuidoraId!)
        .eq('mes_ref', mesRef!)
      if (error) throw error
      return data
    },
  })
}

/**
 * Resumo do Gerencial para um intervalo livre de meses (função resumo_gerencial_periodo no banco;
 * mesma lógica do total anual). Usado pelos cards da Evolução com meses selecionados.
 */
export function useResumoPeriodo(inicio: string | undefined, fim: string | undefined) {
  return useQuery({
    queryKey: ['resumo_gerencial', SLUG_DUN_PROFESSIONAL, inicio, fim],
    enabled: !!inicio && !!fim,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('resumo_gerencial_periodo', {
        p_distribuidora_slug: SLUG_DUN_PROFESSIONAL,
        p_inicio: inicio!,
        p_fim: fim!,
      })
      if (error) throw error
      return data[0] ?? null
    },
  })
}

/** A função de resumo vem de uma migration à parte; se não foi aplicada, o PostgREST não a encontra. */
export function funcaoResumoAusente(erro: { message?: string; code?: string } | null) {
  return !!erro && (erro.code === 'PGRST202' || /resumo_gerencial_periodo/.test(erro.message ?? ''))
}

/** Campos por departamento/mês usados na aba Acompanhamento. */
export type LinhaMensalAno = Pick<
  LinhaMensal,
  'departamento_id' | 'mes_ref' | 'faturamento_liquido' | 'rentabilidade' | 'rentabilidade_pct' | 'despesa_rateada' | 'lb' | 'lb_pct'
>

const TAMANHO_PAGINA = 1000 // limite padrão de linhas por resposta do Supabase

/**
 * Todas as linhas departamento × mês de um ano (mesma view e mesmo rateio da aba Padrão).
 * Busca em páginas de 1.000 linhas: uma chamada hoje; mais só quando o ano passar desse limite.
 */
export function useGerencialMensalAno(distribuidoraId: string | undefined, ano: number | undefined) {
  return useQuery({
    queryKey: ['vw_gerencial_mensal', 'ano', distribuidoraId, ano],
    enabled: !!distribuidoraId && !!ano,
    queryFn: async () => {
      const todas: LinhaMensalAno[] = []
      for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
        const { data, error } = await supabase
          .from('vw_gerencial_mensal')
          .select('departamento_id, mes_ref, faturamento_liquido, rentabilidade, rentabilidade_pct, despesa_rateada, lb, lb_pct')
          .eq('distribuidora_id', distribuidoraId!)
          .gte('mes_ref', `${ano}-01-01`)
          .lte('mes_ref', `${ano}-12-01`)
          // ordem estável: sem ela a paginação poderia repetir ou pular linhas
          .order('mes_ref')
          .order('departamento_id')
          .range(inicio, inicio + TAMANHO_PAGINA - 1)
        if (error) throw error
        todas.push(...data)
        if (data.length < TAMANHO_PAGINA) return todas
      }
    },
  })
}

/** Linhas por departamento do trimestre + total do trimestre (views da migration trimestral). */
export function useGerencialTrimestral(
  distribuidoraId: string | undefined,
  ano: number | undefined,
  trimestre: number | undefined,
) {
  return useQuery({
    queryKey: ['vw_gerencial_trimestral', distribuidoraId, ano, trimestre],
    enabled: !!distribuidoraId && !!ano && !!trimestre,
    queryFn: async () => {
      const [linhas, total] = await Promise.all([
        supabase
          .from('vw_gerencial_trimestral')
          .select('*')
          .eq('distribuidora_id', distribuidoraId!)
          .eq('ano', ano!)
          .eq('trimestre', trimestre!),
        supabase
          .from('vw_gerencial_trimestral_total')
          .select('*')
          .eq('distribuidora_id', distribuidoraId!)
          .eq('ano', ano!)
          .eq('trimestre', trimestre!)
          .maybeSingle(),
      ])
      if (linhas.error) throw linhas.error
      if (total.error) throw total.error
      return { linhas: linhas.data, total: total.data }
    },
  })
}

/** Linhas por departamento do ano + total do ano. */
export function useGerencialAnual(distribuidoraId: string | undefined, ano: number | undefined) {
  return useQuery({
    queryKey: ['vw_gerencial_anual', distribuidoraId, ano],
    enabled: !!distribuidoraId && !!ano,
    queryFn: async () => {
      const [linhas, total] = await Promise.all([
        supabase.from('vw_gerencial_anual').select('*').eq('distribuidora_id', distribuidoraId!).eq('ano', ano!),
        supabase
          .from('vw_gerencial_anual_total')
          .select('*')
          .eq('distribuidora_id', distribuidoraId!)
          .eq('ano', ano!)
          .maybeSingle(),
      ])
      if (linhas.error) throw linhas.error
      if (total.error) throw total.error
      return { linhas: linhas.data, total: total.data }
    },
  })
}
