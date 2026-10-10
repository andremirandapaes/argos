import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSessao } from '@/auth/sessao-context'
import { ROTA_INICIAL } from '@/modulos'
import { ArgosMarca } from '@/components/ArgosMarca'
import { TemaToggle } from '@/components/TemaToggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function traduzirErro(mensagem: string) {
  if (/invalid login credentials/i.test(mensagem)) return 'E-mail ou senha inválidos.'
  if (/email not confirmed/i.test(mensagem)) return 'E-mail ainda não confirmado.'
  if (/fetch/i.test(mensagem)) return 'Não foi possível conectar ao servidor.'
  return mensagem
}

export function LoginPage() {
  const { sessao } = useSessao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (sessao) return <Navigate to={ROTA_INICIAL} replace />

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setEnviando(false)
    if (error) setErro(traduzirErro(error.message))
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      {/* painel da marca */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <ArgosMarca />
        <div className="relative z-10 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white">
            Relatórios gerenciais,
            <br />
            sem planilha.
          </h1>
          <p className="mt-4 text-sm leading-relaxed opacity-70">
            Bases do Winthor versionadas, histórico imutável e os números de sempre calculados no mesmo lugar.
          </p>
        </div>
        <p className="text-xs opacity-40">NIC · Grupo Medeiros</p>
        {/* grade decorativa */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at 70% 60%, black 20%, transparent 70%)',
          }}
        />
      </aside>

      {/* formulário */}
      <main className="relative flex items-center justify-center p-6">
        <div className="absolute top-4 right-4">
          <TemaToggle />
        </div>
        <div className="w-full max-w-sm">
          <ArgosMarca className="mb-10 text-foreground lg:hidden" />
          <h2 className="text-xl font-semibold tracking-tight">Entrar</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use seu e-mail e senha do ARGOS.</p>

          <form onSubmit={entrar} className="mt-8 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="h-10"
              />
            </div>

            {erro && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {erro}
              </p>
            )}

            <Button type="submit" disabled={enviando} className="mt-2 h-10">
              {enviando && <Loader2 className="animate-spin" />}
              Entrar
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
