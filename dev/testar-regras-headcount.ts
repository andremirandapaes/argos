// Confere as regras portadas (src/features/headcount/regras.ts) contra as funções originais do artefato
// "Headcount de Colaboradores", rodando as duas sobre a mesma base e várias combinações de filtro.
// Uso: npx tsx dev/testar-regras-headcount.ts dev/referencia/headcount-regras-originais.cjs
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import * as R from '../src/features/headcount/regras'
import type { FiltroVinculo, Filtros, Linha } from '../src/features/headcount/regras'

const caminho = process.argv[2]
if (!caminho) throw new Error('informe o caminho do hc-original.cjs')
const O = createRequire(import.meta.url)(caminho)

const base = JSON.parse(readFileSync(new URL('./headcount-base-inicial.json', import.meta.url), 'utf8'))
const fontes = Object.fromEntries(base.map((f: { fonte: string }) => [f.fonte, f]))
const terc = { '2026-08': { itens: [{ uf: 'AM', area: 'Comercial', dist: 'Dunorte', centro: 'Merchan', q: 7 }, { uf: 'RR', area: 'Logística', q: 10 }] } }

let falhas = 0
let casos = 0
const igual = (rotulo: string, a: unknown, b: unknown) => {
  casos++
  // o ARGOS escreve o mês com inicial maiúscula (Ago/26); o artefato, minúscula (ago/26)
  const ja = JSON.stringify(a).toLowerCase()
  const jb = JSON.stringify(b).toLowerCase()
  if (ja !== jb) {
    falhas++
    if (falhas <= 8) console.log(`DIFERENTE: ${rotulo}\n  artefato: ${ja.slice(0, 300)}\n  ARGOS:    ${jb.slice(0, 300)}`)
  }
}
// árvore do artefato tem campos internos (valores, primeiro, filhos Map); compara só o que aparece na tela
// no ARGOS as distribuidoras seguem a ordem oficial do grupo (o artefato ordenava por headcount):
// compara os irmãos em ordem de id, para conferir só os valores
const limparNo = (n: any): any => ({
  id: n.id,
  label: n.label,
  prof: n.prof,
  celulas: n.celulas,
  filhos: n.filhos.map(limparNo).sort((a: any, b: any) => a.id.localeCompare(b.id)),
})

for (const comTerc of [false, true]) {
  const linhas: Linha[] = O.DT(fontes, comTerc ? terc : {})
  const comps = R.competencias(linhas)
  igual('competências', O.ml(linhas), comps)
  const ultimo = comps.at(-1)!
  const filtros: Filtros[] = [
    R.FILTROS_VAZIOS,
    { ...R.FILTROS_VAZIOS, ufs: ['RR'] },
    { ...R.FILTROS_VAZIOS, areas: ['Comercial'] },
    { ...R.FILTROS_VAZIOS, areas: ['Logística'], ufs: ['AM'] },
    { ...R.FILTROS_VAZIOS, dists: ['Dunorte', 'Meta Norte'] },
    { ...R.FILTROS_VAZIOS, centros: ['Merchan'] },
    { ...R.FILTROS_VAZIOS, cargos: ['Vendedor externo', 'Agente de portaria'] },
    { ...R.FILTROS_VAZIOS, areas: ['Backoffice'] },
  ]
  const periodos: [string, string][] = [[comps[0], ultimo], ['2026-01', '2026-08'], ['2025-03', '2025-11']]
  for (const f of filtros) {
    const m = R.filtrar(linhas, f)
    igual(`filtrar ${JSON.stringify(f)}`, O.Bf(linhas, f), m)
    for (const v of ['Ambos', 'CLT', 'Terceirizado'] as FiltroVinculo[]) {
      const cobO = O.L0(m, v, ultimo)
      const cobA = R.cobertura(m, v, ultimo)
      igual('segmentos', cobO.segmentos, cobA.segmentos)
      for (const c of comps) {
        igual(`faltas ${c} ${v}`, cobO.faltas(c), cobA.faltas(c))
        for (const s of cobA.segmentos) igual(`status ${s} ${c}`, cobO.status(s, c), cobA.status(s, c))
      }
      for (const [de, ate] of periodos) {
        const meses = R.intervaloMeses(de, ate)
        igual('meses', O.Cl(de, ate), meses)
        igual(`serieTotal ${v} ${de}`, O.Hf(m, v, meses, ultimo), R.serieTotal(m, v, meses, ultimo))
        igual(`árvore ${v} ${de} ${JSON.stringify(f)}`, O.LT(m, v, meses, cobO).map(limparNo), R.arvoreDetalhamento(m, v, meses, cobA).map(limparNo))
        const at = O.AT(m, v, meses, ultimo)
        // o artefato deixa um campo interno (ult) nas linhas; não aparece na tela
        at.linhas.forEach((l: any) => delete l.ult)
        igual(`cargos ${v} ${de} ${JSON.stringify(f)}`, at, R.tabelaCargos(m, v, meses, ultimo))
        const porArea = O.I0(m, v, (l: Linha) => l[2])
        const porAreaA = R.somarPorMes(m, v, (l) => l[2])
        igual('somarPorMes', [...porArea].map(([k, mm]: any) => [k, [...mm]]), [...porAreaA].map(([k, mm]) => [k, [...mm]]))
      }
    }
    for (const modo of ['area', 'estado', 'area-estado'] as const) igual(`composição ${modo}`, O.RT(m, ultimo, modo), R.composicao(m, ultimo, modo))
  }
  igual('lacunas', O.TT(linhas, ultimo), R.lacunas(linhas, ultimo))
  igual('sem vínculo', O.PT(linhas), R.semSeparacaoVinculo(linhas))
  for (const c of comps) {
    igual('rótulo', O.Je(c), R.rotuloMes(c))
    igual('mês anterior', O.ET(c), R.mesAnterior(c))
  }
  // expandir / achatar
  const arvO = O.LT(linhas, 'Ambos', comps, O.L0(linhas, 'Ambos', ultimo))
  const arvA = R.arvoreDetalhamento(linhas, 'Ambos', comps, R.cobertura(linhas, 'Ambos', ultimo))
  // ordem das distribuidoras difere (diretriz interna): compara os conjuntos
  igual('expansíveis', [...O.L1(arvO, 1)].sort(), [...R.idsExpansiveis(arvA, 1)].sort())
  const abertos = new Set(O.L1(arvO) as string[])
  igual(
    'achatar',
    O.IT(arvO, abertos).map((n: any) => [n.id, n.temFilhos, n.aberto]).sort(),
    R.achatarArvore(arvA, abertos).map((n) => [n.id, n.temFilhos, n.aberto]).sort(),
  )
}
console.log(`${casos} comparações, ${falhas} diferença(s)`)
console.log(falhas ? 'HÁ DIFERENÇAS' : 'Tudo igual ao artefato.')
