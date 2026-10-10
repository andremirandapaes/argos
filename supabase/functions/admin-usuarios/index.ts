// ARGOS — Edge Function "admin-usuarios" (Supabase, Deno)
// -----------------------------------------------------------------------------
// Administração de usuários feita de dentro do ARGOS. Roda no Supabase com a chave
// service_role (que NUNCA vai para o navegador) e só atende quem tem papel "admin".
//
// Ações (POST, corpo JSON):
//   { acao: "listar" }                                   → usuários do Auth + perfil (papel)
//   { acao: "criar", email, nome, papel }                → cria o login com senha provisória
//   { acao: "redefinir_senha", user_id }                 → gera nova senha provisória
//
// Em "criar" e "redefinir_senha" o usuário fica com user_metadata.trocar_senha = true:
// no próximo login o ARGOS obriga a troca antes de liberar o sistema.
//
// Publicação (uma vez): Supabase → Edge Functions → Deploy a new function → Via Editor,
// nome "admin-usuarios", colar este arquivo e Deploy. As variáveis SUPABASE_URL,
// SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente das Edge Functions.
// -----------------------------------------------------------------------------

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PAPEIS = ['admin', 'editor', 'leitor']

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

/** Senha provisória legível (sem caracteres que se confundem): ex. "Argos-K7QM-4XPA". */
function senhaProvisoria() {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const c = Array.from(bytes, (b) => alfabeto[b % alfabeto.length])
  // garante ao menos um número (regra "letras e números" do Auth)
  if (!c.some((x) => /\d/.test(x))) c[bytes[0] % c.length] = String(2 + (bytes[1] % 8))
  return `Argos-${c.slice(0, 4).join('')}-${c.slice(4).join('')}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta({ erro: 'Método não permitido.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const servico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 1. quem está chamando? (o token do usuário logado vem no cabeçalho Authorization)
  const autorizacao = req.headers.get('Authorization') ?? ''
  const comoUsuario = createClient(url, anon, { global: { headers: { Authorization: autorizacao } } })
  const { data: eu } = await comoUsuario.auth.getUser()
  if (!eu?.user) return resposta({ erro: 'Sessão inválida. Entre de novo no ARGOS.' }, 401)
  const { data: papel } = await comoUsuario.rpc('papel_atual')
  if (papel !== 'admin') return resposta({ erro: 'Só administradores podem gerenciar usuários.' }, 403)

  // 2. cliente com a chave service_role (só aqui dentro)
  const admin = createClient(url, servico, { auth: { autoRefreshToken: false, persistSession: false } })

  let corpo: Record<string, unknown>
  try {
    corpo = await req.json()
  } catch {
    return resposta({ erro: 'Corpo da requisição inválido.' }, 400)
  }

  try {
    switch (corpo.acao) {
      case 'listar': {
        const { data: lista, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        if (error) throw error
        const { data: perfis, error: erroPerfis } = await admin.from('perfis').select('user_id, nome, papel, criado_em')
        if (erroPerfis) throw erroPerfis
        const porId = new Map(perfis.map((p) => [p.user_id, p]))
        const usuarios = lista.users.map((u) => {
          const p = porId.get(u.id)
          return {
            id: u.id,
            email: u.email ?? null,
            nome: p?.nome ?? (u.user_metadata?.nome as string | undefined) ?? null,
            papel: p?.papel ?? null, // null = sem perfil (sem acesso ao ARGOS)
            criado_em: u.created_at,
            ultimo_acesso: u.last_sign_in_at ?? null,
            trocar_senha: u.user_metadata?.trocar_senha === true,
          }
        })
        return resposta({ usuarios })
      }

      case 'criar': {
        const email = String(corpo.email ?? '').trim().toLowerCase()
        const nome = String(corpo.nome ?? '').trim()
        const papelNovo = String(corpo.papel ?? '')
        if (!/^\S+@\S+\.\S+$/.test(email)) return resposta({ erro: 'E-mail inválido.' }, 400)
        if (!nome) return resposta({ erro: 'Informe o nome.' }, 400)
        if (!PAPEIS.includes(papelNovo)) return resposta({ erro: 'Papel inválido.' }, 400)

        const senha = senhaProvisoria()
        const { data: criado, error } = await admin.auth.admin.createUser({
          email,
          password: senha,
          email_confirm: true, // sem e-mail de confirmação: o admin entrega a senha provisória
          user_metadata: { nome, trocar_senha: true },
        })
        if (error) {
          const jaExiste = /already|registered|exists/i.test(error.message)
          return resposta({ erro: jaExiste ? 'Já existe um usuário com esse e-mail.' : error.message }, 400)
        }
        const { error: erroPerfil } = await admin
          .from('perfis')
          .upsert({ user_id: criado.user.id, nome, papel: papelNovo })
        if (erroPerfil) throw erroPerfil
        return resposta({ id: criado.user.id, email, senha })
      }

      case 'redefinir_senha': {
        const id = String(corpo.user_id ?? '')
        const { data: alvo, error: erroAlvo } = await admin.auth.admin.getUserById(id)
        if (erroAlvo || !alvo?.user) return resposta({ erro: 'Usuário não encontrado.' }, 404)
        const senha = senhaProvisoria()
        const { error } = await admin.auth.admin.updateUserById(id, {
          password: senha,
          user_metadata: { ...alvo.user.user_metadata, trocar_senha: true },
        })
        if (error) throw error
        return resposta({ id, email: alvo.user.email, senha })
      }

      default:
        return resposta({ erro: 'Ação desconhecida.' }, 400)
    }
  } catch (e) {
    return resposta({ erro: (e as Error).message ?? 'Erro inesperado.' }, 500)
  }
})
