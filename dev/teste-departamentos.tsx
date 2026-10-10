// Vitrine de desenvolvimento da tela Departamentos com os departamentos do seed (sem banco).
// Abrir em http://localhost:5173/dev/teste-departamentos.html  (?importar=1 abre a importação com uma lista exemplo)
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import '@/index.css'
import { SessaoContext } from '@/auth/sessao-context'
import { TooltipProvider } from '@/components/ui/tooltip'
import DepartamentosPage from '@/features/dun-pro/departamentos/DepartamentosPage'
import dados from './dados-demo-2026.json'

const params = new URLSearchParams(location.search)
if (params.get('tema') === 'escuro') document.documentElement.classList.add('dark')

const D = 'dist-demo'
const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
qc.setQueryData(['perfil', 'u1'], { papel: 'admin', nome: 'Nic' })
qc.setQueryData(['distribuidora', 'dun-professional'], { id: D, nome: 'DUN PROFESSIONAL' })
qc.setQueryData(['departamentos', 'lista', D], dados.departamentos)

const sessao = { user: { id: 'u1', email: 'nic@demo' } } as unknown as Session

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <SessaoContext.Provider value={{ sessao, carregando: false }}>
      <TooltipProvider>
        <MemoryRouter>
          <div className="flex min-h-svh flex-col bg-background">
            <DepartamentosPage />
          </div>
        </MemoryRouter>
      </TooltipProvider>
    </SessaoContext.Provider>
  </QueryClientProvider>,
)

if (params.get('importar')) {
  setTimeout(() => {
    ;[...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Importar códigos'))?.click()
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('input[type=file]')
      if (!input) return
      const csv = 'nome;codigo\nADM RACOES;301\nCCM;302\nSEARA;91\nHAVAIANAS;303\nNAO EXISTE;304\nDIAGEO;999\nKONIG;303'
      const dt = new DataTransfer()
      dt.items.add(new File([csv], 'lista-codigos.csv'))
      input.files = dt.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }, 800)
  }, 1200)
}
