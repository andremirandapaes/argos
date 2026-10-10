// Vitrine de desenvolvimento da tela Atualizar bases do HeadCount (sem banco).
// Abrir em http://localhost:5173/dev/teste-headcount-importar.html?arquivo=<nome em dev/>&nome=<nome do arquivo simulado>
// O arquivo de teste NÃO fica no projeto (as exportações do sistema têm nomes e salários): copie, tire o print e apague.
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import '@/index.css'
import { SessaoContext } from '@/auth/sessao-context'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import AtualizarBasesPage from '@/features/headcount/importacao/AtualizarBasesPage'

const params = new URLSearchParams(location.search)
if (params.get('tema') === 'escuro') document.documentElement.classList.add('dark')

const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
qc.setQueryData(['perfil', 'u1'], { papel: 'admin', nome: 'Nic' })
// simula uma base do sistema já existente para Ago/26 (mostra o aviso de substituição)
qc.setQueryData(['headcount', 'fontes'], params.get('existe') ? [{ fonte: `sistema_${params.get('existe')}`, tipo: 'sistema', uf: 'AM/RR', ufs: ['AM', 'RR'], resumo: null, arquivo: 'FPRE_anterior.xlsx', competencias: [params.get('existe')], avisos: [], padronizacoes: [], importadoEm: '2026-10-01T12:00:00Z' }] : [])
const sessao = { user: { id: 'u1', email: 'nic@demo' } } as unknown as Session

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <SessaoContext.Provider value={{ sessao, carregando: false }}>
      <TooltipProvider>
        <MemoryRouter>
          <div className="flex min-h-svh flex-col bg-background">
            <AtualizarBasesPage />
          </div>
          <Toaster />
        </MemoryRouter>
      </TooltipProvider>
    </SessaoContext.Provider>
  </QueryClientProvider>,
)

const arquivo = params.get('arquivo')
if (arquivo) {
  setTimeout(async () => {
    const blob = await (await fetch(`/dev/${arquivo}`)).blob()
    const input = document.querySelector<HTMLInputElement>('input[type=file]')
    if (!input) return
    const dt = new DataTransfer()
    dt.items.add(new File([blob], params.get('nome') ?? arquivo))
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, 600)
}
