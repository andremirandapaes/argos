// Leitura do HeadCount. A consolidação (sistema × planilhas × terceirizados lançados) vem pronta
// da view vw_headcount_linhas; as regras de exibição ficam em regras.ts.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { padronizarDepartamento, type Area, type Linha, type UF, type Vinculo } from './regras'

const TAMANHO_PAGINA = 1000 // limite padrão de linhas por resposta do Supabase

/** "2026-08-01" → "2026-08" */
const competenciaCurta = (d: string) => d.slice(0, 7)

/** Todas as linhas consolidadas, no formato usado pelas regras. */
export function useLinhasHeadcount() {
  return useQuery({
    queryKey: ['headcount', 'linhas'],
    queryFn: async () => {
      const todas: Linha[] = []
      for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
        const { data, error } = await supabase
          .from('vw_headcount_linhas')
          .select('id, competencia, uf, area, distribuidora, centro, departamento, cargo, vinculo, quantidade')
          // ordem estável: sem ela a paginação poderia repetir ou pular linhas
          .order('id')
          .range(inicio, inicio + TAMANHO_PAGINA - 1)
        if (error) throw error
        for (const r of data) {
          todas.push([
            competenciaCurta(r.competencia!),
            r.uf as UF,
            r.area as Area,
            r.distribuidora,
            r.centro,
            r.departamento ? padronizarDepartamento(r.departamento) : null,
            r.cargo,
            r.vinculo as Vinculo,
            r.quantidade!,
          ])
        }
        if (data.length < TAMANHO_PAGINA) return todas
      }
    },
  })
}

export type FonteHeadcount = {
  fonte: string
  tipo: 'sistema' | 'comercial' | 'logistica' | 'backoffice'
  uf: string
  ufs: string[] | null
  resumo: Record<string, number> | null
  arquivo: string
  /** "AAAA-MM", em ordem */
  competencias: string[]
  avisos: string[]
  padronizacoes: [string, string][]
  /** null = carga inicial (vinda do artefato) */
  importadoEm: string | null
}

/** Bases carregadas (sem as linhas): para "Sobre os dados" e a data da última importação. */
export function useFontesHeadcount() {
  return useQuery({
    queryKey: ['headcount', 'fontes'],
    queryFn: async (): Promise<FonteHeadcount[]> => {
      const { data, error } = await supabase
        .from('hc_fontes')
        .select('fonte, tipo, uf, ufs, resumo, arquivo, competencias, avisos, padronizacoes, importado_em')
        .order('fonte')
      if (error) throw error
      return data.map((f) => ({
        fonte: f.fonte,
        tipo: f.tipo as FonteHeadcount['tipo'],
        uf: f.uf,
        ufs: f.ufs,
        resumo: (f.resumo as Record<string, number> | null) ?? null,
        arquivo: f.arquivo,
        competencias: f.competencias.map(competenciaCurta).sort(),
        avisos: Array.isArray(f.avisos) ? (f.avisos as string[]) : [],
        padronizacoes: Array.isArray(f.padronizacoes) ? (f.padronizacoes as [string, string][]) : [],
        importadoEm: f.importado_em,
      }))
    },
  })
}

/** Meses com terceirizados lançados no ARGOS ("AAAA-MM" → data do lançamento). */
export function useMesesTerceirizados() {
  return useQuery({
    queryKey: ['headcount', 'terceirizados-meses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hc_terceirizados_mes').select('competencia, atualizado_em').order('competencia')
      if (error) throw error
      return data.map((t) => ({ competencia: competenciaCurta(t.competencia), atualizadoEm: t.atualizado_em }))
    },
  })
}

/** A migration do HeadCount ainda não foi aplicada no Supabase? */
export function tabelasAusentes(erro: unknown) {
  const e = erro as { code?: string; message?: string } | null
  return !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message ?? ''))
}
