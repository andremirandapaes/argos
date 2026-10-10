// PROFESSIONAL: só os departamentos exclusivos, sem despesa e sem LB.
// Linhas e totais vêm prontos das views (vw_professional_* e *_total); aqui só se lê.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type LinhaProfessional = {
  departamento_id: string | null
  codigo_winthor: number | null
  nome: string | null
  participacao: number | null
  faturamento_liquido: number | null
  rentabilidade: number | null
  rentabilidade_pct: number | null
}

export type TotalProfessional = {
  faturamento_liquido: number | null
  rentabilidade: number | null
  rentabilidade_pct: number | null
}

export type FiltroProfessional =
  | { visao: 'mensal'; mesRef: string }
  | { visao: 'trimestral'; ano: number; tri: number }
  | { visao: 'anual'; ano: number }

const CAMPOS_LINHA = 'departamento_id, codigo_winthor, nome, participacao, faturamento_liquido, rentabilidade, rentabilidade_pct'
const CAMPOS_TOTAL = 'faturamento_liquido, rentabilidade, rentabilidade_pct'

/** Departamentos marcados como exclusivos PROFESSIONAL (todos aparecem, mesmo sem venda no período). */
export function useExclusivos(distribuidoraId: string | undefined) {
  return useQuery({
    queryKey: ['departamentos', 'exclusivos', distribuidoraId],
    enabled: !!distribuidoraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departamentos')
        .select('id, codigo_winthor, nome')
        .eq('distribuidora_id', distribuidoraId!)
        .eq('exclusivo_professional', true)
        .order('nome')
      if (error) throw error
      return data
    },
  })
}

/** Linhas e total do PROFESSIONAL no período (mensal, trimestral ou anual). */
export function useProfessional(distribuidoraId: string | undefined, filtro: FiltroProfessional | undefined) {
  return useQuery({
    queryKey: ['vw_professional', distribuidoraId, filtro],
    enabled: !!distribuidoraId && !!filtro,
    queryFn: async (): Promise<{ linhas: LinhaProfessional[]; total: TotalProfessional | null }> => {
      const f = filtro!
      const [linhas, total] =
        f.visao === 'mensal'
          ? await Promise.all([
              supabase.from('vw_professional_mensal').select(CAMPOS_LINHA).eq('distribuidora_id', distribuidoraId!).eq('mes_ref', f.mesRef),
              supabase
                .from('vw_professional_mensal_total')
                .select(CAMPOS_TOTAL)
                .eq('distribuidora_id', distribuidoraId!)
                .eq('mes_ref', f.mesRef)
                .maybeSingle(),
            ])
          : f.visao === 'trimestral'
            ? await Promise.all([
                supabase
                  .from('vw_professional_trimestral')
                  .select(CAMPOS_LINHA)
                  .eq('distribuidora_id', distribuidoraId!)
                  .eq('ano', f.ano)
                  .eq('trimestre', f.tri),
                supabase
                  .from('vw_professional_trimestral_total')
                  .select(CAMPOS_TOTAL)
                  .eq('distribuidora_id', distribuidoraId!)
                  .eq('ano', f.ano)
                  .eq('trimestre', f.tri)
                  .maybeSingle(),
              ])
            : await Promise.all([
                supabase.from('vw_professional_anual').select(CAMPOS_LINHA).eq('distribuidora_id', distribuidoraId!).eq('ano', f.ano),
                supabase
                  .from('vw_professional_anual_total')
                  .select(CAMPOS_TOTAL)
                  .eq('distribuidora_id', distribuidoraId!)
                  .eq('ano', f.ano)
                  .maybeSingle(),
              ])
      if (linhas.error) throw linhas.error
      if (total.error) throw total.error
      return { linhas: linhas.data, total: total.data }
    },
  })
}

/** Linhas departamento × mês do PROFESSIONAL no ano (aba Acompanhamento). Poucas linhas: só exclusivos. */
export function useProfessionalMensalAno(distribuidoraId: string | undefined, ano: number | undefined) {
  return useQuery({
    queryKey: ['vw_professional', 'mensal-ano', distribuidoraId, ano],
    enabled: !!distribuidoraId && !!ano,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_professional_mensal')
        .select(`mes_ref, ${CAMPOS_LINHA}`)
        .eq('distribuidora_id', distribuidoraId!)
        .gte('mes_ref', `${ano}-01-01`)
        .lte('mes_ref', `${ano}-12-01`)
        .order('mes_ref')
      if (error) throw error
      return data
    },
  })
}

/** Total de cada mês do PROFESSIONAL no ano (linha TOTAL da aba Acompanhamento). */
export function useProfessionalTotaisAno(distribuidoraId: string | undefined, ano: number | undefined) {
  return useQuery({
    queryKey: ['vw_professional', 'totais-ano', distribuidoraId, ano],
    enabled: !!distribuidoraId && !!ano,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_professional_mensal_total')
        .select(`mes_ref, ${CAMPOS_TOTAL}`)
        .eq('distribuidora_id', distribuidoraId!)
        .gte('mes_ref', `${ano}-01-01`)
        .lte('mes_ref', `${ano}-12-01`)
      if (error) throw error
      return data
    },
  })
}

/** As views de total/trimestral do PROFESSIONAL vêm de uma migration à parte; se não foi aplicada, o PostgREST não as acha. */
export function viewsProfessionalAusentes(erro: { message?: string; code?: string } | null) {
  return !!erro && (erro.code === 'PGRST205' || /vw_professional_(mensal_total|anual_total|trimestral)/.test(erro.message ?? ''))
}
