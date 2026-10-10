// Vitrine de desenvolvimento do Histórico de cargas e da Comparação, com dados simulados (sem banco).
// Abrir em http://localhost:5173/dev/teste-historico.html
//   ?tela=comparar → abre a comparação v1 × v2 de Ago/26
//   ?dialogo=1     → abre a confirmação de "Tornar vigente" (na lista)
//   ?tema=escuro   → tema escuro
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import '@/index.css'
import { SessaoContext } from '@/auth/sessao-context'
import { TooltipProvider } from '@/components/ui/tooltip'
import HistoricoPage from '@/features/dun-pro/versoes/HistoricoPage'

const params = new URLSearchParams(location.search)
if (params.get('tema') === 'escuro') document.documentElement.classList.add('dark')

const D = 'dist-demo'
const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })

const carga = (id: string, mes: string, versao: number, vigente: boolean, extra: Record<string, unknown> = {}) => ({
  id,
  mes_ref: mes,
  versao,
  vigente,
  origem: 'historico_planilha',
  arquivo_nome: null,
  arquivo_path: null,
  qtd_linhas: 61,
  total_faturamento: 2637066.51,
  total_margem_valor: 576446.4,
  observacao: null,
  enviado_por: null,
  enviado_em: '2026-09-27T10:00:00Z',
  distribuidora_id: D,
  ...extra,
})

const v1 = carga('c1', '2026-08-01', 1, false)
const v2 = carga('c2', '2026-08-01', 2, true, {
  origem: 'upload',
  arquivo_nome: '1464_prof_agosto.xls',
  arquivo_path: 'dun-professional/2026-08/v2_x.xls',
  qtd_linhas: 63,
  observacao: 'Teste de reenvio da base de agosto (critério de aceite)',
  enviado_por: 'u1',
  enviado_em: '2026-09-29T14:32:00Z',
})
const jul = carga('c3', '2026-07-01', 1, true, { total_faturamento: 2463876.0, total_margem_valor: 509791.15 })

qc.setQueryData(['perfil', 'u1'], { papel: 'admin', nome: 'Nic' })
qc.setQueryData(['distribuidora', 'dun-professional'], { id: D, nome: 'DUN PROFESSIONAL' })
qc.setQueryData(['vw_gerencial_mensal_total', D], [{ mes_ref: '2026-07-01' }, { mes_ref: '2026-08-01' }])
qc.setQueryData(['cargas_faturamento', 'ano', D, 2026], [v2, v1, jul])
qc.setQueryData(['perfis', 'nomes'], new Map([['u1', 'Nic']]))
qc.setQueryData(['cargas_faturamento', 'id', 'c1'], v1)
qc.setQueryData(['cargas_faturamento', 'id', 'c2'], v2)
qc.setQueryData(['cargas_faturamento', 'mes', D, '2026-08-01'], [v2, v1])

const linhaCmp = (id: string, cod: number | null, nome: string, fa: number, fb: number, ra: number, rb: number, situacao: string) => ({
  departamento_id: id,
  codigo_winthor: cod,
  nome,
  faturamento_a: fa,
  faturamento_b: fb,
  dif_faturamento: fb - fa,
  rentabilidade_a: ra,
  rentabilidade_b: rb,
  dif_rentabilidade: rb - ra,
  situacao,
})
qc.setQueryData(
  ['comparacao', 'c1', 'c2'],
  [
    linhaCmp('d1', 91, 'SOFTYS - PROFESSIONAL', 513175.86, 518000.0, 129419.2, 130100.5, 'alterado'),
    linhaCmp('d2', 12, 'KIMBERLY CLARK', 200000, 196500.25, 40000, 39120.1, 'alterado'),
    linhaCmp('d3', 250, 'BRINDES ROTA NORTE', 0, 0, 0, 0, 'novo'),
    linhaCmp('d4', 139, 'BOEHRINGER INGELHEIM', 0, 0, 0, 0, 'novo'),
    linhaCmp('d5', 77, 'DEPTO ANTIGO', 1500, 0, 300, 0, 'removido'),
    linhaCmp('d6', 45, 'SANTHER', 142000, 142000, 14200, 14200, 'igual'),
  ],
)

const sessao = { user: { id: 'u1', email: 'nic@demo' } } as unknown as Session
const rota = params.get('tela') === 'comparar' ? '/comparar?a=c1&b=c2' : '/'

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <SessaoContext.Provider value={{ sessao, carregando: false }}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[rota]}>
          <div className="min-h-svh bg-background">
            <HistoricoPage />
          </div>
        </MemoryRouter>
      </TooltipProvider>
    </SessaoContext.Provider>
  </QueryClientProvider>,
)

if (params.get('dialogo')) {
  setTimeout(() => {
    const botao = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Tornar vigente'))
    botao?.click()
  }, 1500)
}
