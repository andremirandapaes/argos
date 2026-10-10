import { lazy } from 'react'

// Telas do módulo HeadCount, carregadas sob demanda.
export const PainelHeadcountPage = lazy(() => import('./PainelPage'))
export const AtualizarBasesPage = lazy(() => import('./importacao/AtualizarBasesPage'))
