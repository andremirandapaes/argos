// Páginas do módulo DUN PRO, carregadas sob demanda
// (AG Grid, Recharts e SheetJS só são baixados quando a tela é aberta).
import { lazy } from 'react'

export const GerencialPage = lazy(() => import('./GerencialPage'))
export const ImportarPage = lazy(() => import('./importacao/ImportarPage'))
export const HistoricoPage = lazy(() => import('./versoes/HistoricoPage'))
export const DespesasPage = lazy(() => import('./despesas/DespesasPage'))
export const EvolucaoPage = lazy(() => import('./evolucao/EvolucaoPage'))
export const DepartamentosPage = lazy(() => import('./departamentos/DepartamentosPage'))
