import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, CalendarRange, Sigma, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Indicador } from '@/components/Indicador'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { usePerfil } from '@/auth/usePerfil'
import { NOME_DUNO_PRO } from '@/lib/constantes'
import { formatarMes, formatarMoeda } from '@/lib/format'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useDistribuidora, useTotaisMensais } from '../api'
import { useNomesPerfis } from '../versoes/api-versoes'
import {
  ID_CAMPO_VALOR,
  useDespesaVigenteTodas,
  useDespesasDoAno,
  type LancamentoDespesa,
  type SituacaoMes,
} from './api-despesas'
import { DialogDespesaVigente } from './DialogDespesaVigente'
import { GraficoDespesas, type PontoDespesa, type SelecaoMeses } from './GraficoDespesas'
import { LancarDespesa } from './LancarDespesa'
import { TabelaDespesas, type ContextoDespesas, type LinhaDespesa } from './TabelaDespesas'

const MESES_NO_SELETOR = 24

// ---- calendário (datas "AAAA-MM-01" tratadas como texto, sem fuso) ----
function somarMeses(mesRef: string, delta: number) {
  const [a, m] = mesRef.split('-').map(Number)
  const total = a * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`
}
function mesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// preferência de "Rótulos de dados" guardada no navegador (conveniência; pode não existir)
const CHAVE_ROTULOS = 'argos-despesas-rotulos'
function lerPreferenciaRotulos() {
  try {
    return localStorage.getItem(CHAVE_ROTULOS) === '1'
  } catch {
    return false
  }
}
function salvarPreferenciaRotulos(ligado: boolean) {
  try {
    localStorage.setItem(CHAVE_ROTULOS, ligado ? '1' : '0')
  } catch {
    // sem armazenamento disponível: a escolha vale só nesta visita
  }
}

export default function DespesasPage() {
  const { podeEditar } = usePerfil()
  const [params, setParams] = useSearchParams()
  const distribuidora = useDistribuidora()
  const distId = distribuidora.data?.id
  const totais = useTotaisMensais(distId)
  const vigentes = useDespesaVigenteTodas(distId)
  const nomes = useNomesPerfis()

  const hoje = mesAtual()
  const ano = Number(params.get('ano')) || Number(hoje.slice(0, 4))
  const despesasAno = useDespesasDoAno(distId, ano)

  const [rotulos, setRotulos] = useState(lerPreferenciaRotulos)
  const [selecao, setSelecao] = useState<SelecaoMeses | null>(null)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [alvo, setAlvo] = useState<LancamentoDespesa | null>(null)

  // ---- mapas por mês ----
  const vigentePorMes = useMemo(
    () => new Map((vigentes.data ?? []).map((v) => [v.mes_ref!, { versao: v.versao!, valor: v.valor_total! }])),
    [vigentes.data],
  )
  const totalPorMes = useMemo(() => new Map((totais.data ?? []).map((t) => [t.mes_ref!, t])), [totais.data])
  const situacao = useCallback(
    (m: string): SituacaoMes => ({ vigente: vigentePorMes.get(m) ?? null, temFaturamento: totalPorMes.has(m) }),
    [vigentePorMes, totalPorMes],
  )

  // ---- mês do formulário: ?mes=AAAA-MM (link do alerta do Gerencial) ou o mês mais recente ainda sem despesa ----
  const mesesDoSeletor = useMemo(() => Array.from({ length: MESES_NO_SELETOR }, (_, i) => somarMeses(hoje, -i)), [hoje])
  const mesParam = params.get('mes')
  const mesForm =
    (mesParam ? `${mesParam}-01` : null) ?? mesesDoSeletor.find((m) => !vigentePorMes.has(m)) ?? mesesDoSeletor[0]

  function mudarParam(chave: string, valor: string) {
    const p = new URLSearchParams(params)
    p.set(chave, valor)
    setParams(p, { replace: true })
  }

  function irParaLancamento(mesRef: string) {
    mudarParam('mes', mesRef.slice(0, 7))
    // espera o card remontar com o novo mês e leva o foco ao campo de valor
    setTimeout(() => {
      const campo = document.getElementById(ID_CAMPO_VALOR)
      campo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      campo?.focus({ preventScroll: true })
    }, 50)
  }

  // ---- série do gráfico: Jan a Dez do ano escolhido (meses sem lançamento viram lacuna) ----
  const pontos: PontoDespesa[] = useMemo(() => {
    const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}-01`)
    return meses.map((m) => {
      const despesa = vigentePorMes.get(m)?.valor ?? null
      const total = totalPorMes.get(m)
      return {
        mesRef: m,
        rotulo: formatarMes(m),
        despesa,
        // custo operacional só existe com despesa E base de faturamento no mês
        custoOp: despesa != null && total?.despesa != null ? total.custo_op_pct : null,
      }
    })
  }, [vigentePorMes, totalPorMes, ano])

  const ultimo = [...pontos].reverse().find((p) => p.despesa != null)

  // resumo: meses selecionados no gráfico (arraste) ou, sem seleção, o período inteiro.
  // soma e média dos valores vigentes lançados (a média ignora meses sem lançamento)
  const selecaoValida = selecao && selecao.fim < pontos.length ? selecao : null
  const mesesResumo = selecaoValida ? pontos.slice(selecaoValida.inicio, selecaoValida.fim + 1) : pontos
  const lancados = mesesResumo.filter((p) => p.despesa != null)
  const somaPeriodo = lancados.reduce((s, p) => s + p.despesa!, 0)
  const mediaPeriodo = lancados.length ? somaPeriodo / lancados.length : null
  const faixaPeriodo = lancados.length
    ? `${lancados.length} ${lancados.length === 1 ? 'mês' : 'meses'} · ${lancados[0].rotulo}${lancados.length > 1 ? ` a ${lancados[lancados.length - 1].rotulo}` : ''}`
    : 'nenhum mês lançado'

  // ---- linhas da tabela (12 meses do ano; versões abaixo do mês expandido) ----
  const linhas: LinhaDespesa[] = useMemo(() => {
    const resultado: LinhaDespesa[] = []
    for (let i = 1; i <= 12; i++) {
      const mesRef = `${ano}-${String(i).padStart(2, '0')}-01`
      const versoes = (despesasAno.data ?? []).filter((d) => d.mes_ref === mesRef)
      resultado.push({
        tipo: 'mes',
        id: mesRef,
        mesRef,
        vigente: versoes.find((v) => v.vigente) ?? null,
        versoes,
        temFaturamento: totalPorMes.has(mesRef),
        futuro: mesRef > hoje,
      })
      if (expandidos.has(mesRef)) {
        for (const v of versoes) resultado.push({ tipo: 'versao', id: v.id, mesRef, lancamento: v })
      }
    }
    return resultado
  }, [ano, despesasAno.data, totalPorMes, expandidos, hoje])

  const contexto: ContextoDespesas = useMemo(
    () => ({
      nomes: nomes.data,
      podeEditar,
      expandidos,
      onAlternar: (m) =>
        setExpandidos((atual) => {
          const novo = new Set(atual)
          if (novo.has(m)) novo.delete(m)
          else novo.add(m)
          return novo
        }),
      onLancar: irParaLancamento,
      onTornarVigente: setAlvo,
    }),
    // irParaLancamento só depende de params, que muda junto com o resto da página
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nomes.data, podeEditar, expandidos, params],
  )

  // anos disponíveis: do primeiro ano com dados até o ano seguinte ao atual (hoje: 2026 e 2027)
  const anos = useMemo(() => {
    const atual = Number(hoje.slice(0, 4))
    const comDado = [...vigentePorMes.keys(), ...totalPorMes.keys()].map((m) => Number(m.slice(0, 4)))
    const primeiro = Math.min(atual, ...comDado)
    return Array.from({ length: atual + 1 - primeiro + 1 }, (_, i) => primeiro + i)
  }, [vigentePorMes, totalPorMes, hoje])

  function mudarAno(novo: number) {
    mudarParam('ano', String(novo))
    setSelecao(null) // os índices da seleção valem só para o ano anterior
  }

  const atualDoAlvo = alvo ? (despesasAno.data ?? []).find((d) => d.mes_ref === alvo.mes_ref && d.vigente) ?? null : null
  const carregando = distribuidora.isPending || totais.isPending || vigentes.isPending
  const erro = distribuidora.error ?? totais.error ?? vigentes.error ?? despesasAno.error

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Despesas</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {NOME_DUNO_PRO} · despesa total do mês. O valor lançado entra direto no Relatório Gerencial (rateio e LB¹).
        </p>
      </div>

      {erro && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Erro ao carregar as despesas</AlertTitle>
          <AlertDescription>{erro.message}</AlertDescription>
        </Alert>
      )}

      <div className={podeEditar ? 'grid grid-cols-1 items-start gap-6 xl:grid-cols-[400px_1fr]' : 'flex flex-col gap-6'}>
        {podeEditar &&
          (carregando ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : (
            <LancarDespesa
              key={mesForm}
              mesRef={mesForm}
              meses={mesesDoSeletor}
              situacao={situacao}
              onMudarMes={(m) => mudarParam('mes', m.slice(0, 7))}
            />
          ))}

        <Card>
          <CardHeader>
            <CardTitle>Acompanhamento</CardTitle>
            <CardDescription>
              {ultimo
                ? `Último lançamento de ${ano}: ${ultimo.rotulo} · ${formatarMoeda(ultimo.despesa)}`
                : `Nenhuma despesa lançada em ${ano}.`}
            </CardDescription>
            <CardAction>
              <ToggleGroup
                variant="outline"
                size="sm"
                value={[String(ano)]}
                onValueChange={(v) => v[0] && mudarAno(Number(v[0]))}
                aria-label="Ano do gráfico"
              >
                {anos.map((a) => (
                  <ToggleGroupItem
                    key={a}
                    value={String(a)}
                    className="text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                  >
                    {a}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {carregando ? (
              <Skeleton className="h-[30rem] w-full" />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Indicador
                    rotulo="Soma do período"
                    tom="despesa"
                    icone={Sigma}
                    valor={formatarMoeda(somaPeriodo)}
                    apoio={faixaPeriodo}
                  />
                  <Indicador
                    rotulo="Média mensal"
                    tom="despesa"
                    icone={CalendarRange}
                    valor={mediaPeriodo == null ? '—' : formatarMoeda(mediaPeriodo)}
                    apoio={
                      lancados.length === 1
                        ? 'só 1 mês lançado'
                        : lancados.length
                          ? `média dos ${lancados.length} meses lançados`
                          : undefined
                    }
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selecaoValida ? (
                    <Badge variant="outline" className="h-7 gap-1.5 border-primary/30 bg-primary/10 pr-1 pl-2.5 text-sm text-primary">
                      Seleção: {pontos[selecaoValida.inicio].rotulo}
                      {selecaoValida.fim > selecaoValida.inicio && ` a ${pontos[selecaoValida.fim].rotulo}`}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Limpar seleção"
                        title="Limpar seleção"
                        className="text-primary hover:bg-primary/15"
                        onClick={() => setSelecao(null)}
                      >
                        <X />
                      </Button>
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Arraste sobre o gráfico para filtrar os meses (ou clique em um mês).
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                  <Switch
                    id="rotulos-dados"
                    size="sm"
                    checked={rotulos}
                    onCheckedChange={(ligado) => {
                      setRotulos(ligado)
                      salvarPreferenciaRotulos(ligado)
                    }}
                  />
                  <Label htmlFor="rotulos-dados" className="text-sm font-normal text-muted-foreground">
                    Rótulos de dados
                  </Label>
                  </div>
                </div>
                {/* com seleção, o gráfico mostra só os meses selecionados (zoom); arrastar de novo aproxima mais.
                    A seleção feita no gráfico ampliado vem em índices dele: soma o início para voltar ao período inteiro. */}
                <GraficoDespesas
                  pontos={mesesResumo}
                  rotulos={rotulos}
                  selecao={null}
                  onSelecionar={(s) => {
                    const base = selecaoValida?.inicio ?? 0
                    setSelecao({ inicio: base + s.inicio, fim: base + s.fim })
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Despesas de {ano}</CardTitle>
          <CardDescription>Valor vigente de cada mês. Clique na seta para ver as versões anteriores.</CardDescription>
          <CardAction>
            <Select
              value={ano}
              onValueChange={(v) => v && mudarAno(Number(v))}
              items={anos.map((a) => ({ value: a, label: String(a) }))}
            >
              <SelectTrigger className="w-28" aria-label="Ano">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {anos.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent>
          {despesasAno.isPending ? <Skeleton className="h-96 w-full" /> : <TabelaDespesas linhas={linhas} contexto={contexto} />}
        </CardContent>
      </Card>

      <DialogDespesaVigente alvo={alvo} atual={atualDoAlvo} onFechar={() => setAlvo(null)} />
    </div>
  )
}
