// Lançamento de terceirizados (INOVAR) por mês. O lançamento do mês substitui os terceirizados das
// planilhas manuais naquele mês (lista vazia = "não havia terceirizados"). Gravação pela função
// hc_salvar_terceirizados.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'
import type { Area, UF } from '../regras'

export type ItemTerceirizado = {
  uf: UF
  area: Area
  distribuidora: string | null // Comercial
  centro: string | null // Comercial: Vendas / Merchan (null = não definido)
  departamento: string | null // Backoffice: departamento; Logística: setor (Depósito / Distribuição)
  quantidade: number
}

export function useSalvarTerceirizados() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ competencia, itens }: { competencia: string; itens: ItemTerceirizado[] }) => {
      const { data, error } = await supabase.rpc('hc_salvar_terceirizados', {
        p_competencia: `${competencia}-01`,
        p_itens: itens as unknown as Json,
      })
      if (error) {
        const m = error.message ?? ''
        throw new Error(
          /sem permissão/i.test(m)
            ? 'Seu perfil não pode lançar terceirizados (precisa ser editor ou administrador).'
            : /check constraint/i.test(m)
              ? 'Há linha com área, distribuidora ou departamento fora do formato esperado.'
              : m.replace(/^ARGOS:\s*/, ''),
        )
      }
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['headcount'] }),
  })
}
