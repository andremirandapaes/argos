// Vitrine de desenvolvimento da tela Usuários e do primeiro acesso (sem banco).
// Abrir em http://localhost:5173/dev/teste-usuarios.html
//   ?primeiro=1  tela de troca obrigatória de senha   ·  ?senha=1  diálogo da senha provisória   ·  ?tema=escuro
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import '@/index.css'
import { SessaoContext } from '@/auth/sessao-context'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import UsuariosPage from '@/features/admin/UsuariosPage'
import { DialogSenhaProvisoria } from '@/features/admin/DialogSenhaProvisoria'
import { PrimeiroAcessoPage } from '@/pages/PrimeiroAcessoPage'
import type { Usuario } from '@/features/admin/api-usuarios'

const params = new URLSearchParams(location.search)
if (params.get('tema') === 'escuro') document.documentElement.classList.add('dark')

const usuarios: Usuario[] = [
  { id: 'u1', email: 'nic@grupomedeiros.com.br', nome: 'Nic', papel: 'admin', criado_em: '2026-09-27T10:00:00Z', ultimo_acesso: '2026-10-04T08:12:00Z', trocar_senha: false },
  { id: 'u2', email: 'ana.souza@grupomedeiros.com.br', nome: 'Ana Souza', papel: 'editor', criado_em: '2026-10-01T14:30:00Z', ultimo_acesso: '2026-10-03T17:45:00Z', trocar_senha: false },
  { id: 'u3', email: 'carlos.lima@grupomedeiros.com.br', nome: 'Carlos Lima', papel: 'leitor', criado_em: '2026-10-04T09:02:00Z', ultimo_acesso: null, trocar_senha: true },
  { id: 'u4', email: 'ex.colaborador@grupomedeiros.com.br', nome: 'Ex Colaborador', papel: null, criado_em: '2026-09-28T11:00:00Z', ultimo_acesso: '2026-09-29T10:00:00Z', trocar_senha: false },
]

const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
qc.setQueryData(['perfil', 'u1'], { papel: 'admin', nome: 'Nic' })
qc.setQueryData(['usuarios'], usuarios)

const primeiro = !!params.get('primeiro')
const sessao = {
  user: { id: 'u1', email: primeiro ? 'carlos.lima@grupomedeiros.com.br' : 'nic@grupomedeiros.com.br', user_metadata: { nome: primeiro ? 'Carlos Lima' : 'Nic' } },
} as unknown as Session

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <SessaoContext.Provider value={{ sessao, carregando: false }}>
      <TooltipProvider>
        <MemoryRouter>
          <div className="flex min-h-svh flex-col bg-background">
            {primeiro ? <PrimeiroAcessoPage /> : <UsuariosPage />}
          </div>
          {params.get('senha') && (
            <DialogSenhaProvisoria
              dados={{ id: 'u3', email: 'carlos.lima@grupomedeiros.com.br', senha: 'Argos-K7QP-M3XA' }}
              titulo="Usuário criado"
              onFechar={() => {}}
            />
          )}
          <Toaster />
        </MemoryRouter>
      </TooltipProvider>
    </SessaoContext.Provider>
  </QueryClientProvider>,
)
