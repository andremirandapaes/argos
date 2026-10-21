// Vitrine de desenvolvimento da Evolução e do PROFESSIONAL com os dados do seed (dev/dados-demo-2026.json).
// Abrir em http://localhost:5173/dev/teste-etapa6.html?tela=evolucao  (ou ?tela=professional; &tema=escuro; &rotulos=1)
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import '@/index.css'
import { SessaoContext } from '@/auth/sessao-context'
import { TooltipProvider } from '@/components/ui/tooltip'
import EvolucaoPage from '@/features/dun-pro/evolucao/EvolucaoPage'
import ProfessionalPage from '@/features/dun-pro/professional/ProfessionalPage'
import dados from './dados-demo-2026.json'

const params = new URLSearchParams(location.search)
if (params.get('tema') === 'escuro') document.documentElement.classList.add('dark')
if (params.get('rotulos')) localStorage.setItem('argos-evolucao-rotulos', '1')

const D = 'dist-demo'
const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
qc.setQueryData(['perfil', 'u1'], { papel: 'admin', nome: 'Nic' })
qc.setQueryData(['distribuidora', 'dun-professional'], { id: D, nome: 'DUN PROFESSIONAL' })
qc.setQueryData(['vw_gerencial_mensal_total', D, false], dados.totais)
qc.setQueryData(['vw_gerencial_anual', D, 2026, false], { linhas: dados.anual, total: dados.anualTotal })
qc.setQueryData(['departamentos', 'exclusivos', D], dados.professional.exclusivos)
qc.setQueryData(['vw_professional', D, { visao: 'mensal', mesRef: '2026-08-01' }], {
  linhas: dados.professional.linhasAgo,
  total: dados.professional.totalAgo,
})

qc.setQueryData(['resumo_gerencial', 'dun-professional', '2026-03-01', '2026-05-01'], dados.resumoMarMai)
// PROFESSIONAL — aba Acompanhamento (ano 2026)
qc.setQueryData(['vw_professional', 'mensal-ano', D, 2026], dados.professional.mensalAno)
qc.setQueryData(['vw_professional', 'totais-ano', D, 2026], dados.professional.totaisAno)
qc.setQueryData(['vw_professional', D, { visao: 'anual', ano: 2026 }], {
  linhas: dados.professional.anualLinhas,
  total: dados.professional.anualTotal,
})

// ?arrastar=2,4 → simula arrastar da barra de índice 2 (Mar) à 4 (Mai) no gráfico de faturamento
const arrastar = params.get('arrastar')
if (arrastar) {
  const [de, ate] = arrastar.split(',').map(Number)
  setTimeout(() => {
    const alvo = document.querySelector('.recharts-wrapper')
    if (!alvo) return
    // mede as barras a cada evento: o gráfico se redesenha durante o arraste
    const centro = (i: number) => {
      const r = document.querySelectorAll('.recharts-bar-rectangle')[i].getBoundingClientRect()
      return { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true }
    }
    const passos: [string, number][] = [['mousedown', de], ...Array.from({ length: ate - de + 1 }, (_, k) => ['mousemove', de + k] as [string, number]), ['mouseup', ate]]
    passos.forEach(([tipo, i], k) => setTimeout(() => alvo.dispatchEvent(new MouseEvent(tipo, centro(i))), k * 200))
  }, 2000)
}

const sessao = { user: { id: 'u1', email: 'nic@demo' } } as unknown as Session
const Tela = params.get('tela') === 'professional' ? ProfessionalPage : EvolucaoPage

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <SessaoContext.Provider value={{ sessao, carregando: false }}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[params.get('aba') ? `/?aba=${params.get('aba')}` : '/']}>
          <div className="flex min-h-svh flex-col bg-background">
            <Tela />
          </div>
        </MemoryRouter>
      </TooltipProvider>
    </SessaoContext.Provider>
  </QueryClientProvider>,
)
