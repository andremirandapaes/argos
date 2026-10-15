// Vitrine de desenvolvimento do painel HeadCount com a base migrada do artefato (sem banco).
// Abrir em http://localhost:5173/dev/teste-headcount.html   (?tema=escuro · ?aba=Comercial|Logística|Backoffice · ?sobre=1 · ?filtros=1 · ?centros=1 · ?filial=RR · ?agrupar=Distribuidora · ?rotulos=1 (desliga os rótulos, que já vêm ligados) · ?macro=Promotores · ?fora=<cargo> · ?terc=1 · ?busca=promotor)
// A consolidação abaixo repete a regra da view vw_headcount_linhas (sem terceirizados lançados).
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import '@/index.css'
import { SessaoContext } from '@/auth/sessao-context'
import { TooltipProvider } from '@/components/ui/tooltip'
import PainelPage from '@/features/headcount/PainelPage'
import { padronizarDepartamento, type Linha } from '@/features/headcount/regras'
import base from './headcount-base-inicial.json'

const params = new URLSearchParams(location.search)
if (params.get('tema') === 'escuro') document.documentElement.classList.add('dark')

type Base = { fonte: string; tipo: string; uf: string; ufs?: string[]; resumo?: Record<string, number>; arquivo: string; competencias: string[]; avisos: string[]; padronizacoes: [string, string][]; rows: Linha[] }
const bases = base as unknown as Base[]
const cobertas = new Set(bases.filter((b) => b.tipo === 'sistema').flatMap((b) => (b.ufs ?? []).map((u) => `${b.competencias[0]}|${u}`)))
const linhas: Linha[] = bases
  // Logística: planilha do Depósito até Dez/25; sistema de Jan/26 em diante (planilha enquanto o mês não tiver exportação)
  .flatMap((b) =>
    b.tipo === 'sistema'
      ? b.rows.filter((r) => r[2] !== 'Logística' || r[0] >= '2026-01')
      : b.rows.filter((r) => r[7] === 'Terceirizado' || (r[2] === 'Logística' && r[0] < '2026-01') || !cobertas.has(`${r[0]}|${r[1]}`)),
  )
  // mesmo tratamento do api.ts
  .map((r) => [r[0], r[1], r[2], r[3], r[4], r[5] ? padronizarDepartamento(r[5]) : null, r[6], r[7], r[8]] as Linha)

const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
qc.setQueryData(['perfil', 'u1'], { papel: 'admin', nome: 'Nic' })
qc.setQueryData(['headcount', 'linhas'], linhas)
qc.setQueryData(
  ['headcount', 'fontes'],
  bases.map((b) => ({ fonte: b.fonte, tipo: b.tipo, uf: b.uf, ufs: b.ufs ?? null, resumo: b.resumo ?? null, arquivo: b.arquivo, competencias: [...new Set(b.rows.map((r) => r[0]))].sort(), avisos: b.avisos, padronizacoes: b.padronizacoes, importadoEm: null })),
)
qc.setQueryData(['headcount', 'terceirizados-meses'], [])

const sessao = { user: { id: 'u1', email: 'nic@demo' } } as unknown as Session

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <SessaoContext.Provider value={{ sessao, carregando: false }}>
      <TooltipProvider>
        <MemoryRouter>
          <div className="flex min-h-svh flex-col bg-background">
            <PainelPage />
          </div>
        </MemoryRouter>
      </TooltipProvider>
    </SessaoContext.Provider>
  </QueryClientProvider>,
)

const aba = params.get('aba')
setTimeout(() => {
  if (aba) [...document.querySelectorAll('[role=tab]')].find((b) => b.textContent === aba)?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  if (params.get('filtros')) [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Mais filtros'))?.click()
  if (params.get('centros')) setTimeout(() => { [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label')?.startsWith('Centro de custo'))?.click(); setTimeout(() => [...document.querySelectorAll('[role=menu] *')].find((e) => e.textContent === 'Elo Norte')?.dispatchEvent(new MouseEvent('click', { bubbles: true })), 400) }, 400)
  const filial = params.get('filial')
  if (filial) setTimeout(() => [...document.querySelectorAll('[aria-label^="Filial"] button')].find((b) => b.textContent === filial)?.click(), 300)
  const agrupar = params.get('agrupar')
  setTimeout(() => {
    if (agrupar) [...document.querySelectorAll('[role=tab]')].find((b) => b.textContent === agrupar)?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    if (params.get('rotulos')) document.querySelector<HTMLButtonElement>('[role=switch]')?.click()
  }, 600)
  const macro = params.get('macro')
  if (macro) setTimeout(() => { document.querySelector<HTMLButtonElement>('button[aria-label="Cargo"]')?.click(); setTimeout(() => { [...document.querySelectorAll('[role=menuitemcheckbox]')].find((e) => e.textContent === macro)?.dispatchEvent(new MouseEvent('click', { bubbles: true })); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) }, 400) }, 500)
  const tirar = params.get('fora')
  if (tirar) setTimeout(() => [...document.querySelectorAll('button.hc-nome-cargo')].find((b) => b.textContent === tirar)?.click(), 1800)
  // ?voltar=1: clica de novo no mesmo cargo (deve voltar a contar)
  if (tirar && params.get('voltar')) setTimeout(() => [...document.querySelectorAll('button.hc-nome-cargo')].find((b) => b.textContent === tirar)?.click(), 2800)
  if (params.get('terc')) setTimeout(() => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Terceirizados')?.click(), 900)
  // ?area=Logística: escolhe a área no Comparativo YoY
  const areaYoY = params.get('area')
  if (areaYoY) setTimeout(() => [...document.querySelectorAll('[aria-label="Área"] button')].find((b) => b.textContent === areaYoY)?.click(), 300)
  // ?busca=promotor: digita na busca de cargo do Comparativo YoY
  const busca = params.get('busca')
  if (busca)
    setTimeout(() => {
      const i = document.querySelector<HTMLInputElement>('input[aria-label="Buscar cargo"]')
      if (!i) return
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(i, busca)
      i.dispatchEvent(new Event('input', { bubbles: true }))
    }, 1200)
  if (params.get('sobre')) document.querySelector<HTMLButtonElement>('[data-slot=collapsible-trigger]')?.click()
}, 600)
