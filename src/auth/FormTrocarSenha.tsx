import { useState, type FormEvent } from 'react'
import { Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

export const SENHA_MINIMA = 8

/** Problemas da senha nova (vazio = ok). */
function validar(senha: string) {
  const problemas: string[] = []
  if (senha.length < SENHA_MINIMA) problemas.push(`pelo menos ${SENHA_MINIMA} caracteres`)
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) problemas.push('letras e números')
  if (/^argos-/i.test(senha)) problemas.push('diferente da senha provisória')
  return problemas
}

/** Mensagens do Supabase Auth em português. */
function traduzirErroSenha(mensagem: string) {
  if (/different from the old/i.test(mensagem)) return 'A senha nova precisa ser diferente da atual.'
  if (/should contain at least one character/i.test(mensagem)) {
    return 'O Supabase recusou a senha pela regra de caracteres configurada no projeto. Peça ao administrador para ajustar a regra para "letras e números".'
  }
  if (/at least \d+ characters/i.test(mensagem)) return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`
  if (/weak|pwned|leaked/i.test(mensagem)) return 'Essa senha é fraca ou já apareceu em vazamentos. Escolha outra.'
  return mensagem
}

/**
 * Troca de senha do usuário logado. Grava a senha nova e tira a marca "trocar_senha"
 * (que o admin põe ao criar o usuário ou redefinir a senha).
 */
export function FormTrocarSenha({ onConcluido, textoBotao = 'Salvar senha' }: { onConcluido?: () => void; textoBotao?: string }) {
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const problemas = senha ? validar(senha) : []
  const diferentes = confirmacao.length > 0 && confirmacao !== senha
  const podeSalvar = senha.length > 0 && problemas.length === 0 && confirmacao === senha && !salvando

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!podeSalvar) return
    setErro(null)
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha, data: { trocar_senha: false } })
    setSalvando(false)
    if (error) {
      setErro(traduzirErroSenha(error.message))
      return
    }
    // a sessão é atualizada pelo onAuthStateChange (USER_UPDATED)
    onConcluido?.()
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <FieldGroup>
        <Field data-invalid={problemas.length > 0 || undefined}>
          <FieldLabel htmlFor="senha-nova">Nova senha</FieldLabel>
          <Input
            id="senha-nova"
            type="password"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            aria-invalid={problemas.length > 0 || undefined}
            autoFocus
            className="h-10"
          />
          {problemas.length > 0 ? (
            <FieldError>Use {problemas.join(', ')}.</FieldError>
          ) : (
            <FieldDescription>Mínimo de {SENHA_MINIMA} caracteres, com letras e números.</FieldDescription>
          )}
        </Field>
        <Field data-invalid={diferentes || undefined}>
          <FieldLabel htmlFor="senha-confirmacao">Repita a nova senha</FieldLabel>
          <Input
            id="senha-confirmacao"
            type="password"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            aria-invalid={diferentes || undefined}
            className="h-10"
          />
          {diferentes && <FieldError>As senhas não são iguais.</FieldError>}
        </Field>
      </FieldGroup>

      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={!podeSalvar} className="h-10">
        {salvando ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
        {salvando ? 'Salvando…' : textoBotao}
      </Button>
    </form>
  )
}
