// Vitrine de desenvolvimento da tela Despesas, com dados simulados (sem banco).
// Abrir em http://localhost:5173/dev/teste-despesas.html  (?tema=escuro, ?expandir=1, ?mes=2026-07)
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import '@/index.css'
import { SessaoContext } from '@/auth/sessao-context'
import { TooltipProvider } from '@/components/ui/tooltip'
import DespesasPage from '@/features/dun-pro/despesas/DespesasPage'

const params = new URLSearchParams(location.search)
if (params.get('tema') === 'escuro') document.documentElement.classList.add('dark')
if (params.get('rotulos')) localStorage.setItem('argos-despesas-rotulos', '1')

const D = 'dist-demo'
const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })

// despesas (jan–ago/26) e faturamento aproximado para o custo operacional
const dados: [string, number, number][] = [
  ['2026-01-01', 246354.13, 1829352.51],
  ['2026-02-01', 205113.4, 1942118.3],
  ['2026-03-01', 214034.32, 2151361.96],
  ['2026-04-01', 198744.1, 2176510.2],
  ['2026-05-01', 201520.77, 2287233.4],
  ['2026-06-01', 195311.72, 2194867.37],
  ['2026-07-01', 206629.27, 2463876.0],
  ['2026-08-01', 220349.5, 2637066.51],
]

qc.setQueryData(['perfil', 'u1'], { papel: 'admin', nome: 'Nic' })
qc.setQueryData(['distribuidora', 'dun-professional'], { id: D, nome: 'DUN PROFESSIONAL' })
qc.setQueryData(['perfis', 'nomes'], new Map([['u1', 'Nic']]))
qc.setQueryData(
  ['vw_gerencial_mensal_total', D],
  dados.map(([mes_ref, despesa, fat]) => ({ mes_ref, despesa, faturamento_liquido: fat, custo_op_pct: despesa / fat })),
)
qc.setQueryData(
  ['lancamentos_despesa', 'vigentes', D],
  dados.map(([mes_ref, valor_total]) => ({ mes_ref, valor_total, versao: mes_ref === '2026-07-01' ? 2 : 1 })),
)
const lanc = (mes: string, versao: number, vigente: boolean, valor: number, extra: Record<string, unknown> = {}) => ({
  id: `${mes}-v${versao}`,
  mes_ref: mes,
  versao,
  vigente,
  valor_total: valor,
  origem: 'historico_planilha',
  observacao: null,
  lancado_por: null,
  lancado_em: '2026-09-27T09:00:00Z',
  ...extra,
})
qc.setQueryData(['lancamentos_despesa', D, 2026], [
  ...dados.flatMap(([mes, valor]) =>
    mes === '2026-07-01'
      ? [
          lanc(mes, 2, true, valor, { origem: 'manual', lancado_por: 'u1', lancado_em: '2026-09-29T11:20:00Z', observacao: 'Ajuste de provisão de férias' }),
          lanc(mes, 1, false, 201000),
        ]
      : [lanc(mes, 1, true, valor)],
  ),
])

const sessao = { user: { id: 'u1', email: 'nic@demo' } } as unknown as Session
const mes = params.get('mes')

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <SessaoContext.Provider value={{ sessao, carregando: false }}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[mes ? `/?mes=${mes}` : '/']}>
          <div className="min-h-svh bg-background">
            <DespesasPage />
          </div>
        </MemoryRouter>
      </TooltipProvider>
    </SessaoContext.Provider>
  </QueryClientProvider>,
)

// ?arrastar=1,4 → simula arrastar do ponto de índice 1 (Fev) ao 4 (Mai) no gráfico de despesa
const arrastar = params.get('arrastar')
if (arrastar) {
  const [de, ate] = arrastar.split(',').map(Number)
  setTimeout(() => {
    const grafico = document.querySelector('.recharts-wrapper')
    const pontos = grafico?.querySelectorAll('.recharts-line-dots circle')
    if (!grafico || !pontos) return
    const alvo = grafico.querySelector('.recharts-surface') ?? grafico
    const centro = (i: number) => {
      const r = pontos[i].getBoundingClientRect()
      return { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true }
    }
    // como um mouse real: passa pelo ponto, pressiona, arrasta e solta, com pausas entre os eventos
    const passos: [string, number][] = [
      ['mousemove', de],
      ['mousedown', de],
      ...Array.from({ length: ate - de + 1 }, (_, k) => ['mousemove', de + k] as [string, number]),
      ['mouseup', ate],
    ]
    passos.forEach(([tipo, i], k) => setTimeout(() => alvo.dispatchEvent(new MouseEvent(tipo, centro(i))), k * 400))
  }, 2000)
}

if (params.get('expandir')) {
  setTimeout(() => document.querySelector<HTMLButtonElement>('button[aria-label="Ver versões"]')?.click(), 1500)
}
