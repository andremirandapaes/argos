import { useCallback, useMemo, useState } from 'react'
import { ArrowUpDown, RotateCcw, UserRound, Users } from 'lucide-react'
import { Indicador } from '@/components/Indicador'
import { compararDistribuidoras, corDistribuidora } from '@/lib/distribuidoras'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ROTULO_UF,
  UFS,
  competencias,
  cargoMacro,
  intervaloMeses,
  rotuloMes,
  serieTotal,
  tabelaCargos,
  type Area,
  type FiltroVinculo,
  type Linha,
  type Vinculo,
} from './regras'
import { AvisoParcial, CampoFiltro, Escolha, EscolhaMulti, FiltroMulti, BotoesVinculo, resumoSelecao, fmtPct1, fmtPessoas, fmtVariacao, type Opcao } from './componentes'
import type { SerieLinha } from './GraficoLinhas'
import { GraficoBarras } from './GraficoBarras'
import { TabelaCargos } from './Tabelas'


/** Como cada área escolhe o "centro de custo" do filtro. */
const CENTRO_DE_CUSTO: Record<
  Area,
  { chave: (l: Linha) => string; grupo: (l: Linha) => string | undefined; rotulo: (l: Linha) => string; nome: string }
> = {
  Comercial: {
    chave: (l) => `${l[3]}|${l[4]}`,
    grupo: (l) => l[3] ?? undefined,
    rotulo: (l) => l[4] ?? '',
    nome: 'Centro de custo',
  },
  Logística: {
    chave: (l) => l[5] ?? '',
    grupo: () => undefined,
    rotulo: (l) => l[5] ?? '',
    nome: 'Centro de custo (setor)',
  },
  Backoffice: {
    chave: (l) => l[5] ?? '',
    grupo: () => undefined,
    rotulo: (l) => l[5] ?? '',
    nome: 'Centro de custo (departamento)',
  },
}

type Detalhe = 'total' | 'dist' | 'vinc'
const DETALHES: Record<Area, { value: Detalhe; label: string }[]> = {
  Comercial: [
    { value: 'total', label: 'Total' },
    { value: 'dist', label: 'Distribuidora' },
    { value: 'vinc', label: 'Vínculo' },
  ],
  Logística: [
    { value: 'total', label: 'Total' },
    { value: 'vinc', label: 'Vínculo' },
  ],
  Backoffice: [
    { value: 'total', label: 'Total' },
    { value: 'vinc', label: 'Vínculo' },
  ],
}

const ORDEM_CENTRO: Record<string, number> = { Vendas: 0, Merchan: 1 }

/** Aba de uma área: filtros próprios, indicadores, evolução detalhável e evolução por cargo. */
export function VisaoArea({ area, linhas, comps }: { area: Area; linhas: readonly Linha[]; comps: string[] }) {
  const ultimoGeral = comps.at(-1)
  const daArea = useMemo(() => linhas.filter((l) => l[2] === area), [linhas, area])
  const compsArea = useMemo(() => competencias(daArea), [daArea])
  // ano: null = o mais recente da área
  const [ano, setAno] = useState<string | null>(null)
  const [rotulos, setRotulos] = useState(true)
  const [ufs, setUfs] = useState<string[]>([])
  const [centros, setCentros] = useState<string[]>([])
  const [vinculo, setVinculo] = useState<FiltroVinculo>('Ambos')
  const [detalhe, setDetalhe] = useState<Detalhe>('total')
  // família de cargo (Analistas, Auxiliares...) e cargos tirados da conta com um clique na tabela
  const [macros, setMacros] = useState<string[]>([])
  const [fora, setFora] = useState<string[]>([])

  const anos = [...new Set(compsArea.map((c) => c.slice(0, 4)))]
  const anoAtivo = ano && anos.includes(ano) ? ano : (anos.at(-1) ?? '')
  const doPeriodo = compsArea.filter((c) => c.startsWith(anoAtivo))
  const primeiro = doPeriodo[0]
  const ultimo = doPeriodo.at(-1)
  const meses = useMemo(() => (primeiro && ultimo ? intervaloMeses(primeiro, ultimo) : []), [primeiro, ultimo])
  const cc = CENTRO_DE_CUSTO[area]

  const porUf = useMemo(() => daArea.filter((l) => !ufs.length || ufs.includes(l[1])), [daArea, ufs])
  const opcoesCentro = useMemo<Opcao[]>(() => {
    const m = new Map<string, Opcao>()
    porUf.forEach((l) => {
      if (l[5] == null && area !== 'Comercial') return
      const k = cc.chave(l)
      if (!m.has(k)) m.set(k, { value: k, label: cc.rotulo(l), grupo: cc.grupo(l) })
    })
    return [...m.values()].sort(
      (a, b) =>
        compararDistribuidoras(a.grupo ?? '', b.grupo ?? '') ||
        (ORDEM_CENTRO[a.label] ?? 9) - (ORDEM_CENTRO[b.label] ?? 9) ||
        a.label.localeCompare(b.label),
    )
  }, [porUf, cc, area])
  const centrosValidos = centros.filter((c) => opcoesCentro.some((o) => o.value === c))
  const porCentro = useMemo(
    () => porUf.filter((l) => !centrosValidos.length || centrosValidos.includes(cc.chave(l))),
    [porUf, centrosValidos, cc],
  )
  const opcoesMacro = useMemo<Opcao[]>(
    () =>
      [...new Set(porCentro.map((l) => cargoMacro(l[6])).filter((m): m is string => !!m))]
        .sort((a, b) => a.localeCompare(b))
        .map((m) => ({ value: m, label: m })),
    [porCentro],
  )
  const macrosValidos = macros.filter((m) => opcoesMacro.some((o) => o.value === m))
  // linhas dos cargos escolhidos (todas aparecem na tabela, inclusive as tiradas da conta)
  const doCargo = useMemo(
    () => (macrosValidos.length ? porCentro.filter((l) => macrosValidos.includes(cargoMacro(l[6]) ?? '')) : porCentro),
    [porCentro, macrosValidos],
  )
  const foraSet = useMemo(() => new Set(fora), [fora])
  // o que entra na conta: total, gráfico e indicadores
  const filtradas = useMemo(
    () => doCargo.filter((l) => !(l[7] === 'Terceirizado' ? foraSet.has('__terc') : l[6] != null && foraSet.has(l[6]))),
    [doCargo, foraSet],
  )
  const alternarFora = (id: string) => setFora((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))

  // com filtro de cargo, mês sem detalhamento por cargo (planilha manual só com o total) fica sem valor
  const semDetalhe = useMemo(() => {
    const r = new Set<string>()
    if (macrosValidos.length) porCentro.forEach((l) => l[7] !== 'Terceirizado' && !l[6] && r.add(l[0]))
    return r
  }, [porCentro, macrosValidos.length])
  // série de um conjunto de linhas: completude do mês pela base sem filtro de cargo (cargo ausente ≠ base faltando)
  const serieDe = useCallback(
    (rows: readonly Linha[], vinc: FiltroVinculo, base: readonly Linha[]) =>
      serieTotal(rows, vinc, meses, ultimoGeral, base).map((v, i) =>
        semDetalhe.has(meses[i]) ? { ...v, v: null, faltas: [...v.faltas, 'sem detalhamento por cargo neste mês'] } : v,
      ),
    [meses, ultimoGeral, semDetalhe],
  )

  const serie = useMemo(() => serieDe(filtradas, vinculo, porCentro), [serieDe, filtradas, vinculo, porCentro])
  const fim = serie.at(-1) ?? { v: null, faltas: [], bruto: null }
  const inicio = serie[0] ?? { v: null, faltas: [], bruto: null }
  const porVinculo = useMemo(() => {
    const r: Record<Vinculo, number> = { CLT: 0, Terceirizado: 0, 'Não informado': 0 }
    filtradas.forEach((l) => {
      if (l[0] === ultimo) r[l[7]] += l[8]
    })
    return r
  }, [filtradas, ultimo])
  const comVinculo = porVinculo.CLT + porVinculo.Terceirizado

  const grafico = useMemo(() => {
    const rot = meses.map((c) => rotuloMes(c).slice(0, 3))
    const faltas = serie.map((s) => s.faltas)
    if (detalhe === 'total') {
      return { rotulos: rot, faltas, series: [{ nome: `Total ${area}`, cor: 'var(--primary)', destaque: true, valores: serie.map((s) => s.v) }] }
    }
    if (detalhe === 'vinc') {
      const tipos: FiltroVinculo[] = vinculo === 'Ambos' ? ['CLT', 'Terceirizado'] : [vinculo]
      return {
        rotulos: rot,
        faltas,
        series: tipos.map((t) => ({
          nome: t === 'CLT' ? 'CLT' : 'Terceirizados',
          cor: t === 'CLT' ? 'var(--hc-clt)' : 'var(--hc-terc)',
          valores: serieDe(filtradas, t, porCentro).map((s) => s.v),
        })),
      }
    }
    // por distribuidora
    const grupos = new Map<string, Linha[]>()
    filtradas.forEach((l) => {
      const g = l[3] ?? ''
      if (!grupos.has(g)) grupos.set(g, [])
      grupos.get(g)!.push(l)
    })
    // ordem e cor oficiais de cada distribuidora (diretriz interna)
    const series: SerieLinha[] = [...grupos.keys()].sort(compararDistribuidoras).map((nome) => ({
      nome,
      cor: corDistribuidora(nome),
      valores: serieDe(
        grupos.get(nome)!,
        vinculo,
        porCentro.filter((l) => (l[3] ?? '') === nome),
      ).map((s) => s.v),
    }))
    return { rotulos: rot, faltas, series }
  }, [meses, serie, detalhe, area, vinculo, filtradas, porCentro, serieDe])

  // linhas da tabela vêm de todos os cargos escolhidos; o Total, só do que está na conta
  const cargos = useMemo(() => {
    const todos = tabelaCargos(doCargo, vinculo, meses, ultimoGeral, porCentro)
    const total = fora.length ? tabelaCargos(filtradas, vinculo, meses, ultimoGeral, porCentro).total : todos.total
    return { linhas: todos.linhas, total: total.map((t, i) => (semDetalhe.has(meses[i]) ? null : t)) }
  }, [doCargo, filtradas, porCentro, fora.length, vinculo, meses, ultimoGeral, semDetalhe])

  if (!compsArea.length || !ultimo || !primeiro) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Sem dados de {area}.</p>
  }

  const filiaisDaArea = UFS.filter((u) => daArea.some((l) => l[1] === u))
  const contexto = [
    anoAtivo,
    `Filial: ${ufs.length === 0 || ufs.length === filiaisDaArea.length ? 'Todas' : ufs.join(', ')}`,
    `CC: ${resumoSelecao(centrosValidos, opcoesCentro)}`,
    `Vínculo: ${vinculo === 'Ambos' ? 'Todos' : vinculo === 'CLT' ? 'CLT' : 'Terceirizados'}`,
    ...(macrosValidos.length ? [`Cargo: ${macrosValidos.join(', ')}`] : []),
    ...(fora.length ? [`${fora.length} ${fora.length === 1 ? 'cargo fora' : 'cargos fora'} da conta`] : []),
  ].join(' · ')
  const nomeFora = (id: string) => (id === '__terc' ? 'Terceirizados (INOVAR)' : id)
  const qtdFiltros = ufs.length + centrosValidos.length + macrosValidos.length + fora.length + (vinculo !== 'Ambos' ? 1 : 0) + (ano ? 1 : 0)
  const dif = fim.v != null && inicio.v != null && primeiro !== ultimo ? fim.v - inicio.v : null
  const notaCargo =
    area === 'Backoffice'
      ? ' (o Backoffice só tem cargo nos meses importados do sistema)'
      : area === 'Logística'
        ? ' (a Logística de 2025 nas planilhas manuais só tem total)'
        : ''

  return (
    <>
      <Card size="sm" className="lg:sticky lg:top-0 lg:z-20">
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <CampoFiltro rotulo="Ano">
              <Escolha rotulo="Ano" valor={anoAtivo} onMudar={setAno} opcoes={anos.map((a) => ({ value: a, label: a }))} />
            </CampoFiltro>
            <CampoFiltro rotulo="Filial">
              <EscolhaMulti
                rotulo="Filial (nenhuma marcada = todas)"
                valor={ufs}
                onMudar={setUfs}
                opcoes={UFS.filter((u) => daArea.some((l) => l[1] === u)).map((u) => ({ value: u, label: u, dica: ROTULO_UF[u] }))}
              />
            </CampoFiltro>
            <CampoFiltro rotulo={cc.nome} className="w-60">
              <FiltroMulti
                rotulo={cc.nome}
                valor={centrosValidos}
                onMudar={setCentros}
                opcoes={opcoesCentro}
                corGrupo={area === 'Comercial' ? corDistribuidora : undefined}
              />
            </CampoFiltro>
            <CampoFiltro rotulo="Cargo" className="w-48">
              <FiltroMulti rotulo="Cargo" valor={macrosValidos} onMudar={setMacros} opcoes={opcoesMacro} />
            </CampoFiltro>
            <CampoFiltro rotulo="Vínculo">
              <BotoesVinculo valor={vinculo} onMudar={setVinculo} />
            </CampoFiltro>
            {qtdFiltros > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => {
                  setAno(null)
                  setUfs([])
                  setCentros([])
                  setMacros([])
                  setFora([])
                  setVinculo('Ambos')
                }}
              >
                <RotateCcw data-icon="inline-start" /> Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label={`Indicadores de ${area}`}>
        <Indicador
          tom="destaque"
          icone={Users}
          rotulo={`Headcount em ${rotuloMes(ultimo)}${vinculo !== 'Ambos' ? `, só ${vinculo === 'CLT' ? 'CLT' : 'terceirizados'}` : ''}`}
          valor={fmtPessoas(fim.v ?? fim.bruto)}
          extra={<AvisoParcial itens={fim.faltas} claro />}
        />
        <Indicador
          icone={ArrowUpDown}
          rotulo={`Variação vs ${rotuloMes(primeiro)}`}
          valor={dif == null ? '—' : fmtVariacao(dif)}
          negativo={dif != null && dif < 0}
          apoio={
            dif == null
              ? inicio.faltas.length || fim.faltas.length
                ? 'Comparação indisponível: base incompleta'
                : 'sem base de comparação'
              : `${inicio.v ? `${dif > 0 ? '+' : ''}${fmtPct1(dif / inicio.v)}, ` : ''}de ${fmtPessoas(inicio.v)} para ${fmtPessoas(fim.v)}`
          }
        />
        <Indicador
          icone={UserRound}
          tom="despesa"
          rotulo={`Terceirizados em ${rotuloMes(ultimo)}`}
          valor={fmtPessoas(porVinculo.Terceirizado)}
          apoio={comVinculo ? `${fmtPct1(porVinculo.Terceirizado / comVinculo)} do quadro com vínculo informado` : 'sem vínculo informado'}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Evolução mensal de {area}</CardTitle>
          <CardDescription>{contexto}</CardDescription>
          <CardAction className="flex flex-wrap items-center justify-end gap-3">
            <span className="text-sm text-muted-foreground">Agrupar por</span>
            <Tabs value={detalhe} onValueChange={(v) => setDetalhe(v as Detalhe)}>
              <TabsList>
                {DETALHES[area].map((d) => (
                  <TabsTrigger key={d.value} value={d.value} className="px-3">
                    {d.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Switch id={`rotulos-${area}`} size="sm" checked={rotulos} onCheckedChange={setRotulos} />
              <Label htmlFor={`rotulos-${area}`} className="text-sm font-normal">
                Rótulos
              </Label>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <GraficoBarras
            rotulos={grafico.rotulos}
            dicas={meses.map(rotuloMes)}
            series={grafico.series}
            faltas={grafico.faltas}
            mostrarRotulos={rotulos}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evolução por cargo</CardTitle>
          <CardDescription>
            Cargos dos centros de custo selecionados, mês a mês, com a linha de terceirizados ao final. "—" é mês sem dado ou sem detalhamento
            por cargo{notaCargo}; * é parcial. Clique no nome de um cargo para tirá-lo da conta.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(fora.length > 0 || meses.some((c) => semDetalhe.has(c))) && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
              {meses.some((c) => semDetalhe.has(c)) && <span>Meses sem detalhamento por cargo ficam sem valor ("—").</span>}
              {fora.length > 0 && (
                <>
                  <span>
                    Fora da conta (total, gráfico e indicadores): <span className="text-foreground">{fora.map(nomeFora).join(', ')}</span>
                  </span>
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setFora([])}>
                    Voltar todos
                  </Button>
                </>
              )}
            </div>
          )}
          {cargos.linhas.length || cargos.total.some((t) => t != null) ? (
            <TabelaCargos linhas={cargos.linhas} total={cargos.total} meses={meses} fora={foraSet} onAlternar={alternarFora} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum dado com os filtros atuais.</p>
          )}
        </CardContent>
      </Card>
    </>
  )
}
