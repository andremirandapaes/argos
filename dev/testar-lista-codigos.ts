// Teste de desenvolvimento da importação da lista de códigos (leitura + casamento).
// Rodar:  npx tsx dev/testar-lista-codigos.ts
import { casarLista, lerLista } from '../src/features/dun-pro/departamentos/lista-codigos'

let falhas = 0
const confere = (nome: string, ok: boolean, detalhe?: unknown) => {
  if (!ok) falhas++
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${nome}${!ok ? ' -> ' + JSON.stringify(detalhe) : ''}`)
}

// lista no formato do seed (nome;codigo), com cabeçalho, uma linha vazia e acentos/caixa diferentes
const csv = ['nome;codigo', 'ADM RACOES;301', 'Flora - Brisa ;302', '', 'SEARA;91', 'CCM;303', 'NAO EXISTE;304', 'KONIG;303', 'DIAGEO;999'].join('\n')
const { itens, ignoradas } = await lerLista(new File([csv], 'lista.csv'))
confere('lê 7 itens', itens.length === 7, itens)
confere('ignora o cabeçalho', ignoradas.includes(1), ignoradas)
confere('colunas na ordem nome;codigo', itens[0].codigo === 301 && itens[0].nome === 'ADM RACOES', itens[0])

// ordem invertida (codigo;nome) também funciona
const inv = await lerLista(new File(['codigo;nome\n310;HAVAIANAS'], 'inv.csv'))
confere('colunas na ordem codigo;nome', inv.itens[0]?.codigo === 310 && inv.itens[0]?.nome === 'HAVAIANAS', inv.itens)

const deptos = [
  { id: 'a', nome: 'ADM RACOES', codigo_winthor: null },
  { id: 'b', nome: 'FLORA - BRISA', codigo_winthor: null },
  { id: 'c', nome: 'SEARA', codigo_winthor: null },
  { id: 'd', nome: 'SOFTYS - PROFESSIONAL', codigo_winthor: 91 },
  { id: 'e', nome: 'CCM', codigo_winthor: null },
  { id: 'f', nome: 'KONIG', codigo_winthor: null },
  { id: 'g', nome: 'DIAGEO', codigo_winthor: 166 },
]
const r = casarLista(itens, deptos)
const sit = (nome: string) => r.find((x) => x.nome.toUpperCase().trim() === nome)?.situacao
confere('ADM RACOES → preencher', sit('ADM RACOES') === 'preencher', r)
confere('Flora - Brisa (caixa/espaço) → preencher', sit('FLORA - BRISA') === 'preencher', r)
confere('SEARA com código 91 (já é da SOFTYS) → codigo-em-uso', sit('SEARA') === 'codigo-em-uso', r)
confere('CCM 303 → preencher', sit('CCM') === 'preencher', r)
confere('KONIG 303 (repetido na lista) → codigo-em-uso', sit('KONIG') === 'codigo-em-uso', r)
confere('NAO EXISTE → nao-encontrado', sit('NAO EXISTE') === 'nao-encontrado', r)
confere('DIAGEO já tem 166 → codigo-diferente (mantém)', sit('DIAGEO') === 'codigo-diferente', r)

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.')
process.exit(falhas ? 1 : 0)
