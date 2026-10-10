// Importação da base do Winthor: gravação (Storage + RPC).
// A gravação é SEMPRE pelo RPC registrar_carga_faturamento; nunca insere direto nas tabelas.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { BUCKET_BASES, SLUG_DUN_PROFESSIONAL } from '@/lib/constantes'
import type { Json } from '@/types/database'
import { invalidarFaturamento } from '../api'
import { caminhoNoStorage, type LinhaBase } from './base-winthor'

export type EntradaImportacao = {
  mesRef: string
  /** versão que esta carga deve receber (max + 1); usada só no nome do arquivo no Storage */
  versaoPrevista: number
  arquivo: File
  linhas: LinhaBase[]
  observacao: string | null
}

export type ResultadoImportacao = { cargaId: string; arquivoPath: string }

/** Erro que aconteceu depois do upload: o arquivo ficou no Storage, mas a carga não foi registrada. */
export class ErroRegistroCarga extends Error {
  readonly arquivoPath: string
  constructor(mensagem: string, arquivoPath: string) {
    super(mensagem)
    this.arquivoPath = arquivoPath
  }
}

export function useRegistrarCarga() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (e: EntradaImportacao): Promise<ResultadoImportacao> => {
      // 1. arquivo original no Storage (auditoria)
      const arquivoPath = caminhoNoStorage(SLUG_DUN_PROFESSIONAL, e.mesRef, e.versaoPrevista, e.arquivo.name)
      const upload = await supabase.storage.from(BUCKET_BASES).upload(arquivoPath, e.arquivo, {
        contentType: e.arquivo.type || 'application/vnd.ms-excel',
        upsert: false,
      })
      if (upload.error) throw new Error(`Falha ao enviar o arquivo para o Storage: ${upload.error.message}`)

      // 2. nova versão do mês (já vigente) — tudo calculado e versionado pelo banco
      const { data, error } = await supabase.rpc('registrar_carga_faturamento', {
        p_distribuidora_slug: SLUG_DUN_PROFESSIONAL,
        p_mes_ref: e.mesRef,
        p_linhas: e.linhas.map((l) => ({
          codigo: l.codigo,
          nome: l.nome,
          faturamento_liquido: l.faturamento_liquido,
          margem_pct: l.margem_pct,
          linha_original: l.linha_original,
        })) as Json,
        p_arquivo_nome: e.arquivo.name,
        p_arquivo_path: arquivoPath,
        p_observacao: e.observacao ?? undefined,
      })
      // o arquivo órfão no Storage é aceitável: não afeta nenhum número
      if (error) throw new ErroRegistroCarga(error.message, arquivoPath)

      return { cargaId: data, arquivoPath }
    },
    // relatórios, histórico e departamentos (códigos preenchidos) mudam com a nova versão
    onSuccess: () => invalidarFaturamento(queryClient),
  })
}
