import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Minus, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { DISTRIBUIDORAS, compararDistribuidoras, corDistribuidora } from '@/lib/distribuidoras'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { useMesesTerceirizados } from '../api'
import { AREAS, ROTULO_UF, UFS, intervaloMeses, rotuloMes, type Area, type Linha, type UF } from '../regras'
import { Escolha, fmtPessoas } from '../componentes'
import { useSalvarTerceirizados, type ItemTerceirizado } from './api-terceirizados'

type Item = { id: number; uf: UF; area: Area; dist: string | null; centro: string | null; dept: string | null; q: number }

const SETORES = ['Depósito', 'Distribuição']
const CENTROS_COMERCIAL = ['Merchan', 'Vendas']
let ids = 0

const chaveItem = (i: Omit<Item, 'id' | 'q'>) => [i.uf, i.area, i.dist ?? '', i.centro ?? '', i.dept ?? ''].join('|')
/** Nome do centro de custo do item: "Logística · Depósito", "Dunorte · Merchan", "Finanças". */
const nomeCentro = (i: Pick<Item, 'area' | 'dist' | 'centro' | 'dept'>) =>
  i.area === 'Comercial' ? `${i.dist} · ${i.centro ?? 'Não definido'}` : (i.dept ?? (i.area === 'Logística' ? 'Depósito' : '—'))

function mesesAteHoje(hoje = new Date()) {
  return intervaloMeses('2025-01', `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`).reverse()
}

/** Valor do centro de custo no seletor rápido → campos do item. */
function lerCentro(area: Area, valor: string): Pick<Item, 'dist' | 'centro' | 'dept'> {
  if (area === 'Comercial') {
    const [dist, centro] = valor.split('|')
    return { dist, centro: centro || null, dept: null }
  }
  return { dist: null, centro: null, dept: valor }
}

/**
 * Lançamento de terceirizados (INOVAR) num painel lateral: escolhe o mês, adiciona por filial → área →
 * centro de custo → quantidade, ajusta a lista e salva. O lançamento do mês substitui os terceirizados
 * das planilhas manuais naquele mês.
 */
export function EditorTerceirizados({
  aberto,
  onFechar,
  linhas,
  comps,
  areaInicial,
}: {
  aberto: boolean
  onFechar: () => void
  /** linhas consolidadas do painel (para abrir o mês com o que está valendo hoje) */
  linhas: readonly Linha[]
  comps: string[]
  areaInicial: Area
}) {
  const lancados = useMesesTerceirizados()
  const salvar = useSalvarTerceirizados()
  const meses = useMemo(() => mesesAteHoje(), [])
  const [competencia, setCompetencia] = useState(() => comps.at(-1) ?? meses[0])
  const [itens, setItens] = useState<Item[]>([])
  const [confirmar, setConfirmar] = useState<null | (() => void)>(null) // descartar alterações?

  // seletor rápido
  const [uf, setUf] = useState<UF>('AM')
  const [area, setArea] = useState<Area>(areaInicial)
  const [centro, setCentro] = useState('')
  const [qtd, setQtd] = useState('')

  const opcoes = useMemo(() => {
    const dists = [...new Set([...DISTRIBUIDORAS.map((d) => d.nome as string), ...linhas.filter((l) => l[2] === 'Comercial' && l[3]).map((l) => l[3]!)])].sort(
      compararDistribuidoras,
    )
    const depts = [...new Set(linhas.filter((l) => l[2] === 'Backoffice' && l[5]).map((l) => l[5]!))].sort((a, b) => a.localeCompare(b))
    return { dists, depts }
  }, [linhas])

  // o que vale hoje no painel para o mês (lançamento anterior ou planilhas manuais)
  const atuais = useMemo(() => {
    const m = new Map<string, Item>()
    for (const l of linhas) {
      if (l[0] !== competencia || l[7] !== 'Terceirizado') continue
      const base =
        l[2] === 'Comercial'
          ? { uf: l[1], area: l[2], dist: l[3], centro: l[4] === 'Vendas' || l[4] === 'Merchan' ? l[4] : null, dept: null }
          : l[2] === 'Logística'
            ? { uf: l[1], area: l[2], dist: null, centro: null, dept: l[5] ?? 'Depósito' } // terceirizados da planilha do Depósito
            : { uf: l[1], area: l[2], dist: null, centro: null, dept: l[5] ?? 'Outros' }
      const k = chaveItem(base)
      const atual = m.get(k) ?? { ...base, id: ++ids, q: 0 }
      atual.q += l[8]
      m.set(k, atual)
    }
    return [...m.values()]
  }, [linhas, competencia])

  useEffect(() => {
    setItens(atuais.map((i) => ({ ...i })))
  }, [atuais])
  useEffect(() => {
    if (aberto) {
      setArea(areaInicial)
      setCentro('')
      setQtd('')
      salvar.reset()
    }
  }, [aberto, areaInicial]) // salvar.reset é estável

  const assinatura = (lista: Item[]) =>
    lista
      .filter((i) => i.q > 0)
      .map((i) => `${chaveItem(i)}=${i.q}`)
      .sort()
      .join(';')
  const alterado = assinatura(itens) !== assinatura(atuais)
  const lancamento = (lancados.data ?? []).find((t) => t.competencia === competencia)

  const ordemArea = (a: Area) => AREAS.indexOf(a)
  const grupos = useMemo(() => {
    const ordenados = [...itens].sort(
      (a, b) =>
        ordemArea(a.area) - ordemArea(b.area) ||
        (a.area === 'Logística' ? SETORES.indexOf(a.dept ?? '') - SETORES.indexOf(b.dept ?? '') : 0) ||
        (a.area === 'Comercial' ? compararDistribuidoras(a.dist ?? '', b.dist ?? '') : (a.dept ?? '').localeCompare(b.dept ?? '')) ||
        (a.centro ?? '').localeCompare(b.centro ?? '') ||
        a.uf.localeCompare(b.uf),
    )
    return AREAS.map((a) => ({ area: a, itens: ordenados.filter((i) => i.area === a) })).filter((g) => g.itens.length)
  }, [itens])

  const somar = (f: (i: Item) => boolean) => itens.filter(f).reduce((s, i) => s + i.q, 0)
  const total = somar(() => true)
  const resumo = [
    { rotulo: 'Depósito', valor: somar((i) => i.area === 'Logística' && i.dept === 'Depósito'), destaque: true },
    { rotulo: 'Distribuição', valor: somar((i) => i.area === 'Logística' && i.dept === 'Distribuição') },
    { rotulo: 'Comercial', valor: somar((i) => i.area === 'Comercial') },
    { rotulo: 'Backoffice', valor: somar((i) => i.area === 'Backoffice') },
  ]

  const qtdValida = qtd.trim() !== '' && Number.isInteger(Number(qtd)) && Number(qtd) > 0
  function adicionar() {
    if (!centro || !qtdValida) return
    const novo = { uf, area, ...lerCentro(area, centro) }
    const k = chaveItem(novo)
    setItens((lista) => {
      const existente = lista.find((i) => chaveItem(i) === k)
      if (existente) {
        toast.info(`${uf} · ${nomeCentro(novo)} já estava na lista: somei ${qtd}.`)
        return lista.map((i) => (i === existente ? { ...i, q: i.q + Number(qtd) } : i))
      }
      return [...lista, { ...novo, id: ++ids, q: Number(qtd) }]
    })
    setQtd('')
  }
  const mudarQtd = (id: number, q: number) => setItens((lista) => lista.map((i) => (i.id === id ? { ...i, q: Math.max(0, q) } : i)))
  const remover = (id: number) => setItens((lista) => lista.filter((i) => i.id !== id))

  const comConfirmacao = (acao: () => void) => (alterado ? setConfirmar(() => acao) : acao())

  function gravar() {
    const payload: ItemTerceirizado[] = itens
      .filter((i) => i.q > 0)
      .map((i) => ({ uf: i.uf, area: i.area, distribuidora: i.dist, centro: i.centro, departamento: i.dept, quantidade: i.q }))
    salvar.mutate(
      { competencia, itens: payload },
      {
        onSuccess: () => {
          toast.success(`Terceirizados de ${rotuloMes(competencia)} salvos. O painel já considera estes números.`)
          onFechar()
        },
      },
    )
  }

  const centrosDaArea =
    area === 'Logística' ? SETORES.map((s) => ({ value: s, label: s })) : area === 'Backoffice' ? opcoes.depts.map((d) => ({ value: d, label: d })) : []

  return (
    <>
      <Sheet open={aberto} onOpenChange={(a) => !a && comConfirmacao(onFechar)}>
        <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:sm:max-w-xl">
          <SheetHeader className="border-b p-5">
            <SheetTitle className="text-lg">Terceirizados</SheetTitle>
            <SheetDescription>
              Quantos havia no último dia do mês. O lançamento substitui, neste mês, os terceirizados das planilhas manuais.
            </SheetDescription>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Select
                value={competencia}
                onValueChange={(v) => v && v !== competencia && comConfirmacao(() => setCompetencia(v))}
                items={meses.map((c) => ({ value: c, label: rotuloMes(c) }))}
              >
                <SelectTrigger className="h-9 w-32" aria-label="Mês">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {meses.map((c) => (
                      <SelectItem key={c} value={c}>
                        {rotuloMes(c)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Badge variant={lancamento ? 'default' : 'secondary'} className="font-normal">
                {lancamento
                  ? `Lançado no ARGOS em ${new Date(lancamento.atualizadoEm).toLocaleDateString('pt-BR')}`
                  : atuais.length
                    ? 'Ainda não lançado: valores das planilhas manuais'
                    : 'Nenhum terceirizado neste mês'}
              </Badge>
            </div>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
            {/* resumo do mês */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {resumo.map((r) => (
                <div
                  key={r.rotulo}
                  className={cn('rounded-lg border px-3 py-2', r.destaque ? 'border-hc-terc/40 bg-hc-terc/8' : 'bg-muted/40')}
                >
                  <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{r.rotulo}</div>
                  <div className="text-lg font-semibold tabular-nums">{fmtPessoas(r.valor)}</div>
                </div>
              ))}
            </div>

            {/* adicionar: filial → área → centro de custo → quantidade */}
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Adicionar terceirizados">
              <h3 className="text-sm font-semibold">Adicionar</h3>
              <div className="flex flex-wrap items-end gap-3">
                <Campo rotulo="Filial">
                  <Escolha rotulo="Filial" valor={uf} onMudar={setUf} opcoes={UFS.map((u) => ({ value: u, label: u }))} />
                </Campo>
                <Campo rotulo="Área">
                  <Escolha
                    rotulo="Área"
                    valor={area}
                    onMudar={(a) => {
                      setArea(a)
                      setCentro('')
                    }}
                    opcoes={AREAS.map((a) => ({ value: a, label: a }))}
                  />
                </Campo>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_6.5rem_auto] items-end gap-3">
                <Campo rotulo="Centro de custo">
                  <Select
                    value={centro}
                    onValueChange={(v) => setCentro(v ?? '')}
                    items={
                      area === 'Comercial'
                        ? opcoes.dists.flatMap((d) => CENTROS_COMERCIAL.map((c) => ({ value: `${d}|${c}`, label: `${d} · ${c}` })))
                        : centrosDaArea
                    }
                  >
                    <SelectTrigger className={cn('h-9 w-full', !centro && 'text-muted-foreground')} aria-label="Centro de custo">
                      <SelectValue placeholder="Escolher" />
                    </SelectTrigger>
                    <SelectContent>
                      {area === 'Comercial' ? (
                        opcoes.dists.map((d, i) => (
                          <SelectGroup key={d}>
                            {i > 0 && <SelectSeparator />}
                            <SelectLabel className="flex items-center gap-1.5 font-semibold" style={{ color: `color-mix(in oklch, ${corDistribuidora(d)} 78%, var(--foreground))` }}>
                              <span className="size-2 rounded-full" style={{ background: corDistribuidora(d) }} />
                              {d}
                            </SelectLabel>
                            {CENTROS_COMERCIAL.map((c) => (
                              <SelectItem key={c} value={`${d}|${c}`}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))
                      ) : (
                        <SelectGroup>
                          {centrosDaArea.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </Campo>
                <Campo rotulo="Quantidade">
                  <Input
                    inputMode="numeric"
                    type="number"
                    min={1}
                    step={1}
                    value={qtd}
                    onChange={(e) => setQtd(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && adicionar()}
                    placeholder="0"
                    className="h-9 text-right tabular-nums"
                    aria-label="Quantidade"
                  />
                </Campo>
                <Button className="h-9" onClick={adicionar} disabled={!centro || !qtdValida}>
                  <Plus data-icon="inline-start" /> Adicionar
                </Button>
              </div>
            </section>

            {/* lista do mês */}
            <section className="flex flex-col gap-4" aria-label={`Terceirizados de ${rotuloMes(competencia)}`}>
              {grupos.length === 0 && (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum terceirizado em {rotuloMes(competencia)}. Adicione acima, ou salve assim para registrar que não havia.
                </p>
              )}
              {grupos.map((g) => (
                <div key={g.area} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between px-1">
                    <h4 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{g.area}</h4>
                    <span className="text-xs text-muted-foreground tabular-nums">{fmtPessoas(g.itens.reduce((s, i) => s + i.q, 0))}</span>
                  </div>
                  <ul className="flex flex-col divide-y rounded-lg border">
                    {g.itens.map((i) => (
                      <li
                        key={i.id}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2',
                          i.area === 'Logística' && i.dept === 'Depósito' && 'bg-hc-terc/6',
                          i.q === 0 && 'opacity-50',
                        )}
                      >
                        <Badge variant="outline" className="w-10 justify-center font-medium" title={ROTULO_UF[i.uf]}>
                          {i.uf}
                        </Badge>
                        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm">
                          {i.area === 'Comercial' && <span className="size-2 shrink-0 rounded-full" style={{ background: corDistribuidora(i.dist) }} />}
                          {nomeCentro(i)}
                        </span>
                        <div className="flex items-center">
                          <Button variant="outline" size="icon" className="size-8 rounded-r-none" aria-label="Diminuir" onClick={() => mudarQtd(i.id, i.q - 1)}>
                            <Minus />
                          </Button>
                          <Input
                            aria-label={`Quantidade ${i.uf} ${nomeCentro(i)}`}
                            inputMode="numeric"
                            type="number"
                            min={0}
                            value={i.q}
                            onChange={(e) => mudarQtd(i.id, Math.floor(Number(e.target.value) || 0))}
                            className="h-8 w-16 rounded-none border-x-0 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <Button variant="outline" size="icon" className="size-8 rounded-l-none" aria-label="Aumentar" onClick={() => mudarQtd(i.id, i.q + 1)}>
                            <Plus />
                          </Button>
                        </div>
                        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" aria-label="Remover" onClick={() => remover(i.id)}>
                          <Trash2 />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>

            {salvar.error && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertDescription>{salvar.error.message}</AlertDescription>
              </Alert>
            )}
          </div>

          <SheetFooter className="flex-row items-center justify-between gap-3 border-t p-4">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Total em {rotuloMes(competencia)}</span>
              <span className="text-lg font-semibold tabular-nums">{fmtPessoas(total)}</span>
            </div>
            <div className="flex items-center gap-2">
              {alterado && <span className="hidden text-xs text-alerta-foreground sm:inline">Alterações não salvas</span>}
              <Button variant="outline" onClick={() => comConfirmacao(onFechar)} disabled={salvar.isPending}>
                Cancelar
              </Button>
              <Button onClick={gravar} disabled={salvar.isPending || (!alterado && !!lancamento)}>
                {salvar.isPending ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
                {salvar.isPending ? 'Salvando…' : `Salvar ${rotuloMes(competencia)}`}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmar} onOpenChange={(a) => !a && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar as alterações?</AlertDialogTitle>
            <AlertDialogDescription>As mudanças em {rotuloMes(competencia)} ainda não foram salvas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const acao = confirmar
                setConfirmar(null)
                setItens(atuais.map((i) => ({ ...i })))
                acao?.()
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{rotulo}</span>
      {children}
    </div>
  )
}
