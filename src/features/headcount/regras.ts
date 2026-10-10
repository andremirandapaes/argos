import { compararDistribuidoras } from '@/lib/distribuidoras'

// Regras de exibição do HeadCount, portadas do artefato "Headcount de Colaboradores".
// A consolidação das bases (sistema × planilhas × terceirizados lançados) é feita no banco
// (vw_headcount_linhas); aqui ficam só as regras de leitura: cobertura dos meses
// ("sem dado", "parcial"), totais, árvore do detalhamento e tabela por cargo.
//
// Regra de ouro: nunca preencher com zero nem estimar. Mês em que falta alguma base
// fica sem valor (null) ou marcado como parcial.

export const AREAS = ['Comercial', 'Logística', 'Backoffice'] as const
export type Area = (typeof AREAS)[number]
export const UFS = ['AM', 'RR'] as const
export type UF = (typeof UFS)[number]
export const ROTULO_UF: Record<UF, string> = { AM: 'AM (Dunorte)', RR: 'RR (Super Giro)' }
export type Vinculo = 'CLT' | 'Terceirizado' | 'Não informado'
export type FiltroVinculo = 'Ambos' | 'CLT' | 'Terceirizado'

/** Linha consolidada: [competência "AAAA-MM", UF, área, distribuidora, centro, departamento, cargo, vínculo, quantidade]. */
export type Linha = readonly [string, UF, Area, string | null, string | null, string | null, string | null, Vinculo, number]

// palavras de ligação ficam minúsculas no meio do nome ("Adm de Compras", "Tecnologia da Informação")
const LIGACOES = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

/** Nome de departamento padronizado: cada palavra com inicial maiúscula ("Crédito/Cobrança", "Gente & Gestão"). */
export function padronizarDepartamento(nome: string) {
  return nome
    .trim()
    .split(/(\s+|\/)/)
    .map((parte, i) => {
      if (!parte.trim() || parte === '/') return parte
      const min = parte.toLocaleLowerCase('pt-BR')
      if (ACENTOS[min]) return ACENTOS[min]
      return i > 0 && LIGACOES.has(min) ? min : min.charAt(0).toLocaleUpperCase('pt-BR') + min.slice(1)
    })
    .join('')
}

// palavras que chegam sem acento de alguma base (ex.: setor da Logística na exportação do sistema)
const ACENTOS: Record<string, string> = { distribuicao: 'Distribuição' }

/** plural simples em português: Analista → Analistas, Auxiliar → Auxiliares, Aprendiz → Aprendizes */
const plural = (p: string) => (/[rz]$/i.test(p) ? p + 'es' : /l$/i.test(p) ? p.slice(0, -1) + 'is' : /[aeiou]$/i.test(p) ? p + 's' : p)

/**
 * Cargo "macro" (família, sem nível nem especialidade): "Analista de compras PL" → "Analistas",
 * "Auxiliar de depósito" → "Auxiliares". Terceirizados viram "Terceirizados"; sem cargo → null.
 */
export function cargoMacro(cargo: string | null | undefined) {
  if (!cargo) return null
  if (/^terceirizad/i.test(cargo)) return 'Terceirizados'
  if (/^cargo n[aã]o informado/i.test(cargo)) return 'Cargo não informado'
  const primeira = cargo.trim().split(/\s+/)[0].toLocaleLowerCase('pt-BR')
  if (MACROS_ESPECIAIS[primeira]) return MACROS_ESPECIAIS[primeira]
  return plural(primeira.charAt(0).toLocaleUpperCase('pt-BR') + primeira.slice(1))
}

// abreviações das bases e plurais que não seguem a regra
const MACROS_ESPECIAIS: Record<string, string> = {
  'aux.': 'Auxiliares',
  'assist.': 'Assistentes',
  'analist.': 'Analistas',
  'sup.': 'Supervisores',
  'sv.': 'Supervisores',
  sv: 'Supervisores',
  promot: 'Promotores',
  designer: 'Designers',
}

export const CARGO_TERC = 'Terceirizado (cargo não informado)'
export const ROTULO_LINHA_TERC = 'Terceirizados (INOVAR)'

/** Valor de célula: número; null = sem dado ("—"); "" = ainda não existia (vazio); parcial = total com base faltando. */
export type Celula = number | '' | null | { v: number; parcial: true }

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
/** "2026-08" → "Ago/26" (mesmo formato do resto do ARGOS) */
export const rotuloMes = (c: string) => `${MESES[Number(c.slice(5, 7)) - 1]}/${c.slice(2, 4)}`

export function mesAnterior(c: string) {
  let ano = Number(c.slice(0, 4))
  let mes = Number(c.slice(5, 7)) - 1
  if (mes === 0) {
    mes = 12
    ano--
  }
  return `${ano}-${String(mes).padStart(2, '0')}`
}

/**
 * Mês do ano anterior que ainda não "fechou": o ano anterior é preenchido mês a mês,
 * ao fechar o mesmo mês do ano corrente (ex.: com ago/26 carregado, set/25 entra junto com set/26).
 */
export const entraComAnoCorrente = (c: string, ultimo?: string) =>
  !!ultimo && c.slice(0, 4) < ultimo.slice(0, 4) && c.slice(5, 7) > ultimo.slice(5, 7)

/** Competências presentes nas linhas, em ordem. */
export const competencias = (linhas: readonly Linha[]) => [...new Set(linhas.map((l) => l[0]))].sort()

/** Meses de `de` a `ate`, inclusive. */
export function intervaloMeses(de: string, ate: string) {
  const r: string[] = []
  let ano = Number(de.slice(0, 4))
  let mes = Number(de.slice(5, 7))
  for (let i = 0; i < 240; i++) {
    const c = `${ano}-${String(mes).padStart(2, '0')}`
    if (c > ate) break
    r.push(c)
    mes++
    if (mes > 12) {
      mes = 1
      ano++
    }
  }
  return r
}

/** Meses de Jan/25 até o mês atual, do mais recente para o mais antigo (seletores de competência). */
export function mesesAteHoje(hoje = new Date()) {
  const atual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  return intervaloMeses('2025-01', atual).reverse()
}

/** Agrupa meses consecutivos em faixas legíveis: "jan/25 a mar/25, mai/25". */
export function faixasDeMeses(meses: string[]) {
  const faixas: [string, string][] = []
  for (const m of meses) {
    const ult = faixas.at(-1)
    if (ult && intervaloMeses(ult[1], m).length === 2) ult[1] = m
    else faixas.push([m, m])
  }
  return faixas.map(([a, b]) => (a === b ? rotuloMes(a) : `${rotuloMes(a)} a ${rotuloMes(b)}`))
}

export type Filtros = { ufs: string[]; areas: string[]; dists: string[]; centros: string[]; cargos: string[] }
export const FILTROS_VAZIOS: Filtros = { ufs: [], areas: [], dists: [], centros: [], cargos: [] }

export function filtrar(linhas: readonly Linha[], f: Filtros) {
  const ok = (sel: string[], v: string | null) => sel.length === 0 || (v != null && sel.includes(v))
  return linhas.filter((l) => ok(f.ufs, l[1]) && ok(f.areas, l[2]) && ok(f.dists, l[3]) && ok(f.centros, l[4]) && ok(f.cargos, l[6]))
}

export const atendeVinculo = (l: Linha, v: FiltroVinculo) => v === 'Ambos' || l[7] === v

// Segmento = cada base que precisa estar presente no mês: área + UF (+ distribuidora no Comercial).
const segmentoDe = (l: Linha) => (l[2] === 'Comercial' ? `${l[2]}|${l[1]}|${l[3]}` : `${l[2]}|${l[1]}`)
const nomeSegmento = (s: string) => s.split('|').join(' ')

export type StatusSegmento = 'fora' | 'sem dado' | 'sem vínculo' | 'ok'
export type Cobertura = {
  segmentos: string[]
  status: (segmento: string, comp: string) => StatusSegmento
  /** o que falta no mês (texto para o usuário) */
  faltas: (comp: string) => string[]
}

/**
 * Cobertura das bases por mês. Um segmento está "fora" antes do primeiro e depois do último mês
 * em que aparece; entre eles, mês sem linha é "sem dado". Com vínculo filtrado, mês que só tem o
 * total sem separação CLT/terceirizado é "sem vínculo".
 */
export function cobertura(linhas: readonly Linha[], vinculo: FiltroVinculo, ultimo?: string): Cobertura {
  const meses = new Map<string, Set<string>>()
  const naoInformado = new Map<string, Set<string>>()
  for (const l of linhas) {
    if (l[7] === 'Terceirizado') continue
    const s = segmentoDe(l)
    if (!meses.has(s)) meses.set(s, new Set())
    meses.get(s)!.add(l[0])
    if (l[7] === 'Não informado') {
      if (!naoInformado.has(s)) naoInformado.set(s, new Set())
      naoInformado.get(s)!.add(l[0])
    }
  }
  const primeiro = new Map([...meses].map(([s, m]) => [s, [...m].sort()[0]]))
  const ultimoDe = new Map([...meses].map(([s, m]) => [s, [...m].sort().at(-1)!]))
  const status = (s: string, c: string): StatusSegmento =>
    !meses.has(s) || c < primeiro.get(s)! || c > ultimoDe.get(s)!
      ? 'fora'
      : meses.get(s)!.has(c)
        ? vinculo !== 'Ambos' && naoInformado.get(s)?.has(c)
          ? 'sem vínculo'
          : 'ok'
        : 'sem dado'
  const faltas = (c: string) => {
    const r: string[] = []
    for (const s of meses.keys()) {
      const st = status(s, c)
      if (st === 'sem dado') {
        r.push(
          entraComAnoCorrente(c, ultimo)
            ? `${nomeSegmento(s)}: entra junto com ${rotuloMes(`${ultimo!.slice(0, 4)}-${c.slice(5, 7)}`)}`
            : `${nomeSegmento(s)}: sem dado`,
        )
      }
      if (st === 'sem vínculo') r.push(`${nomeSegmento(s)}: sem separação CLT/terceirizado`)
    }
    return r
  }
  return { segmentos: [...meses.keys()], status, faltas }
}

/** Soma por grupo e mês, respeitando o filtro de vínculo. */
export function somarPorMes(linhas: readonly Linha[], vinculo: FiltroVinculo, grupo: (l: Linha) => string = () => 'total') {
  const r = new Map<string, Map<string, number>>()
  for (const l of linhas) {
    if (!atendeVinculo(l, vinculo)) continue
    const g = grupo(l)
    if (!r.has(g)) r.set(g, new Map())
    const m = r.get(g)!
    m.set(l[0], (m.get(l[0]) || 0) + l[8])
  }
  return r
}

export type ValorMes = { v: number | null; faltas: string[]; bruto: number | null }

/**
 * Série do total: mês com base faltando fica sem valor (v = null), mas guarda o bruto para o "parcial".
 * baseCobertura: linhas usadas para saber se a base do mês está completa (padrão: as próprias linhas).
 * Com filtro de cargo, passe as linhas antes do filtro: cargo ausente no mês não é base faltando.
 */
export function serieTotal(
  linhas: readonly Linha[],
  vinculo: FiltroVinculo,
  meses: string[],
  ultimo?: string,
  baseCobertura: readonly Linha[] = linhas,
): ValorMes[] {
  const cob = cobertura(baseCobertura, vinculo, ultimo)
  const tot = somarPorMes(linhas, vinculo).get('total') || new Map<string, number>()
  return meses.map((c) => {
    const bruto = tot.get(c) ?? null
    const st = cob.segmentos.map((s) => cob.status(s, c))
    if (!st.length || st.every((s) => s === 'fora')) return { v: bruto, faltas: [], bruto }
    const faltas = cob.faltas(c)
    return { v: faltas.length ? null : (bruto ?? 0), faltas, bruto }
  })
}

export type Composicao = [string, Record<Vinculo, number>][]

/** Composição de um mês por área, estado ou área e estado (ordem: Comercial, Logística, Backoffice; AM antes de RR). */
export function composicao(linhas: readonly Linha[], comp: string, modo: 'area' | 'estado' | 'area-estado'): Composicao {
  const r = new Map<string, Record<Vinculo, number>>()
  for (const l of linhas) {
    if (l[0] !== comp) continue
    const k = modo === 'area' ? l[2] : modo === 'estado' ? ROTULO_UF[l[1]] : `${l[2]} ${l[1]}`
    if (!r.has(k)) r.set(k, { CLT: 0, Terceirizado: 0, 'Não informado': 0 })
    r.get(k)![l[7]] += l[8]
  }
  const ordem = (k: string) => {
    const a = AREAS.findIndex((x) => k.startsWith(x))
    return (a < 0 ? 9 : a) * 10 + (k.includes('RR') ? 1 : 0)
  }
  return [...r.entries()].sort((a, b) => ordem(a[0]) - ordem(b[0]))
}

// ---------------------------------------------------------------------------
// Árvore do detalhamento mensal
// Comercial: área › estado › distribuidora › centro › cargo
// Logística: área › estado › cargo
// Backoffice: área › estado › departamento
// ---------------------------------------------------------------------------
const NIVEIS: Record<Area, number[]> = { Comercial: [1, 3, 4, 6], Logística: [1, 6], Backoffice: [1, 5] }
const ORDEM_CENTRO: Record<string, number> = { Vendas: 0, Merchan: 1, 'Centro não informado': 2 }

export type NoArvore = {
  id: string
  label: string
  area: Area
  uf: UF | null
  dist: string | null
  /** índice da coluna da linha que gerou o nível (2 área, 1 UF, 3 distribuidora, 4 centro, 5 depto, 6 cargo) */
  idx: number
  prof: number
  filhos: NoArvore[]
  celulas: Record<string, Celula>
}

type NoMontagem = Omit<NoArvore, 'filhos' | 'celulas'> & {
  filhos: Map<string, NoMontagem>
  valores: Map<string, number>
  primeiro: string
}

export function arvoreDetalhamento(linhas: readonly Linha[], vinculo: FiltroVinculo, meses: string[], cob: Cobertura): NoArvore[] {
  const raiz = new Map<string, NoMontagem>()
  const temNivel = new Map<string, Set<string>>() // área|UF|nível → meses em que o nível vem preenchido
  for (const l of linhas) {
    const niveis = NIVEIS[l[2]]
    niveis.forEach((g) => {
      if (l[g] == null) return
      const k = `${l[2]}|${l[1]}|${g}`
      if (!temNivel.has(k)) temNivel.set(k, new Set())
      temNivel.get(k)!.add(l[0])
    })
    const caminho: string[] = [l[2]]
    let nivelAtual = raiz
    const passos = [{ label: l[2] as string | null, idx: 2 }, ...niveis.map((g) => ({ label: l[g] as string | null, idx: g }))]
    for (let p = 0; p < passos.length; p++) {
      const passo = passos[p]
      if (passo.label == null) break
      const label = passo.idx === 1 ? ROTULO_UF[passo.label as UF] : passo.label
      if (p > 0) caminho.push(label)
      if (!nivelAtual.has(label)) {
        nivelAtual.set(label, {
          id: caminho.join(' › '),
          label,
          area: l[2],
          uf: p >= 1 ? l[1] : null,
          dist: p >= 2 ? l[3] : null,
          idx: passo.idx,
          prof: p,
          filhos: new Map(),
          valores: new Map(),
          primeiro: l[0],
        })
      }
      const no = nivelAtual.get(label)!
      if (l[0] < no.primeiro) no.primeiro = l[0]
      if (atendeVinculo(l, vinculo)) no.valores.set(l[0], (no.valores.get(l[0]) || 0) + l[8])
      nivelAtual = no.filhos
    }
  }

  const segmentosDoNo = (no: NoMontagem) => {
    const base =
      no.idx === 2 ? no.area : no.idx === 1 || no.area !== 'Comercial' ? `${no.area}|${no.uf}` : `${no.area}|${no.uf}|${no.dist}`
    return cob.segmentos.filter((s) => s === base || s.startsWith(base + '|'))
  }
  const celula = (no: NoMontagem, c: string): Celula => {
    const valor = no.valores.get(c)
    const st = segmentosDoNo(no).map((s) => cob.status(s, c))
    const ehTotal = no.idx === 2 || no.idx === 1
    // distribuidora/departamento que ainda não existia → vazio
    if (st.every((s) => s === 'fora')) return valor ?? (no.idx === 3 || no.idx === 5 ? '' : null)
    if (st.some((s) => s === 'sem dado' || s === 'sem vínculo')) return ehTotal && valor != null ? { v: valor, parcial: true } : null
    if (!ehTotal && no.idx !== 3) {
      // mês sem detalhamento desse nível (ex.: Logística de 2025 sem cargo) → sem dado
      const meses = temNivel.get(`${no.area}|${no.uf}|${no.idx}`)
      if (!meses || !meses.has(c)) return null
      if (no.idx === 5 && c < no.primeiro) return ''
    }
    return valor ?? 0
  }
  const ultimo = meses.at(-1)
  const ordenar = (nos: NoMontagem[], idx: number) =>
    nos.sort((a, b) => {
      if (idx === 2) return AREAS.indexOf(a.label as Area) - AREAS.indexOf(b.label as Area)
      if (idx === 1) return a.label.localeCompare(b.label)
      if (idx === 4) return (ORDEM_CENTRO[a.label] ?? 9) - (ORDEM_CENTRO[b.label] ?? 9)
      // distribuidoras na ordem oficial do grupo (diretriz interna)
      if (idx === 3) return compararDistribuidoras(a.label, b.label)
      const va = ultimo ? a.valores.get(ultimo) || 0 : 0
      const vb = ultimo ? b.valores.get(ultimo) || 0 : 0
      return vb - va || a.label.localeCompare(b.label)
    })
  const finalizar = (m: Map<string, NoMontagem>): NoArvore[] => {
    const nos = [...m.values()]
    if (!nos.length) return []
    ordenar(nos, nos[0].idx)
    return nos.map((no) => ({
      id: no.id,
      label: no.label,
      area: no.area,
      uf: no.uf,
      dist: no.dist,
      idx: no.idx,
      prof: no.prof,
      filhos: finalizar(no.filhos),
      celulas: Object.fromEntries(meses.map((c) => [c, celula(no, c)])),
    }))
  }
  return finalizar(raiz)
}

export type LinhaArvore = Omit<NoArvore, 'filhos'> & { temFilhos: boolean; aberto: boolean }

/** Nós visíveis (pais abertos), na ordem da árvore. */
export function achatarArvore(nos: NoArvore[], abertos: Set<string>): LinhaArvore[] {
  const r: LinhaArvore[] = []
  const visitar = (lista: NoArvore[]) =>
    lista.forEach(({ filhos, ...no }) => {
      r.push({ ...no, temFilhos: filhos.length > 0, aberto: abertos.has(no.id) })
      if (abertos.has(no.id)) visitar(filhos)
    })
  visitar(nos)
  return r
}

/** Ids dos nós com filhos até a profundidade indicada (para "expandir tudo"). */
export function idsExpansiveis(nos: NoArvore[], ateProf = 99) {
  const r: string[] = []
  const visitar = (lista: NoArvore[]) =>
    lista.forEach((no) => {
      if (no.filhos.length && no.prof < ateProf) {
        r.push(no.id)
        visitar(no.filhos)
      }
    })
  visitar(nos)
  return r
}

// ---------------------------------------------------------------------------
// Sobre os dados: lacunas e meses sem separação de vínculo
// ---------------------------------------------------------------------------
export type Lacuna = { seg: string; tipo: 'lacuna' | 'previsto'; faixas: string[] }

export function lacunas(linhas: readonly Linha[], ultimo?: string): Lacuna[] {
  const porSeg = new Map<string, Set<string>>()
  for (const l of linhas) {
    const s = segmentoDe(l)
    if (!porSeg.has(s)) porSeg.set(s, new Set())
    porSeg.get(s)!.add(l[0])
  }
  const r: Lacuna[] = []
  for (const [s, m] of porSeg) {
    const ord = [...m].sort()
    const faltando = intervaloMeses(ord[0], ord.at(-1)!).filter((c) => !m.has(c))
    const lac = faltando.filter((c) => !entraComAnoCorrente(c, ultimo))
    const prev = faltando.filter((c) => entraComAnoCorrente(c, ultimo))
    if (lac.length) r.push({ seg: nomeSegmento(s), tipo: 'lacuna', faixas: faixasDeMeses(lac) })
    if (prev.length) r.push({ seg: nomeSegmento(s), tipo: 'previsto', faixas: faixasDeMeses(prev) })
  }
  return r.sort((a, b) => a.seg.localeCompare(b.seg))
}

export function semSeparacaoVinculo(linhas: readonly Linha[]) {
  const r = new Map<string, Set<string>>()
  for (const l of linhas) {
    if (l[7] !== 'Não informado') continue
    const s = `${l[2]} ${l[1]}`
    if (!r.has(s)) r.set(s, new Set())
    r.get(s)!.add(l[0])
  }
  return [...r].map(([seg, m]) => {
    const ord = [...m].sort()
    return { seg, faixa: `${rotuloMes(ord[0])} a ${rotuloMes(ord.at(-1)!)}` }
  })
}

// ---------------------------------------------------------------------------
// Evolução por cargo (abas de área)
// ---------------------------------------------------------------------------
export type LinhaCargo = { id: string; label: string; tipo: 'cargo' | 'terc'; celulas: Record<string, Celula> }

/** baseCobertura: como em serieTotal (linhas antes do filtro de cargo; padrão: as próprias linhas). */
export function tabelaCargos(
  linhas: readonly Linha[],
  vinculo: FiltroVinculo,
  meses: string[],
  ultimo?: string,
  baseCobertura: readonly Linha[] = linhas,
) {
  const cob = cobertura(baseCobertura, vinculo, ultimo)
  const comCargo = new Map<string, { com: number; sem: number }>() // mês → pessoas CLT com/sem cargo
  const mesesNaoInformado = new Set<string>()
  const porCargo = new Map<string, Map<string, number>>()
  const terc = new Map<string, number>()
  // detalhamento por cargo do mês (com/sem cargo) olha a base inteira
  for (const l of baseCobertura) {
    const c = l[0]
    if (l[7] === 'Não informado') mesesNaoInformado.add(c)
    if (l[7] !== 'Terceirizado') {
      if (!comCargo.has(c)) comCargo.set(c, { com: 0, sem: 0 })
      comCargo.get(c)![l[6] ? 'com' : 'sem'] += l[8]
    }
  }
  for (const l of linhas) {
    const c = l[0]
    if (!atendeVinculo(l, vinculo)) continue
    if (l[7] === 'Terceirizado') {
      terc.set(c, (terc.get(c) || 0) + l[8])
      continue
    }
    if (!l[6]) continue
    if (!porCargo.has(l[6])) porCargo.set(l[6], new Map())
    const m = porCargo.get(l[6])!
    m.set(c, (m.get(c) || 0) + l[8])
  }
  const situacao = (c: string) => {
    const st = cob.segmentos.map((s) => cob.status(s, c))
    return !st.length || st.every((s) => s === 'fora') ? 'fora' : st.some((s) => s === 'sem dado' || s === 'sem vínculo') ? 'ruim' : 'ok'
  }
  const linhasCargo: (LinhaCargo & { ult: number })[] = []
  if (vinculo !== 'Terceirizado') {
    const ultComCargo = [...meses].reverse().find((c) => (comCargo.get(c)?.com ?? 0) > 0)
    for (const [cargo, m] of porCargo) {
      const celulas: Record<string, Celula> = {}
      meses.forEach((c) => {
        const sit = situacao(c)
        const cc = comCargo.get(c)
        const x = m.get(c)
        if (sit === 'fora') celulas[c] = x ?? ''
        else if (sit === 'ruim' || !cc || !cc.com) celulas[c] = null
        else if (cc.sem > 0) celulas[c] = x != null ? { v: x, parcial: true } : null
        else celulas[c] = x ?? 0
      })
      linhasCargo.push({ id: cargo, label: cargo, tipo: 'cargo', celulas, ult: (ultComCargo && m.get(ultComCargo)) || 0 })
    }
    linhasCargo.sort((a, b) => b.ult - a.ult || a.label.localeCompare(b.label))
  }
  const resultado: LinhaCargo[] = linhasCargo.map(({ ult: _ult, ...l }) => l)
  if (vinculo !== 'CLT') {
    const celulas: Record<string, Celula> = {}
    meses.forEach((c) => {
      const sit = situacao(c)
      const x = terc.get(c)
      if (sit === 'fora') celulas[c] = x ?? ''
      else if (sit === 'ruim') celulas[c] = x != null ? { v: x, parcial: true } : null
      else if (mesesNaoInformado.has(c) && x == null) celulas[c] = null
      else celulas[c] = x ?? 0
    })
    resultado.push({ id: '__terc', label: ROTULO_LINHA_TERC, tipo: 'terc', celulas })
  }
  const total: Celula[] = serieTotal(linhas, vinculo, meses, ultimo, baseCobertura).map((t) =>
    t.v != null ? t.v : t.bruto != null ? { v: t.bruto, parcial: true } : null,
  )
  return { linhas: resultado, total }
}

/** Número da célula, para comparar (Δ período). */
export const numeroDaCelula = (c: Celula | undefined) => (typeof c === 'number' ? c : c && typeof c === 'object' ? c.v : null)
