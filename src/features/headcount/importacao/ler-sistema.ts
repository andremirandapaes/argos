// Leitor da exportação do sistema (FPRE, "Relação de Colaboradores"): uma aba por estado (AM, RR),
// pessoas agrupadas por centro de custo. Portado do artefato "Headcount de Colaboradores" (mesmas
// regras de área, distribuidora, centro e padronização de nomes), com os ajustes do layout de 2026:
//   - a coluna do cargo é achada pelo cabeçalho "Cargo" (em 2026 entrou a coluna Salário depois dela);
//   - pessoas sem cabeçalho de centro próprio (ex.: Merchandising logo depois de Vendas) são separadas
//     pelo subtotal: as N últimas pessoas antes do subtotal "X = N" pertencem ao centro X;
//   - ficam fora: Diretoria, Dunorte Professional, Abastex (é o Contact Center), Núcleo de Inteligência Comercial e Unidades;
//   - Logística (Depósito/Distribuição): até Dez/25 vale a planilha do Depósito (auditada) e a do sistema é
//     ignorada; de Jan/26 em diante vem do sistema, com o tratamento do usuário: as pessoas da lista
//     TRANSFERIR_PARA_DISTRIBUICAO saem do Depósito e vão para a Distribuição (quem já está no centro
//     Distribuição continua lá; nome da lista que não aparecer no mês é ignorado);
//   - a coluna Salário é ignorada (só o cargo é lido; nenhum valor de salário é lido nem gravado).
// Função pura (recebe as linhas das abas), para poder ser testada sem navegador.

import type { Area, UF } from '../regras'

export type AbaPlanilha = { nome: string; linhas: unknown[][] }

export type LinhaLida = {
  competencia: string // "AAAA-MM"
  uf: UF
  area: Area
  distribuidora: string | null
  centro: string | null
  departamento: string | null
  cargo: string | null
  vinculo: 'CLT'
  quantidade: number
}

export type BaseSistema = {
  fonte: string // "sistema_AAAA-MM"
  tipo: 'sistema'
  uf: string // "AM/RR"
  ufs: UF[]
  resumo: Record<string, number> // colaboradores contados por UF (sem os excluídos)
  arquivo: string
  competencia: string | null
  linhas: LinhaLida[]
  avisos: string[]
  padronizacoes: [string, string][]
}

// ---------------------------------------------------------------------------
// Normalização de nomes (igual ao artefato)
// ---------------------------------------------------------------------------
const semAcento = (s: unknown) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
/** chave de comparação: sem acento, maiúscula, espaços simples */
export const chave = (s: unknown) => semAcento(s).toUpperCase().replace(/\s+/g, ' ').trim()

// cargos escritos de jeitos diferentes nas bases
const CARGOS: Record<string, string> = {
  'ANALIST. VENDAS': 'ANALISTA DE VENDAS',
  'ASSIST. VENDAS': 'ASSISTENTE DE VENDAS (NIVEL NAO INFORMADO)',
  ASSISTENTES: 'ASSISTENTE DE VENDAS (NIVEL NAO INFORMADO)',
  'SUP. MERCHAN': 'SUPERVISOR DE MERCHANDISING',
  'SV MERCHANDISING': 'SUPERVISOR DE MERCHANDISING',
  'SV. MERCHAN': 'SUPERVISOR DE MERCHANDISING',
  'SV MERCHAN': 'SUPERVISOR DE MERCHANDISING',
  'LIDER. MERCHAN': 'LIDER DE MERCHANDISING',
  'LIDER MERCHAN': 'LIDER DE MERCHANDISING',
  'ENCARREGADO DE MERCHAN': 'ENCARREGADO DE MERCHANDISING',
  'AUX. TRADE MKT': 'AUXILIAR DE TRADE MARKETING',
  'PROMOTOR DE VENDAS I': 'PROMOTOR DE VENDAS JR',
  'DEPT. PESSOAL': 'DEPARTAMENTO PESSOAL',
  'DEPTO. PESSOAL': 'DEPARTAMENTO PESSOAL',
}
/** Primeiro mês em que a Logística vem do sistema (antes disso, da planilha do Depósito). Regra de 2026-10-07: Jan/26. */
export const LOGISTICA_DO_SISTEMA_DESDE = '2026-01'

/** Pessoas lotadas no Depósito que na verdade são da Distribuição (tratamento do usuário, 2026-10-07). */
const TRANSFERIR_PARA_DISTRIBUICAO = new Set(
  ['JESSE RODRIGUES MOTA', 'ADAMOR PIRES BISNETO', 'DARCIO SILVA E SOUZA', 'KENNEDY MEDEIROS GAMA'].map((n) => chave(n)),
)

// palavras que voltam a ter acento
const ACENTOS: Record<string, string> = {
  LOGISTICA: 'logística',
  DISTRIBUICAO: 'distribuição',
  DEPOSITO: 'depósito',
  EXPEDICAO: 'expedição',
  MOVIMENTACAO: 'movimentação',
  TECNICO: 'técnico',
  ESTAGIARIO: 'estagiário',
  ARTIFICE: 'artífice',
  LIDER: 'líder',
  NAO: 'não',
  NIVEL: 'nível',
  CREDITO: 'crédito',
  COBRANCA: 'cobrança',
  INFORMACAO: 'informação',
  GESTAO: 'gestão',
  FINANCAS: 'finanças',
}
const SIGLAS = new Set(['JR', 'PL', 'SR', 'ADM', 'TI', 'RCA', 'CD'])

/** "ANALISTA DE VENDAS JR" → "Analista de vendas JR" (siglas mantidas, acentos devolvidos) */
function nomeLegivel(k: string) {
  const r = k
    .split(' ')
    .map((p) => {
      const n = p.replace(/[()]/g, '')
      const abre = p.startsWith('(') ? '(' : ''
      const fecha = p.endsWith(')') ? ')' : ''
      if (SIGLAS.has(n)) return abre + n + fecha
      if (n.includes('/')) return abre + n.split('/').map((o) => ACENTOS[o] || o.toLowerCase()).join('/') + fecha
      return abre + (ACENTOS[n] || n.toLowerCase()) + fecha
    })
    .join(' ')
  return r.charAt(0).toUpperCase() + r.slice(1)
}

/** Cargo padronizado; anota a padronização quando o nome original foi trocado. */
function padronizarCargo(original: string, padronizacoes: Map<string, string>) {
  const k = chave(original)
  const final = nomeLegivel(CARGOS[k] || k)
  if (CARGOS[k]) padronizacoes.set(String(original).replace(/\s+/g, ' ').trim(), final)
  return final
}

// departamentos do backoffice (inclui os nomes novos do layout de 2026)
const DEPARTAMENTOS: Record<string, string> = {
  'GENTE&GESTAO': 'Gente & gestão',
  'GENTE & GESTAO': 'Gente & gestão',
  CONTROLADORIA: 'Controladoria',
  ADMINISTRATIVO: 'Administrativo',
  'DEPT. PESSOAL': 'Departamento pessoal',
  'DEPT PESSOAL': 'Departamento pessoal',
  'DEPTO PESSOAL': 'Departamento pessoal',
  'DEPTO. PESSOAL': 'Departamento pessoal',
  'DEPARTAMENTO PESSOAL': 'Departamento pessoal',
  'INFRA E SUPRIMENTOS': 'Infra e suprimentos',
  'INFRAESTRUTURA E SUPRIMENTOS': 'Infra e suprimentos',
  'TECNOLOGIA DA INFORMACAO': 'Tecnologia da informação',
  FINANCAS: 'Finanças',
  'CREDITO\\COBRANCA': 'Crédito/cobrança',
  'CREDITO/COBRANCA': 'Crédito/cobrança',
  'CREDITO COBRANCA': 'Crédito/cobrança',
  'ADM COMPRAS': 'ADM de compras',
  'ADM DE COMPRAS': 'ADM de compras',
  'TRADE MARKETING': 'Trade marketing',
}
const departamento = (nome: string) => {
  const k = chave(nome)
  return DEPARTAMENTOS[k] || DEPARTAMENTOS[k.replace(/\\/g, '/')] || nomeLegivel(k)
}

/** Distribuidora pelo nome do centro de custo (nomes antigos de equipe incluídos). */
function distribuidora(nome: string) {
  const t = ' ' + chave(nome).replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ') + ' '
  if (t.includes('MIX')) return 'Mix Norte'
  if (t.includes('ROTA NORTE')) return 'Rota Norte'
  if (t.includes('ELONORTE') || t.includes('ELO NORTE') || t.includes('SUPER MARCAS')) return 'Elo Norte'
  if (t.includes('METANORTE') || t.includes('META NORTE') || t.includes('BIG MARCAS')) return 'Meta Norte'
  if (t.includes('DUNORTE') || t.includes('MEGA MARCAS')) return 'Dunorte'
  if (t.includes(' SG ') || t.includes('SUPER GIRO')) return 'Super Giro'
  return null
}

type Classificacao =
  | { ignorar: true; motivo: string }
  | { ignorar?: false; area: 'Comercial'; dist: string; centro: 'Vendas' | 'Merchan'; distDesconhecida: boolean }
  | { ignorar?: false; area: 'Backoffice'; dept: string }
  | { ignorar?: false; area: 'Logística'; setor: string }

/** Classifica o centro de custo ("1.5.13 , Dunorte, Vendas, Vendas - Metanorte Distribuidora"). */
export function classificarCentro(centro: string): Classificacao {
  const partes = String(centro).split(',').map((a) => a.trim())
  const macro = chave(partes[2] || '')
  const sub = partes[3] || ''
  const subK = chave(sub)
  const tudo = chave(partes.slice(1).join(' '))
  if (tudo.includes('PROFESSIONAL')) return { ignorar: true, motivo: 'Dunorte Professional' }
  if (tudo.includes('ABASTEX')) return { ignorar: true, motivo: 'Abastex (Contact Center)' }
  if (tudo.includes('DIRETORIA')) return { ignorar: true, motivo: 'Diretoria' }
  if (tudo.includes('INTELIGENCIA COMERCIAL') || /\[NIC\]/.test(tudo)) return { ignorar: true, motivo: 'Núcleo de Inteligência Comercial' }
  if (/\bUNIDADES?\b/.test(tudo)) return { ignorar: true, motivo: 'Unidades' }
  if (tudo.includes('CONTACT CENTER')) return { ignorar: true, motivo: 'Abastex (Contact Center)' }
  // Logística: setor (Depósito / Distribuição); se entra ou não depende do mês (ver lerExportacaoSistema)
  if (macro === 'LOGISTICA') return { area: 'Logística', setor: nomeLegivel(subK || 'LOGISTICA') }
  if (macro === 'VENDAS') {
    if (subK.startsWith('VENDAS') || subK.startsWith('MERCHANDISING')) {
      const resto = sub.replace(/^(vendas|merchandising)\s*-?\s*/i, '')
      const d = distribuidora(sub.replace(/^(vendas|merchandising)/i, ''))
      return {
        area: 'Comercial',
        dist: d || nomeLegivel(chave(resto)),
        centro: subK.startsWith('VENDAS') ? 'Vendas' : 'Merchan',
        distDesconhecida: !d,
      }
    }
    return { area: 'Backoffice', dept: departamento(sub) }
  }
  return { area: 'Backoffice', dept: departamento(sub || partes[2] || 'Outros') }
}

/** "1.5.19 , Dunorte, Vendas, ..." → "1.5.19" */
const codigoDe = (centro: string) => centro.split(',')[0].trim()
const ehCentro = (v: unknown): v is string => typeof v === 'string' && /^\d+(\.\d+)*\s*,/.test(v.trim())
const pareceDinheiro = (v: string) => /^-?[\d.]+,\d{2}$/.test(v.trim())

/** "FPRE0082026.xlsx" → "2026-08" */
export function competenciaDoArquivo(nome: string) {
  const m = String(nome || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .match(/(\d{2})(\d{4})$/)
  if (!m) return null
  const mes = Number(m[1])
  const ano = Number(m[2])
  return mes >= 1 && mes <= 12 && ano > 2000 ? `${ano}-${String(mes).padStart(2, '0')}` : null
}

/** É uma exportação do sistema? (nome FPRE... ou título "Relação de Colaboradores") */
export function ehExportacaoSistema(abas: AbaPlanilha[], arquivo: string) {
  if (/^FPRE/i.test(arquivo || '')) return true
  return abas.some((a) => a.linhas.slice(0, 6).some((l) => l?.some((c) => typeof c === 'string' && /RELA[CÇ][AÃ]O DE COLABORADORES/i.test(c))))
}

// o nome só é usado em memória, para o tratamento da Logística (não é gravado)
type Pessoa = { cargo: string; nome: string }

/**
 * Lê a exportação do sistema.
 * opcoes.competencia: mês escolhido na tela quando o nome do arquivo não traz o mês.
 */
export function lerExportacaoSistema(abas: AbaPlanilha[], arquivo: string, opcoes: { competencia?: string } = {}): BaseSistema {
  const competencia = opcoes.competencia ?? competenciaDoArquivo(arquivo)
  const logisticaDoSistema = !!competencia && competencia >= LOGISTICA_DO_SISTEMA_DESDE
  const padronizacoes = new Map<string, string>()
  const avisos: string[] = []
  const contagem = new Map<string, number>() // chave da linha agregada → pessoas
  const ufs: UF[] = []
  const resumo: Record<string, number> = {}

  for (const aba of abas) {
    const linhas = aba.linhas
    const cabecalho = linhas
      .slice(0, 3)
      .flat()
      .filter((x): x is string => typeof x === 'string')
      .map(chave)
      .join(' ')
    if (cabecalho.includes('PROFESSIONAL') || chave(aba.nome).includes('PROFESSIONAL')) {
      avisos.push(`Aba "${aba.nome}" é da Dunorte Professional, fora do painel.`)
      continue
    }
    if (cabecalho.includes('ABASTEX') || chave(aba.nome).includes('ABASTEX')) {
      avisos.push(`Aba "${aba.nome}" é da Abastex, fora do painel.`)
      continue
    }
    const nomeAba = chave(aba.nome)
    const uf: UF | null =
      nomeAba === 'AM' || nomeAba === 'RR'
        ? (nomeAba as UF)
        : cabecalho.includes('SUPER GIRO')
          ? 'RR'
          : cabecalho.includes('DUNORTE')
            ? 'AM'
            : null
    if (!uf) continue

    // coluna do cargo pelo cabeçalho ("Cargo"); sem cabeçalho, o último texto que não é valor em R$
    let colunaCargo = -1
    for (const l of linhas.slice(0, 15)) {
      const i = (l ?? []).findIndex((c) => typeof c === 'string' && chave(c) === 'CARGO')
      if (i > 0) {
        colunaCargo = i
        break
      }
    }
    const cargoDaLinha = (l: unknown[]) => {
      if (colunaCargo > 0 && typeof l[colunaCargo] === 'string' && (l[colunaCargo] as string).trim()) return l[colunaCargo] as string
      const textos = l.slice(3).filter((c): c is string => typeof c === 'string' && !!c.trim() && chave(c) !== 'CARGO' && !pareceDinheiro(c))
      return textos.at(-1) ?? 'Cargo não informado'
    }

    let centroAtual: string | null = null
    let pendentes: Pessoa[] = [] // pessoas lidas desde o último cabeçalho/subtotal
    const pessoasPorCentro = new Map<string, number>()
    const subtotais = new Map<string, number>()
    const foraDoPainel = new Map<string, number>()
    let transferidas = 0
    let lidas = 0

    const atribuir = (centro: string, pessoas: Pessoa[]) => {
      if (!pessoas.length) return
      lidas += pessoas.length
      pessoasPorCentro.set(centro, (pessoasPorCentro.get(centro) || 0) + pessoas.length)
      const cl = classificarCentro(centro)
      if (cl.ignorar || (cl.area === 'Logística' && !logisticaDoSistema)) {
        const motivo = cl.ignorar ? cl.motivo : 'Logística (até Dez/25 vem da planilha do Depósito)'
        foraDoPainel.set(motivo, (foraDoPainel.get(motivo) || 0) + pessoas.length)
        return
      }
      for (const p of pessoas) {
        const cargo = padronizarCargo(p.cargo, padronizacoes)
        let k: (string | null)[]
        if (cl.area === 'Comercial') k = [uf, 'Comercial', cl.dist, cl.centro, '', cargo]
        else if (cl.area === 'Logística') {
          const paraDistribuicao = cl.setor === 'Depósito' && TRANSFERIR_PARA_DISTRIBUICAO.has(chave(p.nome))
          if (paraDistribuicao) transferidas++
          k = [uf, 'Logística', '', '', paraDistribuicao ? 'Distribuição' : cl.setor, cargo]
        } else k = [uf, 'Backoffice', '', '', cl.dept, cargo]
        const id = k.join('|')
        contagem.set(id, (contagem.get(id) || 0) + 1)
      }
    }
    const avisados = new Set<string>()
    const avisarDistribuidora = (centro: string) => {
      const cl = classificarCentro(centro)
      if (!cl.ignorar && cl.area === 'Comercial' && cl.distDesconhecida && !avisados.has(centro)) {
        avisados.add(centro)
        avisos.push(`${uf}: centro de custo "${centro}" sem distribuidora conhecida.`)
      }
    }

    for (const l of linhas) {
      if (!l || !l.length) continue
      const c0 = l[0]
      if (ehCentro(c0)) {
        const centro = c0.trim()
        const numero = l.slice(1).find((v) => typeof v === 'number') as number | undefined
        if (numero == null) {
          // cabeçalho de um novo centro: o que sobrou pendente é do centro anterior
          if (centroAtual) atribuir(centroAtual, pendentes)
          pendentes = []
          centroAtual = centro
          avisarDistribuidora(centro)
          continue
        }
        // subtotal de grupo ("1.5 , Dunorte, Vendas", "1 , Dunorte"): código-pai do centro atual. Não conta pessoas
        // (o próprio relatório às vezes soma 1 a mais que os centros), só fecha o centro atual.
        if (centroAtual && codigoDe(centroAtual).startsWith(codigoDe(centro) + '.')) {
          atribuir(centroAtual, pendentes)
          pendentes = []
          continue
        }
        // subtotal do centro (contagem de pessoas)
        subtotais.set(centro, numero)
        if (centro === centroAtual) {
          atribuir(centro, pendentes)
          pendentes = []
        } else {
          // subtotal de um centro sem cabeçalho: as N últimas pessoas pendentes são dele
          avisarDistribuidora(centro)
          const n = Math.min(numero, pendentes.length)
          if (n < numero) avisos.push(`${uf}: "${centro}" diz ${numero} pessoas, mas só ${n} estavam sem centro.`)
          atribuir(centro, pendentes.slice(pendentes.length - n))
          pendentes = pendentes.slice(0, pendentes.length - n)
        }
        continue
      }
      // linha de pessoa: cadastro (número), tipo, nome
      if (typeof c0 === 'number' && l[1] !== '-' && typeof l[2] === 'string' && centroAtual) {
        pendentes.push({ cargo: cargoDaLinha(l), nome: String(l[2]) })
      }
    }
    if (centroAtual) atribuir(centroAtual, pendentes)

    for (const [centro, n] of subtotais) {
      const contadas = pessoasPorCentro.get(centro)
      if (contadas != null && contadas !== n) avisos.push(`${uf}: "${centro}" lista ${contadas} pessoas, mas o subtotal diz ${n}.`)
    }
    if (transferidas) avisos.push(`${uf}: ${transferidas} pessoas do Depósito contadas na Distribuição (tratamento da Logística).`)
    for (const [motivo, n] of foraDoPainel) avisos.push(`${uf}: ${n} em ${motivo}, fora do painel.`)
    if (lidas) {
      ufs.push(uf)
      resumo[uf] = lidas - [...foraDoPainel.values()].reduce((a, b) => a + b, 0)
    }
  }

  const linhas: LinhaLida[] = [...contagem].map(([id, quantidade]) => {
    const [uf, area, dist, centro, dept, cargo] = id.split('|').map((v) => (v === '' ? null : v))
    return {
      competencia: competencia ?? '',
      uf: uf as UF,
      area: area as Area,
      distribuidora: dist,
      centro,
      departamento: dept,
      cargo,
      vinculo: 'CLT',
      quantidade,
    }
  })
  if (!competencia) avisos.push('Não identifiquei o mês pelo nome do arquivo. Escolha a competência antes de salvar.')

  return {
    fonte: competencia ? `sistema_${competencia}` : 'sistema_',
    tipo: 'sistema',
    uf: ufs.join('/'),
    ufs,
    resumo,
    arquivo,
    competencia,
    linhas,
    avisos,
    padronizacoes: [...padronizacoes],
  }
}
