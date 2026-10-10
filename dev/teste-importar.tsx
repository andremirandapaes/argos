// Vitrine de desenvolvimento da tela Importar Faturamento (sem login: consultas ao banco voltam vazias).
// Abrir em http://localhost:5173/dev/teste-importar.html
//   ?demo=valido  → carrega um arquivo sintético válido
//   ?demo=erros   → carrega um arquivo sintético com erros
//   ?tema=escuro  → tema escuro
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import '@/index.css'
import ImportarPage from '@/features/dun-pro/importacao/ImportarPage'

const params = new URLSearchParams(location.search)
if (params.get('tema') === 'escuro') document.documentElement.classList.add('dark')

const linha = (cod: unknown, nome: unknown, fat: unknown, part: unknown, marg: unknown) =>
  [cod, nome, 'x', 'x', 'x', fat, part, marg, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function arquivoDemo(tipo: string) {
  const linhas =
    tipo === 'erros'
      ? [linha(91, 'SOFTYS - PROFESSIONAL', 513175.86, 60, 25.2), linha(12, '', 'abc', 25, 20), linha(91, 'REPETIDO', 100, 15, 10)]
      : [
          linha(91, 'SOFTYS - PROFESSIONAL', 513175.86, 45, 25.219531),
          linha(12, 'KIMBERLY CLARK', 200000, 25.5, 20),
          linha(45, 'SANTHER', 142000, 14.5, 10),
          linha(30, 'BOMBRIL', 164636.23, 15, 12.23),
        ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), 'Plan1')
  return new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], `demo_${tipo}.xlsx`)
}

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })

// ?vigente=igual|diferente → simula que Ago/26 já tem uma v1 (igual ou diferente do arquivo demo válido)
const vigenteDemo = params.get('vigente')
if (vigenteDemo) {
  const igual = vigenteDemo === 'igual'
  queryClient.setQueryData(['distribuidora', 'dun-professional'], { id: 'dist-demo', nome: 'DUN PROFESSIONAL' })
  queryClient.setQueryData(['vw_gerencial_mensal_total', 'dist-demo'], [])
  queryClient.setQueryData(
    ['cargas_faturamento', 'mes', 'dist-demo', '2026-08-01'],
    [
      {
        id: 'carga-v1',
        versao: 1,
        vigente: true,
        total_faturamento: igual ? 1019812.09 : 1000000,
        total_margem_valor: igual ? 203755.5595 : 210000,
        qtd_linhas: 4,
        enviado_em: '2026-09-01T10:00:00Z',
      },
    ],
  )
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>
      <div className="min-h-svh bg-background">
        <ImportarPage />
      </div>
    </MemoryRouter>
  </QueryClientProvider>,
)

// simula a escolha do arquivo: dispara o evento de change no input de arquivo
const demo = params.get('demo')
if (demo) {
  setTimeout(() => {
    const input = document.querySelector<HTMLInputElement>('input[type=file]')
    if (!input) return
    const dt = new DataTransfer()
    dt.items.add(arquivoDemo(demo))
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, 800)

  // ?confirmar=1 → preenche a observação e abre a janela de confirmação
  if (params.get('confirmar')) {
    setTimeout(() => {
      const obs = document.querySelector<HTMLTextAreaElement>('#observacao')
      if (obs) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
        setter.call(obs, 'Teste de reenvio')
        obs.dispatchEvent(new Event('input', { bubbles: true }))
      }
      setTimeout(() => {
        const botao = [...document.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Registrar v'))
        botao?.click()
      }, 300)
    }, 2000)
  }
}
