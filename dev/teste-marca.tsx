// Vitrine da identidade visual: app completo (sidebar, cabeçalho e uma tela) e a tela de login, sem banco.
// Abrir em http://localhost:5173/dev/teste-marca.html
//   ?tela=login  · ?rota=/headcount/painel (padrão) · ?tema=escuro · ?menu=fechado
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import '@/index.css'
import { SessaoContext } from '@/auth/sessao-context'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import App from '@/App'
import { padronizarDepartamento, type Linha } from '@/features/headcount/regras'
import base from './headcount-base-inicial.json'

const params = new URLSearchParams(location.search)
if (params.get('tema') === 'escuro') document.documentElement.classList.add('dark')
if (params.get('menu') === 'fechado') document.cookie = 'sidebar_state=false; path=/'
else document.cookie = 'sidebar_state=true; path=/'

type Base = { tipo: string; ufs?: string[]; competencias: string[]; rows: Linha[] }
const bases = base as unknown as Base[]
const cobertas = new Set(bases.filter((b) => b.tipo === 'sistema').flatMap((b) => (b.ufs ?? []).map((u) => `${b.competencias[0]}|${u}`)))
const linhas: Linha[] = bases
  .flatMap((b) =>
    b.tipo === 'sistema'
      ? b.rows.filter((r) => r[2] !== 'Logística' || r[0] >= '2026-01')
      : b.rows.filter((r) => r[7] === 'Terceirizado' || (r[2] === 'Logística' && r[0] < '2026-01') || !cobertas.has(`${r[0]}|${r[1]}`)),
  )
  .map((r) => [r[0], r[1], r[2], r[3], r[4], r[5] ? padronizarDepartamento(r[5]) : null, r[6], r[7], r[8]] as Linha)

const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
qc.setQueryData(['perfil', 'u1'], { papel: 'admin', nome: 'Nic' })
qc.setQueryData(['headcount', 'linhas'], linhas)
qc.setQueryData(
  ['headcount', 'fontes'],
  bases.map((b) => ({ fonte: 'x' + b.tipo, tipo: b.tipo, uf: '', ufs: b.ufs ?? null, resumo: null, arquivo: '', competencias: b.competencias, avisos: [], padronizacoes: [], importadoEm: null })),
)
qc.setQueryData(['headcount', 'terceirizados-meses'], [])

const login = params.get('tela') === 'login'
const sessao = login ? null : ({ user: { id: 'u1', email: 'nic@grupomedeiros.com.br', user_metadata: { nome: 'Nic' } } } as unknown as Session)

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <SessaoContext.Provider value={{ sessao, carregando: false }}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[login ? '/login' : (params.get('rota') ?? '/headcount/painel')]}>
          <App />
          <Toaster />
        </MemoryRouter>
      </TooltipProvider>
    </SessaoContext.Provider>
  </QueryClientProvider>,
)
