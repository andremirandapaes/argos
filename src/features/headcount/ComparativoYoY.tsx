import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info, Minus } from 'lucide-react'
import { compararDistribuidoras, corDistribuidora } from '@/lib/distribuidoras'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AREAS,
  ROTULO_UF,
  UFS,
  atendeVinculo,
  filtrar,
  FILTROS_VAZIOS,
  intervaloMeses,
  rotuloMes,
  serieTotal,
  type Area,
  type FiltroVinculo,
  type Linha,
} from './regras'
import { BotoesVinculo, CampoFiltro, Escolha, EscolhaMulti, fmtPct1, fmtPessoas, fmtVariacao } from './componentes'
import { GraficoLinhas } from './GraficoLinhas'

const COR_AREA: Record<Area, string> = { Comercial: 'var(--hc-comercial)', Logística: 'var(--hc-logistica)', Backoffice: 'var(--hc-backoffice)' }

/** "2026-09" → "2025-09" */
const anoAnterior = (c: string) => `${Number(c.slice(0, 4)) - 1}${c.slice(4)}`

type Agrupar = 'area-filial' | 'distribuidora' | 'departamento' | 'cargo'
const AGRUPAR: { value: Agrupar; label: string }[] = [
  { value: 'area-filial', label: 'Área e filial' },
  { value: 'distribuidora', label: 'Distribuidora' },
  { value: 'departamento', label: 'Departamento' },
  { value: 'cargo', label: 'Cargo' },
]

type Comparacao = { antes: number | null; agora: number | null; faltas: string[] }
type ItemRanking = { nome: string; cor?: string; antes: number; agora: number; dif: number; novo: boolean; saiu: boolean }

/** Antes × agora de um conjunto de linhas, com a mesma regra de base completa do painel. */
function comparar(linhas: readonly Linha[], vinculo: FiltroVinculo, mes: string, ultimo?: string): Comparacao {
  const anterior = anoAnterior(mes)
  const [a, b] = serieTotal(linhas, vinculo, [anterior, mes], ultimo)
  return { antes: a.v, agora: b.v, faltas: [...a.faltas.map((f) => `${rotuloMes(anterior)}: ${f}`), ...b.faltas.map((f) => `${rotuloMes(mes)}: ${f}`)] }
}

function Variacao({ dif, base, grande = false }: { dif: number | null; base: number | null; grande?: boolean }) {
  if (dif == null) return <span className="text-muted-foreground">—</span>
  const Icone = dif > 0 ? ArrowUpRight : dif < 0 ? ArrowDownRight : Minus
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tabular-nums',
        grande ? 'text-sm' : 'text-xs',
        dif > 0 ? 'bg-positivo/12 text-positivo' : dif < 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
      )}
    >
      <Icone className={grande ? 'size-4' : 'size-3.5'} />
      {fmtVariacao(dif)}
      {base ? <span className="font-medium opacity-80">· {fmtPct1(dif / base)}</span> : null}
    </span>
  )
}

/** Comparativo ano contra ano: mesmo mês do ano anterior, mês a mês e onde o quadro mudou. */
export function ComparativoYoY({ linhas, comps }: { linhas: readonly Linha[]; comps: string[] }) {
  const ultimoGeral = comps.at(-1)
  // meses que têm o mesmo mês do ano anterior na base
  const mesesComparaveis = useMemo(() => comps.filter((c) => comps.includes(anoAnterior(c))).reverse(), [comps])
  const [mesEscolhido, setMesEscolhido] = useState<string | null>(null)
  const mes = mesEscolhido && mesesComparaveis.includes(mesEscolhido) ? mesEscolhido : mesesComparaveis[0]
  const [area, setArea] = useState<'Todas' | Area>('Todas')
  const [ufs, setUfs] = useState<string[]>([])
  const [vinculo, setVinculo] = useState<FiltroVinculo>('Ambos')
  const [agrupar, setAgrupar] = useState<Agrupar>('area-filial')
  const [verTodos, setVerTodos] = useState(false)
  const [rotulos, setRotulos] = useState(false)

  const filtradas = useMemo(
    () => filtrar(linhas, { ...FILTROS_VAZIOS, ufs, areas: area === 'Todas' ? [] : [area] }),
    [linhas, ufs, area],
  )

  const total = useMemo(() => (mes ? comparar(filtradas, vinculo, mes, ultimoGeral) : null), [filtradas, vinculo, mes, ultimoGeral])
  const porArea = useMemo(
    () =>
      mes
        ? AREAS.filter((a) => area === 'Todas' || a === area).map((a) => ({
            area: a,
            ...comparar(
              filtradas.filter((l) => l[2] === a),
              vinculo,
              mes,
              ultimoGeral,
            ),
          }))
        : [],
    [filtradas, vinculo, mes, ultimoGeral, area],
  )

  // mês a mês: ano de referência × ano anterior (Jan–Dez)
  const grafico = useMemo(() => {
    if (!mes) return null
    const ano = mes.slice(0, 4)
    const anterior = String(Number(ano) - 1)
    const mesesAno = intervaloMeses(`${ano}-01`, `${ano}-12`)
    const mesesAnt = intervaloMeses(`${anterior}-01`, `${anterior}-12`)
    const agora = serieTotal(filtradas, vinculo, mesesAno, ultimoGeral)
    const antes = serieTotal(filtradas, vinculo, mesesAnt, ultimoGeral)
    return {
      rotulos: mesesAno.map((c) => rotuloMes(c).slice(0, 3)),
      faltas: mesesAno.map((_, i) => [
        ...antes[i].faltas.map((f) => `${anterior}: ${f}`),
        ...agora[i].faltas.map((f) => `${ano}: ${f}`),
      ]),
      series: [
        { nome: anterior, cor: 'var(--muted-foreground)', tracejado: true, valores: antes.map((s) => s.v) },
        { nome: ano, cor: 'var(--primary)', destaque: true, valores: agora.map((s) => s.v) },
      ],
      difs: mesesAno.map((c, i) => ({
        mes: c,
        dif: antes[i].v != null && agora[i].v != null ? agora[i].v! - antes[i].v! : null,
        futuro: !comps.includes(c),
      })),
    }
  }, [filtradas, vinculo, mes, ultimoGeral, comps])

  // onde mudou: ranking de variações
  const ranking = useMemo(() => {
    if (!mes) return { itens: [] as ItemRanking[], incomparaveis: [] as string[], aviso: null as string | null }
    const anterior = anoAnterior(mes)
    let escopo = filtradas
    let chave: (l: Linha) => string | null
    let aviso: string | null = null
    if (agrupar === 'area-filial') chave = (l) => `${l[2]} ${l[1]}`
    else if (agrupar === 'distribuidora') {
      escopo = filtradas.filter((l) => l[2] === 'Comercial')
      chave = (l) => l[3]
    } else if (agrupar === 'departamento') {
      escopo = filtradas.filter((l) => l[2] === 'Backoffice')
      chave = (l) => l[5]
    } else {
      chave = (l) => (l[7] === 'Terceirizado' ? 'Terceirizados' : l[6])
      // sem detalhamento por cargo em algum dos meses: não dá para comparar cargo a cargo
      const semCargo = [anterior, mes].filter((c) => escopo.some((l) => l[0] === c && l[7] !== 'Terceirizado' && !l[6]))
      if (semCargo.length) aviso = `Sem detalhamento por cargo em ${semCargo.map(rotuloMes).join(' e ')} para parte da base: esses cargos aparecem só com o que tem detalhe.`
    }
    const grupos = new Map<string, Linha[]>()
    for (const l of escopo) {
      if (l[0] !== mes && l[0] !== anterior) continue
      const k = chave(l)
      if (!k) continue
      if (!grupos.has(k)) grupos.set(k, [])
      grupos.get(k)!.push(l)
    }
    const itens: ItemRanking[] = []
    const incomparaveis: string[] = []
    for (const [nome, ls] of grupos) {
      // completude do mês pela base do escopo (cargo/distribuidora ausente no mês = não existia)
      const c = agrupar === 'area-filial' ? comparar(ls, vinculo, mes, ultimoGeral) : null
      if (c && c.faltas.length) {
        incomparaveis.push(nome)
        continue
      }
      const soma = (m: string) => ls.filter((l) => l[0] === m && atendeVinculo(l, vinculo)).reduce((s, l) => s + l[8], 0)
      const antes = soma(anterior)
      const agora = soma(mes)
      if (!antes && !agora) continue
      itens.push({
        nome,
        cor: agrupar === 'distribuidora' ? corDistribuidora(nome) : agrupar === 'area-filial' ? COR_AREA[nome.split(' ')[0] as Area] : undefined,
        antes,
        agora,
        dif: agora - antes,
        novo: antes === 0,
        saiu: agora === 0,
      })
    }
    itens.sort((a, b) => b.dif - a.dif || (agrupar === 'distribuidora' ? compararDistribuidoras(a.nome, b.nome) : a.nome.localeCompare(b.nome)))
    return { itens, incomparaveis, aviso }
  }, [filtradas, vinculo, mes, ultimoGeral, agrupar])

  if (!mes || !total || !grafico) {
    return (
      <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Ainda não há dois anos de base para comparar (é preciso ter o mesmo mês no ano anterior).
      </p>
    )
  }

  const anterior = anoAnterior(mes)
  const dif = total.antes != null && total.agora != null ? total.agora - total.antes : null
  const maxAbs = Math.max(1, ...ranking.itens.map((i) => Math.abs(i.dif)))
  const LIMITE = 12
  const visiveis = verTodos ? ranking.itens : ranking.itens.slice(0, LIMITE)
  const aumentos = ranking.itens.filter((i) => i.dif > 0).reduce((s, i) => s + i.dif, 0)
  const reducoes = ranking.itens.filter((i) => i.dif < 0).reduce((s, i) => s + i.dif, 0)

  return (
    <>
      {/* filtros */}
      <Card size="sm" className="lg:sticky lg:top-0 lg:z-20">
        <CardContent className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <CampoFiltro rotulo="Mês de referência">
            <Select value={mes} onValueChange={(v) => v && setMesEscolhido(v)} items={mesesComparaveis.map((c) => ({ value: c, label: `${rotuloMes(c)} vs ${rotuloMes(anoAnterior(c))}` }))}>
              <SelectTrigger className="h-9 w-44" aria-label="Mês de referência">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {mesesComparaveis.map((c) => (
                    <SelectItem key={c} value={c}>
                      {rotuloMes(c)} vs {rotuloMes(anoAnterior(c))}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </CampoFiltro>
          <CampoFiltro rotulo="Área">
            <Escolha
              rotulo="Área"
              valor={area}
              onMudar={setArea}
              opcoes={[{ value: 'Todas' as const, label: 'Todas' }, ...AREAS.map((a) => ({ value: a, label: a }))]}
            />
          </CampoFiltro>
          <CampoFiltro rotulo="Filial">
            <EscolhaMulti
              rotulo="Filial (nenhuma marcada = AM e RR)"
              valor={ufs}
              onMudar={setUfs}
              opcoes={UFS.map((u) => ({ value: u, label: u, dica: ROTULO_UF[u] }))}
            />
          </CampoFiltro>
          <CampoFiltro rotulo="Vínculo">
            <BotoesVinculo valor={vinculo} onMudar={setVinculo} />
          </CampoFiltro>
        </CardContent>
      </Card>

      {/* destaque: mês × mesmo mês do ano anterior */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5" aria-label="Comparativo do mês">
        <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-kpi-destaque-de to-kpi-destaque-ate p-6 text-kpi-destaque-texto shadow-destaque ring-1 ring-kpi-destaque-texto/10 xl:col-span-2">
          <span aria-hidden className="pointer-events-none absolute -top-12 -right-12 size-40 rounded-full bg-kpi-destaque-brilho opacity-20 blur-2xl" />
          <div className="relative flex flex-col gap-4">
            <span className="text-[11px] font-semibold tracking-wider text-kpi-destaque-texto/75 uppercase">
              Headcount · {rotuloMes(mes)} vs {rotuloMes(anterior)}
            </span>
            <div className="flex items-end gap-4">
              <div className="flex flex-col">
                <span className="text-xs text-kpi-destaque-texto/75">{rotuloMes(anterior)}</span>
                <span className="text-2xl font-semibold text-kpi-destaque-texto/75 tabular-nums">{fmtPessoas(total.antes)}</span>
              </div>
              <ArrowRight className="mb-1.5 size-5 text-kpi-destaque-texto/60" />
              <div className="flex flex-col">
                <span className="text-xs text-kpi-destaque-texto/75">{rotuloMes(mes)}</span>
                <span className="text-4xl leading-none font-bold tracking-tight tabular-nums">{fmtPessoas(total.agora)}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {dif != null ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums',
                    dif > 0 ? 'bg-kpi-destaque-positivo/15 text-kpi-destaque-positivo' : dif < 0 ? 'bg-kpi-destaque-negativo/15 text-kpi-destaque-negativo' : 'bg-kpi-destaque-texto/10 text-kpi-destaque-texto/80',
                  )}
                >
                  {dif > 0 ? <ArrowUpRight className="size-4" /> : dif < 0 ? <ArrowDownRight className="size-4" /> : <Minus className="size-4" />}
                  {fmtVariacao(dif)} {total.antes ? `· ${fmtPct1(dif / total.antes)}` : ''}
                </span>
              ) : (
                <span className="text-sm text-kpi-destaque-alerta">Comparação indisponível: base incompleta</span>
              )}
              <span className="text-xs text-kpi-destaque-texto/75">em 12 meses</span>
            </div>
            {total.faltas.length > 0 && (
              <p className="text-xs text-kpi-destaque-alerta" title={total.faltas.join('\n')}>
                {total.faltas[0]}
                {total.faltas.length > 1 ? ` e mais ${total.faltas.length - 1}` : ''}
              </p>
            )}
          </div>
        </div>
        <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-3 xl:col-span-3', porArea.length === 1 && 'sm:grid-cols-1')}>
          {porArea.map((a) => {
            const d = a.antes != null && a.agora != null ? a.agora - a.antes : null
            return (
              <div key={a.area} className="relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 pl-5 shadow-card">
                <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: COR_AREA[a.area] }} />
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{a.area}</span>
                <div className="flex items-baseline gap-2 tabular-nums">
                  <span className="text-sm text-muted-foreground">{fmtPessoas(a.antes)}</span>
                  <ArrowRight className="size-3.5 self-center text-muted-foreground" />
                  <span className="text-[22px] leading-tight font-semibold">{fmtPessoas(a.agora)}</span>
                </div>
                <div>
                  {d != null ? (
                    <Variacao dif={d} base={a.antes} />
                  ) : (
                    <span className="text-xs text-alerta-foreground" title={a.faltas.join('\n')}>
                      Base incompleta
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* mês a mês */}
      <Card>
        <CardHeader>
          <CardTitle>
            Mês a mês: {Number(mes.slice(0, 4)) - 1} × {mes.slice(0, 4)}
          </CardTitle>
          <CardDescription>Ano anterior tracejado. Meses com base faltando ficam sem ponto, para não parecer variação.</CardDescription>
          <CardAction className="flex items-center gap-2">
            <Switch id="rotulos-yoy" size="sm" checked={rotulos} onCheckedChange={setRotulos} />
            <Label htmlFor="rotulos-yoy" className="text-sm font-normal">
              Rótulos
            </Label>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <GraficoLinhas rotulos={grafico.rotulos} series={grafico.series} faltas={grafico.faltas} altura="h-64" escalaAjustada mostrarRotulos={rotulos} />
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12" aria-label="Variação de cada mês">
            {grafico.difs.map((d) => (
              <div
                key={d.mes}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-md border px-1 py-1.5',
                  d.mes === mes && 'border-primary ring-1 ring-primary/30',
                  d.futuro && 'opacity-40',
                )}
              >
                <span className="text-[10px] font-medium text-muted-foreground uppercase">{rotuloMes(d.mes).slice(0, 3)}</span>
                <span
                  className={cn(
                    'text-xs font-semibold tabular-nums',
                    d.dif == null ? 'text-muted-foreground' : d.dif > 0 ? 'text-positivo' : d.dif < 0 ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {d.dif == null ? '—' : fmtVariacao(d.dif)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* onde mudou */}
      <Card>
        <CardHeader>
          <CardTitle>Onde o quadro mudou</CardTitle>
          <CardDescription>
            {rotuloMes(anterior)} → {rotuloMes(mes)}: aumentos à direita, reduções à esquerda.
            {ranking.itens.length > 0 && (
              <>
                {' '}
                <span className="text-positivo">+{fmtPessoas(aumentos)}</span> em aumentos ·{' '}
                <span className="text-destructive">{fmtVariacao(reducoes)}</span> em reduções.
              </>
            )}
          </CardDescription>
          <CardAction>
            <Escolha rotulo="Agrupar por" valor={agrupar} onMudar={setAgrupar} opcoes={AGRUPAR} />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {ranking.aviso && (
            <p className="flex items-start gap-1.5 text-xs text-alerta-foreground">
              <Info className="mt-px size-3.5 shrink-0" />
              {ranking.aviso}
            </p>
          )}
          {ranking.itens.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nada para comparar com os filtros atuais.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              <li className="grid grid-cols-[minmax(0,13rem)_4rem_4rem_1fr_7.5rem] items-center gap-3 px-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                <span />
                <span className="text-right">{rotuloMes(anterior)}</span>
                <span className="text-right">{rotuloMes(mes)}</span>
                <span className="text-center">Variação</span>
                <span />
              </li>
              {visiveis.map((i) => {
                const largura = `${(Math.abs(i.dif) / maxAbs) * 50}%`
                return (
                  <li key={i.nome} className="grid grid-cols-[minmax(0,13rem)_4rem_4rem_1fr_7.5rem] items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                    <span className="flex min-w-0 items-center gap-1.5 text-sm">
                      {i.cor && <span className="size-2 shrink-0 rounded-full" style={{ background: i.cor }} />}
                      <span className="truncate" title={i.nome}>
                        {i.nome}
                      </span>
                      {i.novo && <Badge variant="secondary" className="h-4 px-1 text-[10px]">novo</Badge>}
                      {i.saiu && <Badge variant="secondary" className="h-4 px-1 text-[10px]">zerou</Badge>}
                    </span>
                    <span className="text-right text-sm text-muted-foreground tabular-nums">{fmtPessoas(i.antes)}</span>
                    <span className="text-right text-sm font-medium tabular-nums">{fmtPessoas(i.agora)}</span>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <div className="relative h-5">
                            <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-border" />
                            {i.dif !== 0 && (
                              <span
                                className={cn('absolute inset-y-0.5 rounded-sm', i.dif > 0 ? 'left-1/2 bg-positivo/70' : 'right-1/2 bg-destructive/60')}
                                style={{ width: largura }}
                              />
                            )}
                          </div>
                        }
                      />
                      <TooltipContent>
                        {i.nome}: {fmtPessoas(i.antes)} → {fmtPessoas(i.agora)} ({fmtVariacao(i.dif)})
                      </TooltipContent>
                    </Tooltip>
                    <span className="justify-self-end">
                      <Variacao dif={i.dif} base={i.antes || null} />
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          {ranking.itens.length > LIMITE && (
            <Button variant="ghost" size="sm" className="self-center" onClick={() => setVerTodos((v) => !v)}>
              {verTodos ? 'Mostrar só os 12 maiores' : `Ver todos (${ranking.itens.length})`}
            </Button>
          )}
          {ranking.incomparaveis.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Sem comparação por base incompleta em um dos meses: {ranking.incomparaveis.join(', ')}.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" />
        Os dois anos seguem as regras do painel. Meses de 2025 sem exportação do sistema vêm das planilhas manuais; diferenças de critério entre as
        fontes (ex.: Backoffice RR só existe nos meses com exportação do sistema) aparecem como variação.
      </p>
    </>
  )
}
