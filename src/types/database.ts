// Tipos do banco ARGOS.
// Escritos à mão a partir de supabase/migrations/20260927000000_argos_inicial.sql,
// no mesmo formato do `supabase gen types typescript`. Quando houver acesso ao CLI,
// substituir por:  npx supabase gen types typescript --project-id <id> > src/types/database.ts
// (colunas de views são anuláveis, como no arquivo gerado)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Papel = 'admin' | 'editor' | 'leitor'

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12'
  }
  public: {
    Tables: {
      perfis: {
        Row: {
          user_id: string
          nome: string | null
          papel: string
          criado_em: string
        }
        Insert: {
          user_id: string
          nome?: string | null
          papel?: string
          criado_em?: string
        }
        Update: {
          user_id?: string
          nome?: string | null
          papel?: string
          criado_em?: string
        }
        Relationships: []
      }
      distribuidoras: {
        Row: {
          id: string
          slug: string
          nome: string
          criado_em: string
        }
        Insert: {
          id?: string
          slug: string
          nome: string
          criado_em?: string
        }
        Update: {
          id?: string
          slug?: string
          nome?: string
          criado_em?: string
        }
        Relationships: []
      }
      departamentos: {
        Row: {
          id: string
          distribuidora_id: string
          codigo_winthor: number | null
          nome: string
          exclusivo_professional: boolean
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          distribuidora_id: string
          codigo_winthor?: number | null
          nome: string
          exclusivo_professional?: boolean
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          distribuidora_id?: string
          codigo_winthor?: number | null
          nome?: string
          exclusivo_professional?: boolean
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: 'departamentos_distribuidora_id_fkey'
            columns: ['distribuidora_id']
            isOneToOne: false
            referencedRelation: 'distribuidoras'
            referencedColumns: ['id']
          },
        ]
      }
      cargas_faturamento: {
        Row: {
          id: string
          distribuidora_id: string
          mes_ref: string
          versao: number
          vigente: boolean
          origem: string
          arquivo_nome: string | null
          arquivo_path: string | null
          qtd_linhas: number
          total_faturamento: number
          total_margem_valor: number
          observacao: string | null
          enviado_por: string | null
          enviado_em: string
        }
        Insert: {
          id?: string
          distribuidora_id: string
          mes_ref: string
          versao: number
          vigente?: boolean
          origem?: string
          arquivo_nome?: string | null
          arquivo_path?: string | null
          qtd_linhas: number
          total_faturamento: number
          total_margem_valor: number
          observacao?: string | null
          enviado_por?: string | null
          enviado_em?: string
        }
        Update: {
          id?: string
          distribuidora_id?: string
          mes_ref?: string
          versao?: number
          vigente?: boolean
          origem?: string
          arquivo_nome?: string | null
          arquivo_path?: string | null
          qtd_linhas?: number
          total_faturamento?: number
          total_margem_valor?: number
          observacao?: string | null
          enviado_por?: string | null
          enviado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cargas_faturamento_distribuidora_id_fkey'
            columns: ['distribuidora_id']
            isOneToOne: false
            referencedRelation: 'distribuidoras'
            referencedColumns: ['id']
          },
        ]
      }
      faturamento_linhas: {
        Row: {
          id: number
          carga_id: string
          departamento_id: string
          codigo_winthor: number | null
          nome_departamento: string
          faturamento_liquido: number
          margem_pct: number
          margem_valor: number | null
          linha_original: Json | null
        }
        Insert: {
          id?: never
          carga_id: string
          departamento_id: string
          codigo_winthor?: number | null
          nome_departamento: string
          faturamento_liquido: number
          margem_pct: number
          margem_valor?: never
          linha_original?: Json | null
        }
        Update: {
          id?: never
          carga_id?: string
          departamento_id?: string
          codigo_winthor?: number | null
          nome_departamento?: string
          faturamento_liquido?: number
          margem_pct?: number
          margem_valor?: never
          linha_original?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'faturamento_linhas_carga_id_fkey'
            columns: ['carga_id']
            isOneToOne: false
            referencedRelation: 'cargas_faturamento'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'faturamento_linhas_departamento_id_fkey'
            columns: ['departamento_id']
            isOneToOne: false
            referencedRelation: 'departamentos'
            referencedColumns: ['id']
          },
        ]
      }
      lancamentos_despesa: {
        Row: {
          id: string
          distribuidora_id: string
          mes_ref: string
          versao: number
          vigente: boolean
          valor_total: number
          origem: string
          observacao: string | null
          lancado_por: string | null
          lancado_em: string
        }
        Insert: {
          id?: string
          distribuidora_id: string
          mes_ref: string
          versao: number
          vigente?: boolean
          valor_total: number
          origem?: string
          observacao?: string | null
          lancado_por?: string | null
          lancado_em?: string
        }
        Update: {
          id?: string
          distribuidora_id?: string
          mes_ref?: string
          versao?: number
          vigente?: boolean
          valor_total?: number
          origem?: string
          observacao?: string | null
          lancado_por?: string | null
          lancado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lancamentos_despesa_distribuidora_id_fkey'
            columns: ['distribuidora_id']
            isOneToOne: false
            referencedRelation: 'distribuidoras'
            referencedColumns: ['id']
          },
        ]
      }
      // --- HeadCount (20261004000000_headcount.sql) ---
      hc_fontes: {
        Row: {
          fonte: string
          tipo: string
          uf: string
          ufs: string[] | null
          resumo: Json | null
          arquivo: string
          competencias: string[]
          avisos: Json
          padronizacoes: Json
          importado_em: string | null
          importado_por: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      hc_linhas: {
        Row: {
          id: number
          fonte: string
          competencia: string
          uf: string
          area: string
          distribuidora: string | null
          centro: string | null
          departamento: string | null
          cargo: string | null
          vinculo: string
          quantidade: number
        }
        Insert: never
        Update: never
        Relationships: []
      }
      hc_terceirizados_mes: {
        Row: {
          competencia: string
          atualizado_em: string
          atualizado_por: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      hc_terceirizados_itens: {
        Row: {
          id: number
          competencia: string
          uf: string
          area: string
          distribuidora: string | null
          centro: string | null
          departamento: string | null
          quantidade: number
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: {
      vw_faturamento_vigente: {
        Row: {
          distribuidora_id: string | null
          mes_ref: string | null
          carga_id: string | null
          versao: number | null
          departamento_id: string | null
          codigo_winthor: number | null
          nome: string | null
          exclusivo_professional: boolean | null
          faturamento_liquido: number | null
          margem_valor: number | null
        }
        Relationships: []
      }
      vw_despesa_vigente: {
        Row: {
          distribuidora_id: string | null
          mes_ref: string | null
          lancamento_id: string | null
          versao: number | null
          valor_total: number | null
        }
        Relationships: []
      }
      vw_gerencial_mensal: {
        Row: {
          distribuidora_id: string | null
          mes_ref: string | null
          carga_id: string | null
          versao_faturamento: number | null
          versao_despesa: number | null
          departamento_id: string | null
          codigo_winthor: number | null
          nome: string | null
          exclusivo_professional: boolean | null
          faturamento_liquido: number | null
          rentabilidade: number | null
          participacao: number | null
          despesa_total_mes: number | null
          rentabilidade_pct: number | null
          despesa_rateada: number | null
          lb: number | null
          lb_pct: number | null
        }
        Relationships: []
      }
      vw_gerencial_mensal_total: {
        Row: {
          distribuidora_id: string | null
          mes_ref: string | null
          versao_faturamento: number | null
          versao_despesa: number | null
          qtd_departamentos: number | null
          faturamento_liquido: number | null
          rentabilidade: number | null
          rentabilidade_pct: number | null
          despesa: number | null
          lb: number | null
          lb_pct: number | null
          custo_op_pct: number | null
        }
        Relationships: []
      }
      vw_gerencial_anual: {
        Row: {
          distribuidora_id: string | null
          ano: number | null
          departamento_id: string | null
          codigo_winthor: number | null
          nome: string | null
          exclusivo_professional: boolean | null
          faturamento_liquido: number | null
          rentabilidade: number | null
          participacao: number | null
          despesa_total_ano: number | null
          rentabilidade_pct: number | null
          despesa_rateada: number | null
          lb: number | null
          lb_pct: number | null
        }
        Relationships: []
      }
      vw_gerencial_anual_total: {
        Row: {
          distribuidora_id: string | null
          ano: number | null
          faturamento_liquido: number | null
          rentabilidade: number | null
          rentabilidade_pct: number | null
          despesa: number | null
          lb: number | null
          lb_pct: number | null
          custo_op_pct: number | null
        }
        Relationships: []
      }
      vw_gerencial_trimestral: {
        Row: {
          distribuidora_id: string | null
          ano: number | null
          trimestre: number | null
          departamento_id: string | null
          codigo_winthor: number | null
          nome: string | null
          exclusivo_professional: boolean | null
          faturamento_liquido: number | null
          rentabilidade: number | null
          participacao: number | null
          despesa_total_trimestre: number | null
          rentabilidade_pct: number | null
          despesa_rateada: number | null
          lb: number | null
          lb_pct: number | null
        }
        Relationships: []
      }
      vw_gerencial_trimestral_total: {
        Row: {
          distribuidora_id: string | null
          ano: number | null
          trimestre: number | null
          meses_com_carga: number | null
          meses_com_despesa: number | null
          faturamento_liquido: number | null
          rentabilidade: number | null
          rentabilidade_pct: number | null
          despesa: number | null
          lb: number | null
          lb_pct: number | null
          custo_op_pct: number | null
        }
        Relationships: []
      }
      vw_professional_mensal: {
        Row: {
          distribuidora_id: string | null
          mes_ref: string | null
          departamento_id: string | null
          codigo_winthor: number | null
          nome: string | null
          faturamento_liquido: number | null
          rentabilidade: number | null
          rentabilidade_pct: number | null
          participacao: number | null
        }
        Relationships: []
      }
      vw_professional_anual: {
        Row: {
          distribuidora_id: string | null
          ano: number | null
          departamento_id: string | null
          codigo_winthor: number | null
          nome: string | null
          faturamento_liquido: number | null
          rentabilidade: number | null
          rentabilidade_pct: number | null
          participacao: number | null
        }
        Relationships: []
      }
      vw_professional_mensal_total: {
        Row: {
          distribuidora_id: string | null
          mes_ref: string | null
          qtd_departamentos: number | null
          faturamento_liquido: number | null
          rentabilidade: number | null
          rentabilidade_pct: number | null
        }
        Relationships: []
      }
      vw_professional_anual_total: {
        Row: {
          distribuidora_id: string | null
          ano: number | null
          meses_com_carga: number | null
          faturamento_liquido: number | null
          rentabilidade: number | null
          rentabilidade_pct: number | null
        }
        Relationships: []
      }
      vw_professional_trimestral: {
        Row: {
          distribuidora_id: string | null
          ano: number | null
          trimestre: number | null
          departamento_id: string | null
          codigo_winthor: number | null
          nome: string | null
          faturamento_liquido: number | null
          rentabilidade: number | null
          rentabilidade_pct: number | null
          participacao: number | null
        }
        Relationships: []
      }
      vw_professional_trimestral_total: {
        Row: {
          distribuidora_id: string | null
          ano: number | null
          trimestre: number | null
          meses_com_carga: number | null
          faturamento_liquido: number | null
          rentabilidade: number | null
          rentabilidade_pct: number | null
        }
        Relationships: []
      }
      vw_headcount_linhas: {
        Row: {
          id: number | null
          competencia: string | null
          uf: string | null
          area: string | null
          distribuidora: string | null
          centro: string | null
          departamento: string | null
          cargo: string | null
          vinculo: string | null
          quantidade: number | null
          fonte: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      papel_atual: {
        Args: never
        Returns: string
      }
      registrar_carga_faturamento: {
        Args: {
          p_distribuidora_slug: string
          p_mes_ref: string
          p_linhas: Json
          p_arquivo_nome?: string
          p_arquivo_path?: string
          p_observacao?: string
        }
        Returns: string
      }
      definir_carga_vigente: {
        Args: { p_carga_id: string }
        Returns: undefined
      }
      registrar_despesa: {
        Args: {
          p_distribuidora_slug: string
          p_mes_ref: string
          p_valor_total: number
          p_observacao?: string
        }
        Returns: string
      }
      definir_despesa_vigente: {
        Args: { p_lancamento_id: string }
        Returns: undefined
      }
      resumo_gerencial_periodo: {
        Args: { p_distribuidora_slug: string; p_inicio: string; p_fim: string }
        Returns: {
          meses_com_carga: number
          faturamento_liquido: number | null
          rentabilidade: number | null
          rentabilidade_pct: number | null
          despesa: number | null
          lb: number | null
          lb_pct: number | null
          custo_op_pct: number | null
        }[]
      }
      comparar_cargas_faturamento: {
        Args: { p_carga_a: string; p_carga_b: string }
        Returns: {
          departamento_id: string
          codigo_winthor: number
          nome: string
          faturamento_a: number
          faturamento_b: number
          dif_faturamento: number
          rentabilidade_a: number
          rentabilidade_b: number
          dif_rentabilidade: number
          situacao: string
        }[]
      }
      hc_registrar_bases: {
        Args: { p_bases: Json }
        Returns: number
      }
      hc_salvar_terceirizados: {
        Args: { p_competencia: string; p_itens: Json }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database['public']

export type Tabela<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type View<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row']
export type RetornoFuncao<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T]['Returns']
