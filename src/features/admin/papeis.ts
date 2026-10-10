import type { Papel } from '@/types/database'

export const ROTULO_PAPEL: Record<Papel, string> = { admin: 'Administrador', editor: 'Editor', leitor: 'Leitor' }

export const DESCRICAO_PAPEL: Record<Papel, string> = {
  admin: 'Pode tudo, inclusive gerenciar usuários.',
  editor: 'Envia bases, lança despesas, troca versões e edita departamentos.',
  leitor: 'Só visualiza os relatórios.',
}
