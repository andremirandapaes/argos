import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, BarChart3, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, UsersRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSessao } from '@/auth/sessao-context'
import { ROTA_INICIAL } from '@/modulos'
import simbolo from '@/assets/marca/argos-simbolo.svg'
import { ArgosMarca } from '@/components/ArgosMarca'
import { TemaToggle } from '@/components/TemaToggle'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function traduzirErro(mensagem: string) {
  if (/invalid login credentials/i.test(mensagem)) return 'E-mail ou senha inválidos.'
  if (/email not confirmed/i.test(mensagem)) return 'E-mail ainda não confirmado.'
  if (/fetch/i.test(mensagem)) return 'Não foi possível conectar ao servidor.'
  return mensagem
}

const MODULOS_VITRINE = [
  { icone: BarChart3, titulo: 'Duno Pro', texto: 'Gerencial, despesas e evolução mês a mês' },
  { icone: UsersRound, titulo: 'HeadCount', texto: 'Quadro de pessoas por área, filial e cargo' },
]

/** Campo com ícone à esquerda (e, opcionalmente, um botão à direita), no padrão visual do login. */
function Campo({
  id,
  rotulo,
  icone: Icone,
  direita,
  ...props
}: React.ComponentProps<'input'> & { id: string; rotulo: string; icone: typeof Mail; direita?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-[13px] font-medium text-foreground/85">
        {rotulo}
      </Label>
      <div className="group relative">
        <Icone
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
        />
        <input
          id={id}
          {...props}
          className={cn(
            'h-12 w-full rounded-xl border border-input/60 bg-background pr-11 pl-10 text-[15px] shadow-xs outline-none transition-[border-color,box-shadow]',
            'placeholder:text-muted-foreground/60 hover:border-input focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15',
          )}
        />
        {direita && <div className="absolute top-1/2 right-2 -translate-y-1/2">{direita}</div>}
      </div>
    </div>
  )
}

export function LoginPage() {
  const { sessao } = useSessao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
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

  const verCapsLock = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState?.('CapsLock') ?? false)

  return (
    <div className="grid min-h-svh bg-background md:grid-cols-[1.05fr_1fr]">
      {/* ---------- painel da marca ---------- */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-marca-noite p-10 text-marca-creme md:flex lg:p-14">
        {/* fundo: degradê + brilhos que se movem devagar + grade */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_100%_100%,var(--marca-marinho)_0%,transparent_60%)]" />
        <div aria-hidden className="login-aurora pointer-events-none absolute -top-32 -left-24 size-[34rem] rounded-full bg-marca-turquesa/25 blur-[110px]" />
        <div aria-hidden className="login-aurora login-aurora-2 pointer-events-none absolute -right-20 -bottom-40 size-[30rem] rounded-full bg-marca-ambar/20 blur-[120px]" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse at 60% 45%, black 15%, transparent 70%)',
          }}
        />

        <ArgosMarca className="relative z-10" />

        <div className="relative z-10 flex flex-col gap-10">
          {/* símbolo com halo */}
          <div className="relative size-24 [@media(max-height:820px)]:hidden">
            <div aria-hidden className="absolute inset-0 rounded-full bg-marca-turquesa/30 blur-2xl" />
            <img src={simbolo} alt="" aria-hidden draggable={false} className="relative size-24 drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]" />
          </div>

          <div className="max-w-md">
            <p className="font-marca text-[2.6rem] leading-[1.08] text-marca-creme lg:text-5xl">
              Gestão clara,
              <br />
              <span className="bg-gradient-to-r from-marca-turquesa to-marca-ambar bg-clip-text text-transparent">sem planilha.</span>
            </p>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-marca-creme/65">
              Os números do grupo num só lugar: bases versionadas, regras do negócio no banco e relatórios sempre atualizados.
            </p>
          </div>

          <ul className="grid max-w-md gap-3">
            {MODULOS_VITRINE.map((m) => (
              <li
                key={m.titulo}
                className="flex items-center gap-3.5 rounded-2xl border border-marca-creme/10 bg-marca-creme/[0.04] px-4 py-3 backdrop-blur-sm"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-marca-turquesa/15 text-marca-turquesa">
                  <m.icone className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-marca-creme">{m.titulo}</span>
                  <span className="block truncate text-[13px] text-marca-creme/55">{m.texto}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-marca-creme/40">NIC · Núcleo de Inteligência Comercial · Grupo Norte Distribuição</p>
      </aside>

      {/* ---------- formulário ---------- */}
      <main className="relative flex flex-col">
        {/* faixa da marca no celular */}
        <div className="relative overflow-hidden bg-marca-noite px-6 pt-8 pb-10 text-marca-creme md:hidden">
          <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-marca-turquesa/25 blur-3xl" />
          <ArgosMarca className="relative" />
          <p className="relative mt-6 font-marca text-3xl leading-tight">
            Gestão clara, <span className="text-marca-turquesa">sem planilha.</span>
          </p>
        </div>

        <div className="absolute top-4 right-4 z-10 md:top-6 md:right-6">
          {/* no celular fica sobre a faixa escura da marca: ícone claro */}
          <TemaToggle className="text-marca-creme hover:bg-marca-creme/10 hover:text-marca-creme md:text-foreground md:hover:bg-accent md:hover:text-accent-foreground" />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10 md:px-10">
          <div className="w-full max-w-[400px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              <span className="size-1.5 rounded-full bg-primary" />
              Acesso restrito
            </span>
            <h1 className="mt-4 text-[2rem]">Bem-vindo de volta</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">Entre com o seu e-mail e senha do Argos.</p>

            <form onSubmit={entrar} className="mt-9 flex flex-col gap-5">
              <Campo
                id="email"
                rotulo="E-mail"
                icone={Mail}
                type="email"
                autoComplete="email"
                autoFocus
                required
                placeholder="voce@empresa.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="flex flex-col gap-2">
                <Campo
                  id="senha"
                  rotulo="Senha"
                  icone={Lock}
                  type={verSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  onKeyDown={verCapsLock}
                  onKeyUp={verCapsLock}
                  onBlur={() => setCapsLock(false)}
                  direita={
                    <button
                      type="button"
                      onClick={() => setVerSenha((v) => !v)}
                      aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                      title={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {verSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }
                />
                {capsLock && <p className="text-xs font-medium text-alerta-foreground">Caps Lock está ligado.</p>}
              </div>

              {erro && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.07] px-3.5 py-3 text-sm text-destructive"
                >
                  <AlertCircle className="mt-px size-4 shrink-0" />
                  {erro}
                </p>
              )}

              <Button
                type="submit"
                disabled={enviando}
                className="group mt-1 h-12 rounded-xl text-[15px] font-semibold shadow-[0_8px_24px_-8px_var(--primary)] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_12px_28px_-8px_var(--primary)] active:translate-y-0"
              >
                {enviando ? (
                  <>
                    <Loader2 className="animate-spin" /> Entrando…
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-8 flex items-start gap-2.5 rounded-xl bg-muted/50 px-4 py-3 text-[13px] text-muted-foreground">
              <ShieldCheck className="mt-px size-4 shrink-0 text-primary" />
              <span>
                Esqueceu a senha ou não tem acesso? Fale com o administrador do Argos para liberar ou redefinir.
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
