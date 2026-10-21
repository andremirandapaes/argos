// Vitrine de desenvolvimento do Relatório Gerencial com os dados do seed (views geradas no PGlite
// e salvas em dev/dados-demo-2026.json). Sem login nem banco.
// Abrir em http://localhost:5173/dev/teste-gerencial.html?aba=acompanhamento  (?tema=escuro · ?prof=1 = Só Professional)
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import '@/index.css'
import { SessaoContext } from '@/auth/sessao-context'
import { TooltipProvider } from '@/components/ui/tooltip'
import GerencialPage from '@/features/dun-pro/GerencialPage'
import dados from './dados-demo-2026.json'
import prof from './dados-demo-gerencial-professional-2026.json'

const params = new URLSearchParams(location.search)
if (params.get('tema') === 'escuro') document.documentElement.classList.add('dark')

const D = 'dist-demo'
const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })

// nome/código dos departamentos (a view mensal da aba Padrão traz; aqui vêm da anual)
const deptos = new Map(dados.anual.map((a: { departamento_id: string; nome: string; codigo_winthor: number | null }) => [a.departamento_id, a]))
const mensalPadrao = (mes: string) =>
  dados.mensal
    .filter((m: { mes_ref: string }) => m.mes_ref === mes)
    // só nome e código vêm da anual; os valores são os do mês
    .map((m: { departamento_id: string }) => {
      const d = deptos.get(m.departamento_id)
      return { ...m, nome: d?.nome ?? null, codigo_winthor: d?.codigo_winthor ?? null }
    })

qc.setQueryData(['perfil', 'u1'], { papel: 'admin', nome: 'Nic' })
qc.setQueryData(['distribuidora', 'dun-professional'], { id: D, nome: 'DUN PROFESSIONAL' })
// chaves: o último item é o modo Só Professional (false = todos os departamentos)
qc.setQueryData(['vw_gerencial_mensal_total', D, false], dados.totais)
qc.setQueryData(['vw_gerencial_anual', D, 2026, false], { linhas: dados.anual, total: dados.anualTotal })
qc.setQueryData(['vw_gerencial_mensal', 'ano', D, 2026, false], dados.mensal)
for (const t of [1, 2, 3]) {
  qc.setQueryData(['vw_gerencial_trimestral', D, 2026, t, false], (dados.trimestral as Record<string, unknown>)[t])
}
qc.setQueryData(['vw_gerencial_mensal', D, '2026-08-01', false], mensalPadrao('2026-08-01'))
// Só Professional (views vw_gerencial_professional_*, geradas no PGlite)
qc.setQueryData(['vw_gerencial_mensal_total', D, true], prof.totais)
qc.setQueryData(['vw_gerencial_anual', D, 2026, true], { linhas: prof.anual, total: prof.anualTotal })
qc.setQueryData(['vw_gerencial_mensal', 'ano', D, 2026, true], prof.mensal)
for (const t of [1, 2, 3]) {
  qc.setQueryData(['vw_gerencial_trimestral', D, 2026, t, true], (prof.trimestral as Record<string, unknown>)[t])
}
qc.setQueryData(['vw_gerencial_mensal', D, '2026-08-01', true], prof.mensalAgo)

const sessao = { user: { id: 'u1', email: 'nic@demo' } } as unknown as Session
const aba = params.get('aba')
const extra = ['periodo', 'tri', 'ano', 'prof', 'visao'].filter((k) => params.get(k)).map((k) => `&${k}=${params.get(k)}`).join('')

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <SessaoContext.Provider value={{ sessao, carregando: false }}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[`/?aba=${aba ?? 'padrao'}${extra}`]}>
          <div className="flex min-h-svh flex-col bg-background">
            <GerencialPage />
          </div>
        </MemoryRouter>
      </TooltipProvider>
    </SessaoContext.Provider>
  </QueryClientProvider>,
)
