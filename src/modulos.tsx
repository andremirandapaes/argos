// Registro de módulos do ARGOS.
// Cada módulo é um item recolhível na sidebar ("Módulos"); cada tela, uma rota.
// A ordem das telas segue o fluxo de trabalho: primeiro a entrada de dados, depois os relatórios.
// Novo módulo (outra distribuidora, orçamento...) = nova entrada aqui + as páginas dele.

import type { ReactElement } from 'react'
import {
  BarChart3,
  BriefcaseBusiness,
  FileUp,
  History,
  LayoutDashboard,
  Receipt,
  Tags,
  UsersRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Papel } from '@/types/database'
import {
  DepartamentosPage,
  DespesasPage,
  EvolucaoPage,
  GerencialPage,
  HistoricoPage,
  ImportarPage,
} from '@/features/dun-pro/paginas'
import { UsuariosPage } from '@/features/admin/paginas'
import { AtualizarBasesPage, PainelHeadcountPage } from '@/features/headcount/paginas'
import { NOME_DUNO_PRO } from '@/lib/constantes'

export type Tela = {
  /** trecho da URL, relativo ao módulo */
  caminho: string
  titulo: string
  icone: LucideIcon
  /** papel mínimo para ver a tela no menu (e acessar a rota) */
  papelMinimo: Papel
  elemento: ReactElement
}

export type Modulo = {
  /** trecho da URL do módulo, ex.: "dun-professional" */
  id: string
  titulo: string
  /** linha de apoio exibida abaixo do título no menu */
  subtitulo?: string
  icone: LucideIcon
  /** "modulo" aparece em "Módulos"; "sistema" fica no bloco de administração, no rodapé do menu */
  area: 'modulo' | 'sistema'
  /** caminho da tela aberta ao entrar no módulo */
  telaInicial: string
  telas: Tela[]
}

export const MODULOS: Modulo[] = [
  {
    id: 'dun-professional',
    titulo: NOME_DUNO_PRO, // logo da Duno Pro virá depois
    subtitulo: 'Gerencial mensal',
    icone: BriefcaseBusiness,
    area: 'modulo',
    telaInicial: 'gerencial',
    telas: [
      { caminho: 'importar', titulo: 'Importar faturamento', icone: FileUp, papelMinimo: 'editor', elemento: <ImportarPage /> },
      { caminho: 'gerencial', titulo: 'Relatório Gerencial', icone: LayoutDashboard, papelMinimo: 'leitor', elemento: <GerencialPage /> },
      { caminho: 'despesas', titulo: 'Despesas', icone: Receipt, papelMinimo: 'leitor', elemento: <DespesasPage /> },
      { caminho: 'evolucao', titulo: 'Evolução', icone: BarChart3, papelMinimo: 'leitor', elemento: <EvolucaoPage /> },
      { caminho: 'historico', titulo: 'Histórico de cargas', icone: History, papelMinimo: 'leitor', elemento: <HistoricoPage /> },
      { caminho: 'departamentos', titulo: 'Departamentos', icone: Tags, papelMinimo: 'leitor', elemento: <DepartamentosPage /> },
    ],
  },
  {
    id: 'headcount',
    titulo: 'HeadCount',
    subtitulo: 'Colaboradores por mês',
    icone: UsersRound,
    area: 'modulo',
    telaInicial: 'painel',
    telas: [
      { caminho: 'importar', titulo: 'Atualizar bases', icone: FileUp, papelMinimo: 'editor', elemento: <AtualizarBasesPage /> },
      { caminho: 'painel', titulo: 'Painel', icone: LayoutDashboard, papelMinimo: 'leitor', elemento: <PainelHeadcountPage /> },
    ],
  },
  {
    id: 'admin',
    titulo: 'Administração',
    icone: Users,
    area: 'sistema',
    telaInicial: 'usuarios',
    telas: [
      { caminho: 'usuarios', titulo: 'Usuários', icone: Users, papelMinimo: 'admin', elemento: <UsuariosPage /> },
    ],
  },
]

/** Rota inicial depois do login. */
export const ROTA_INICIAL = '/dun-professional/gerencial'

export function rotaDaTela(modulo: Modulo, tela: Tela) {
  return `/${modulo.id}/${tela.caminho}`
}
