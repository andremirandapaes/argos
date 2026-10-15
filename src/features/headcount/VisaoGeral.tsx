import { useMemo, useState } from 'react'
import { ArrowUpDown, CalendarRange, ChevronDown, Info, ListFilter, RotateCcw, UserRound, Users } from 'lucide-react'
import { compararDistribuidoras, corDistribuidora } from '@/lib/distribuidoras'
import { cn } from '@/lib/utils'
import { Indicador } from '@/components/Indicador'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AREAS,
  FILTROS_VAZIOS,
  ROTULO_UF,
  UFS,
  arvoreDetalhamento,
  cobertura,
  composicao,
  filtrar,
  intervaloMeses,
  mesAnterior,
  rotuloMes,
  somarPorMes,
  type Celula,
  type FiltroVinculo,
  type Filtros,
  type Linha,
  type Vinculo,
} from './regras'
import { AvisoParcial, BotoesVinculo, CampoFiltro, Escolha, EscolhaMulti, FiltroMulti, fmtPct1, fmtPessoas, fmtVariacao } from './componentes'
import { GraficoLinhas, type SerieLinha } from './GraficoLinhas'
import { GraficoComposicao } from './GraficoComposicao'
import { TabelaDetalhamento } from './Tabelas'

const COR_AREA: Record<string, string> = {
  Comercial: 'var(--hc-comercial)',
  Logística: 'var(--hc-logistica)',
  Backoffice: 'var(--hc-backoffice)',
}

const unicos = (linhas: readonly Linha[], i: 3 | 4 | 6) =>
  [...new Set(linhas.map((l) => l[i]).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b))

/** Visão geral: todas as áreas, com filtros de período, estado, área, distribuidora, centro, cargo e vínculo. */
export function VisaoGeral({ linhas, comps }: { linhas: readonly Linha[]; comps: string[] }) {
  // ano: null = o mais recente; o período é do primeiro ao último mês com dado no ano
  const anos = useMemo(() => [...new Set(comps.map((c) => c.slice(0, 4)))], [comps])
  const [ano, setAno] = useState<string | null>(null)
  const anoAtivo = ano && anos.includes(ano) ? ano : anos.at(-1)!
  const doAno = comps.filter((c) => c.startsWith(anoAtivo))
  const de = doAno[0]
  const ate = doAno.at(-1)!
  const [maisFiltros, setMaisFiltros] = useState(false)
  const [rotulos, setRotulos] = useState(true)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS)
  const [vinculo, setVinculo] = useState<FiltroVinculo>('Ambos')
  const [agrupar, setAgrupar] = useState<'area' | 'estado' | 'area-estado'>('area-estado')
  const ultimoGeral = comps.at(-1)

  const meses = useMemo(() => intervaloMeses(de, ate), [de, ate])
  const filtradas = useMemo(() => filtrar(linhas, filtros), [linhas, filtros])
  const cob = useMemo(() => cobertura(filtradas, vinculo, ultimoGeral), [filtradas, vinculo, ultimoGeral])

  // opções dos filtros encadeadas (distribuidora depende de estado/área; centro da distribuidora; cargo de tudo)
  const opcoes = useMemo(
    () => ({
      dists: unicos(filtrar(linhas, { ...filtros, dists: [], centros: [], cargos: [] }), 3).sort(compararDistribuidoras),
      centros: unicos(filtrar(linhas, { ...filtros, centros: [], cargos: [] }), 4),
      cargos: unicos(filtrar(linhas, { ...filtros, cargos: [] }), 6),
    }),
    [linhas, filtros],
  )

  // total do mês: sem valor quando falta alguma base (com a lista do que falta)
  const valorMes = useMemo(() => {
    const tot = somarPorMes(filtradas, vinculo).get('total') || new Map<string, number>()
    return (c: string) => {
      const faltas = cob.faltas(c)
      if (cob.segmentos.every((s) => cob.status(s, c) === 'fora')) return { v: tot.get(c) ?? null, faltas: [] as string[] }
      return { v: tot.get(c) ?? (faltas.length ? null : 0), faltas }
    }
  }, [filtradas, vinculo, cob])

  const atual = valorMes(ate)
  const anterior = mesAnterior(ate)
  const doAnterior = comps.includes(anterior) ? valorMes(anterior) : { v: null, faltas: [] }
  const doInicio = valorMes(de)
  const porVinculo = useMemo(() => {
    const r: Record<Vinculo, number> = { CLT: 0, Terceirizado: 0, 'Não informado': 0 }
    filtradas.forEach((l) => {
      if (l[0] === ate) r[l[7]] += l[8]
    })
    return r
  }, [filtradas, ate])
  const comVinculo = porVinculo.CLT + porVinculo.Terceirizado
  const pctTerc = comVinculo ? porVinculo.Terceirizado / comVinculo : null

  // gráfico: total + uma linha por área (quando há mais de uma)
  const grafico = useMemo(() => {
    const faltas = meses.map((c) => cob.faltas(c))
    const totais = meses.map(valorMes)
    const total: SerieLinha = {
      nome: 'Total',
      cor: 'var(--hc-total)',
      destaque: true,
      valores: totais.map((t) => (t.faltas.length ? null : (t.v ?? null))),
    }
    const series: SerieLinha[] = []
    const areas = AREAS.filter((a) => filtradas.some((l) => l[2] === a))
    if (areas.length > 1) {
      const porArea = somarPorMes(filtradas, vinculo, (l) => l[2])
      areas.forEach((a) => {
        const segs = cob.segmentos.filter((s) => s.startsWith(a + '|'))
        const valores = meses.map((c) => {
          const st = segs.map((s) => cob.status(s, c))
          const v = porArea.get(a)?.get(c)
          if (st.every((s) => s === 'fora')) return v ?? null
          return st.some((s) => s === 'sem dado' || s === 'sem vínculo') ? null : (v ?? 0)
        })
        series.push({ nome: a, cor: COR_AREA[a], valores })
      })
    }
    return { rotulos: meses.map(rotuloMes), total, areas: series, faltas }
  }, [meses, cob, valorMes, filtradas, vinculo])

  const grupos = useMemo(
    () =>
      composicao(filtradas, ate, agrupar).map(
        ([g, v]) =>
          [
            g,
            {
              CLT: vinculo === 'Terceirizado' ? 0 : v.CLT,
              Terceirizado: vinculo === 'CLT' ? 0 : v.Terceirizado,
              'Não informado': vinculo === 'Ambos' ? v['Não informado'] : 0,
            },
          ] as [string, Record<Vinculo, number>],
      ),
    [filtradas, ate, agrupar, vinculo],
  )
  const temNaoInformado = grupos.some(([, v]) => v['Não informado'] > 0)

  const arvore = useMemo(() => arvoreDetalhamento(filtradas, vinculo, meses, cob), [filtradas, vinculo, meses, cob])
  const totaisArvore = useMemo<Celula[]>(
    () =>
      meses.map((c) => {
        const t = valorMes(c)
        return t.v == null ? null : t.faltas.length ? { v: t.v, parcial: true } : t.v
      }),
    [meses, valorMes],
  )

  // período: Todos / um ano / personalizado
  const qtdMais = filtros.areas.length + filtros.dists.length + filtros.centros.length + filtros.cargos.length
  const qtdFiltros = qtdMais + filtros.ufs.length + (vinculo !== 'Ambos' ? 1 : 0) + (ano ? 1 : 0)
  const soComercial = filtros.dists.length > 0 || filtros.centros.length > 0
  const soVinculo = vinculo !== 'Ambos' ? `, só ${vinculo === 'CLT' ? 'CLT' : 'terceirizados'}` : ''

  const variacao = (atualV: number | null, base: number | null, faltas: string[]) => {
    const dif = !faltas.length && atualV != null && base != null ? atualV - base : null
    return {
      valor: dif == null ? '—' : fmtVariacao(dif),
      negativo: dif != null && dif < 0,
      apoio: faltas.length
        ? 'Comparação indisponível: base incompleta'
        : dif == null
          ? 'sem base de comparação'
          : `${base ? `${dif > 0 ? '+' : ''}${fmtPct1(dif / base)}, ` : ''}de ${fmtPessoas(base)} para ${fmtPessoas(atualV)}`,
    }
  }
  const vsAnterior = variacao(atual.v, doAnterior.v, [...new Set([...atual.faltas, ...doAnterior.faltas])])
  const vsInicio = variacao(atual.v, de === ate ? null : doInicio.v, [...new Set([...atual.faltas, ...doInicio.faltas])])

  return (
    <>
      {/* filtros: ano, filial e vínculo sempre à mostra; o resto em "Mais filtros" */}
      <Card size="sm" className="lg:sticky lg:top-0 lg:z-20">
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <CampoFiltro rotulo="Ano">
              <Escolha rotulo="Ano" valor={anoAtivo} onMudar={setAno} opcoes={anos.map((a) => ({ value: a, label: a }))} />
            </CampoFiltro>
            <CampoFiltro rotulo="Filial">
              <EscolhaMulti
                rotulo="Filial (nenhuma marcada = AM e RR)"
                valor={filtros.ufs}
                onMudar={(ufs) => setFiltros({ ...filtros, ufs })}
                opcoes={UFS.map((u) => ({ value: u, label: u, dica: ROTULO_UF[u] }))}
              />
            </CampoFiltro>
            <CampoFiltro rotulo="Vínculo">
              <BotoesVinculo valor={vinculo} onMudar={setVinculo} />
            </CampoFiltro>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {qtdFiltros > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFiltros(FILTROS_VAZIOS)
                    setVinculo('Ambos')
                    setAno(null)
                  }}
                >
                  <RotateCcw data-icon="inline-start" /> Limpar filtros
                </Button>
              )}
              <Button
                variant={qtdMais > 0 ? 'secondary' : 'outline'}
                className="h-9"
                aria-expanded={maisFiltros}
                onClick={() => setMaisFiltros((m) => !m)}
              >
                <ListFilter data-icon="inline-start" />
                Mais filtros
                {qtdMais > 0 && (
                  <Badge className="ml-0.5 h-5 min-w-5 justify-center rounded-full px-1.5 tabular-nums">{qtdMais}</Badge>
                )}
                <ChevronDown data-icon="inline-end" className={cn('transition-transform', maisFiltros && 'rotate-180')} />
              </Button>
            </div>
          </div>

          {maisFiltros && (
            <div className="flex flex-col gap-3 border-t pt-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <CampoFiltro rotulo="Área">
                  <FiltroMulti
                    rotulo="Área"
                    valor={filtros.areas}
                    onMudar={(areas) => setFiltros({ ...filtros, areas })}
                    opcoes={AREAS.map((a) => ({ value: a, label: a }))}
                  />
                </CampoFiltro>
                <CampoFiltro rotulo="Distribuidora">
                  <FiltroMulti
                    rotulo="Distribuidora"
                    valor={filtros.dists}
                    onMudar={(dists) => setFiltros({ ...filtros, dists })}
                    opcoes={opcoes.dists.map((d) => ({ value: d, label: d, cor: corDistribuidora(d) }))}
                  />
                </CampoFiltro>
                <CampoFiltro rotulo="Centro">
                  <FiltroMulti
                    rotulo="Centro"
                    valor={filtros.centros}
                    onMudar={(centros) => setFiltros({ ...filtros, centros })}
                    opcoes={opcoes.centros.map((d) => ({ value: d, label: d }))}
                  />
                </CampoFiltro>
                <CampoFiltro rotulo="Cargo">
                  <FiltroMulti
                    rotulo="Cargo"
                    valor={filtros.cargos}
                    onMudar={(cargos) => setFiltros({ ...filtros, cargos })}
                    opcoes={opcoes.cargos.map((d) => ({ value: d, label: d }))}
                  />
                </CampoFiltro>
              </div>
              {(soComercial || filtros.cargos.length > 0) && (
                <div className="flex flex-wrap gap-2">
                  {soComercial && <Badge variant="secondary">Distribuidora e centro existem só no Comercial</Badge>}
                  {!soComercial && filtros.cargos.length > 0 && <Badge variant="secondary">Meses sem detalhamento por cargo saem da visão</Badge>}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* indicadores */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">
        <Indicador
          tom="destaque"
          icone={Users}
          rotulo={`Headcount em ${rotuloMes(ate)}${soVinculo}`}
          valor={fmtPessoas(atual.v)}
          apoio={
            vinculo === 'Ambos' && atual.v != null
              ? `CLT ${fmtPessoas(porVinculo.CLT)} · Terceirizados ${fmtPessoas(porVinculo.Terceirizado)}${porVinculo['Não informado'] ? ` · N/I ${fmtPessoas(porVinculo['Não informado'])}` : ''}`
              : undefined
          }
          extra={<AvisoParcial itens={atual.faltas} claro />}
        />
        <Indicador
          icone={ArrowUpDown}
          rotulo={`Variação vs ${rotuloMes(anterior)}`}
          valor={vsAnterior.valor}
          negativo={vsAnterior.negativo}
          apoio={vsAnterior.apoio}
          extra={<AvisoParcial itens={[...new Set([...atual.faltas, ...doAnterior.faltas])]} />}
        />
        <Indicador
          icone={CalendarRange}
          rotulo={`Variação vs ${rotuloMes(de)} (início)`}
          valor={vsInicio.valor}
          negativo={vsInicio.negativo}
          apoio={vsInicio.apoio}
          extra={<AvisoParcial itens={[...new Set([...atual.faltas, ...doInicio.faltas])]} />}
        />
        <Indicador
          icone={UserRound}
          tom="despesa"
          rotulo={`Terceirizados em ${rotuloMes(ate)}`}
          valor={fmtPct1(pctTerc)}
          apoio={`${fmtPessoas(porVinculo.Terceirizado)} de ${fmtPessoas(comVinculo)} com vínculo informado`}
          extra={
            <>
              {porVinculo['Não informado'] > 0 && (
                <AvisoParcial itens={[`${fmtPessoas(porVinculo['Não informado'])} sem vínculo informado ficaram fora do cálculo`]} />
              )}
              {vinculo !== 'Ambos' && <p className="text-xs text-muted-foreground">Este indicador ignora o filtro de vínculo.</p>}
            </>
          }
        />
      </section>

      {/* gráficos */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Evolução mensal</CardTitle>
            <CardDescription>
              Meses em que falta alguma base ficam sem ponto, para não parecer queda de headcount. Passe o mouse sobre o mês para ver o que
              falta.
            </CardDescription>
            <CardAction className="flex items-center gap-2">
              <Switch id="rotulos-geral" size="sm" checked={rotulos} onCheckedChange={setRotulos} />
              <Label htmlFor="rotulos-geral" className="text-sm font-normal">
                Rótulos
              </Label>
            </CardAction>
          </CardHeader>
          <CardContent>
            <GraficoLinhas rotulos={grafico.rotulos} series={[grafico.total]} faltas={grafico.faltas} altura="h-56" mostrarRotulos={rotulos} />
            {/* um gráfico pequeno por área, cada um na sua escala (a variação de cada área fica visível) */}
            {grafico.areas.length > 0 && (
              <div className="mt-5 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-3">
                {grafico.areas.map((a) => {
                  const ultimoValor = a.valores.at(-1)
                  return (
                    <div key={a.nome} className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                          <span className="size-2 rounded-full" style={{ background: a.cor }} />
                          {a.nome}
                        </span>
                        <span className="text-sm font-semibold tabular-nums" title={`em ${rotuloMes(ate)}`}>
                          {fmtPessoas(ultimoValor)}
                        </span>
                      </div>
                      <GraficoLinhas
                        compacto
                        altura={rotulos ? 'h-32' : 'h-28'}
                        mostrarRotulos={rotulos}
                        rotulos={grafico.rotulos}
                        series={[a]}
                        faltas={grafico.faltas.map((f) => f.filter((x) => x.startsWith(a.nome)))}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Composição em {rotuloMes(ate)}</CardTitle>
            <CardDescription>CLT e terceirizados empilhados</CardDescription>
            <CardAction>
              <Escolha
                rotulo="Agrupar por"
                valor={agrupar}
                onMudar={setAgrupar}
                opcoes={[
                  { value: 'area', label: 'Área' },
                  { value: 'estado', label: 'Filial' },
                  { value: 'area-estado', label: 'Área e filial' },
                ]}
              />
            </CardAction>
          </CardHeader>
          <CardContent>
            {grupos.length ? (
              <GraficoComposicao grupos={grupos} mostrarNaoInformado={temNaoInformado} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">Sem dados para {rotuloMes(ate)} com os filtros atuais.</p>
            )}
            <p className="mt-5 flex items-start gap-1.5 border-t pt-3 text-xs text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" />
              Este painel desconsidera Dunorte Professional, Abastex e Diretoria.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* detalhamento */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento mensal</CardTitle>
          <CardDescription>
            Abra cada área para descer até estado, distribuidora, centro e cargo (Comercial), cargo (Logística) ou departamento
            (Backoffice). "—" é mês sem dado ou sem detalhamento por cargo; * é total parcial; célula vazia é distribuidora ou departamento
            que ainda não existia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {arvore.length ? (
            <TabelaDetalhamento key={`${de}-${ate}`} nos={arvore} meses={meses} totais={totaisArvore} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum dado com os filtros atuais. Limpe algum filtro para ver a tabela.</p>
          )}
        </CardContent>
      </Card>
    </>
  )
}
