// Importação das bases do HeadCount: leitura do arquivo no navegador e gravação pela função
// hc_registrar_bases (a base do mês substitui a anterior por inteiro, sem versões).

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { WorkBook } from 'xlsx'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'
import type { AbaPlanilha, BaseSistema } from './ler-sistema'

/** Todas as abas do arquivo como linhas cruas (uma lista por linha). */
export async function lerAbas(arquivo: File): Promise<AbaPlanilha[]> {
  const XLSX = await import('xlsx')
  const wb: WorkBook = XLSX.read(await arquivo.arrayBuffer(), { type: 'array' })
  return wb.SheetNames.map((nome) => ({
    nome,
    linhas: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nome], { header: 1, raw: true, defval: null }),
  }))
}

/** Mensagens do banco em português. */
export function traduzirErroImportacao(e: unknown) {
  const m = (e as { message?: string })?.message ?? String(e)
  if (/sem permissão/i.test(m)) return 'Seu perfil não pode atualizar as bases do HeadCount (precisa ser editor ou administrador).'
  if (/hc_fontes_sistema_chk/.test(m)) return 'A competência da base não foi identificada. Escolha o mês antes de salvar.'
  if (/check constraint/i.test(m)) return 'A base tem dados fora do formato esperado (área, filial ou vínculo). Confira o arquivo.'
  return m.replace(/^ARGOS:\s*/, '')
}

export function useRegistrarBaseSistema() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (base: BaseSistema) => {
      const payload = [
        {
          fonte: base.fonte,
          tipo: base.tipo,
          uf: base.uf,
          ufs: base.ufs,
          resumo: base.resumo,
          arquivo: base.arquivo,
          avisos: base.avisos,
          padronizacoes: base.padronizacoes,
          // o banco guarda a competência como o primeiro dia do mês
          linhas: base.linhas.map((l) => ({ ...l, competencia: `${l.competencia}-01` })),
        },
      ]
      const { data, error } = await supabase.rpc('hc_registrar_bases', { p_bases: payload as unknown as Json })
      if (error) throw new Error(traduzirErroImportacao(error))
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['headcount'] }),
  })
}
