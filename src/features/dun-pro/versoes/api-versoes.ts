// Versões (cargas) de faturamento: histórico, comparação e troca da versão vigente.
// Leitura direta das tabelas (RLS permite para quem tem perfil); gravação só por RPC.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { BUCKET_BASES } from '@/lib/constantes'
import type { RetornoFuncao, Tabela } from '@/types/database'
import { invalidarFaturamento } from '../api'

export type Carga = Pick<
  Tabela<'cargas_faturamento'>,
  | 'id'
  | 'mes_ref'
  | 'versao'
  | 'vigente'
  | 'origem'
  | 'arquivo_nome'
  | 'arquivo_path'
  | 'qtd_linhas'
  | 'total_faturamento'
  | 'total_margem_valor'
  | 'observacao'
  | 'enviado_por'
  | 'enviado_em'
>

export type LinhaComparacao = RetornoFuncao<'comparar_cargas_faturamento'>[number]
export type Situacao = 'alterado' | 'novo' | 'removido' | 'igual'

export const SITUACOES: Situacao[] = ['alterado', 'novo', 'removido', 'igual']

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  alterado: 'Alterado',
  novo: 'Novo',
  removido: 'Removido',
  igual: 'Igual',
}

const CAMPOS_CARGA =
  'id, mes_ref, versao, vigente, origem, arquivo_nome, arquivo_path, qtd_linhas, total_faturamento, total_margem_valor, observacao, enviado_por, enviado_em'

/** Versões de faturamento de um mês (mais recente primeiro). */
export function useVersoesDoMes(distribuidoraId: string | undefined, mesRef: string | undefined) {
  return useQuery({
    queryKey: ['cargas_faturamento', 'mes', distribuidoraId, mesRef],
    enabled: !!distribuidoraId && !!mesRef,
    queryFn: async (): Promise<Carga[]> => {
      const { data, error } = await supabase
        .from('cargas_faturamento')
        .select(CAMPOS_CARGA)
        .eq('distribuidora_id', distribuidoraId!)
        .eq('mes_ref', mesRef!)
        .order('versao', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** Todas as versões de um ano, do mês mais recente para o mais antigo. */
export function useCargasDoAno(distribuidoraId: string | undefined, ano: number | undefined) {
  return useQuery({
    queryKey: ['cargas_faturamento', 'ano', distribuidoraId, ano],
    enabled: !!distribuidoraId && !!ano,
    queryFn: async (): Promise<Carga[]> => {
      const { data, error } = await supabase
        .from('cargas_faturamento')
        .select(CAMPOS_CARGA)
        .eq('distribuidora_id', distribuidoraId!)
        .gte('mes_ref', `${ano}-01-01`)
        .lte('mes_ref', `${ano}-12-01`)
        .order('mes_ref', { ascending: false })
        .order('versao', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** Uma carga pelo id (a comparação chega só com os ids na URL). */
export function useCarga(id: string | null) {
  return useQuery({
    queryKey: ['cargas_faturamento', 'id', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cargas_faturamento')
        .select(`${CAMPOS_CARGA}, distribuidora_id`)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Nome de cada usuário (para "enviado por"): user_id → nome. */
export function useNomesPerfis() {
  return useQuery({
    queryKey: ['perfis', 'nomes'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('perfis').select('user_id, nome')
      if (error) throw error
      return new Map(data.map((p) => [p.user_id, p.nome]))
    },
  })
}

/** Comparação por departamento entre duas cargas (A = antiga, B = nova). */
export function useComparacao(cargaA: string | null, cargaB: string | null) {
  return useQuery({
    queryKey: ['comparacao', cargaA, cargaB],
    enabled: !!cargaA && !!cargaB && cargaA !== cargaB,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('comparar_cargas_faturamento', {
        p_carga_a: cargaA!,
        p_carga_b: cargaB!,
      })
      if (error) throw error
      return data
    },
  })
}

/** Troca a versão vigente do mês (RPC com controle de permissão e trava no banco). */
export function useTornarVigente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (cargaId: string) => {
      const { error } = await supabase.rpc('definir_carga_vigente', { p_carga_id: cargaId })
      if (error) throw error
    },
    onSuccess: () => invalidarFaturamento(queryClient),
  })
}

/** Baixa o arquivo original enviado (link temporário do Storage privado). */
export async function baixarArquivoOriginal(caminho: string, nome: string | null) {
  const { data, error } = await supabase.storage
    .from(BUCKET_BASES)
    .createSignedUrl(caminho, 60, { download: nome ?? true })
  if (error) throw error
  const a = document.createElement('a')
  a.href = data.signedUrl
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Versão "anterior" para a comparação padrão: a maior abaixo da vigente; senão, a maior acima dela. */
export function versaoParaComparar(versoes: Carga[], vigente: Carga) {
  const outras = versoes.filter((v) => v.id !== vigente.id)
  return (
    outras.filter((v) => v.versao < vigente.versao).sort((a, b) => b.versao - a.versao)[0] ??
    outras.sort((a, b) => b.versao - a.versao)[0] ??
    null
  )
}
