import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowLeftRight, CheckCircle2 } from 'lucide-react'
import { NOME_DUNO_PRO } from '@/lib/constantes'
import { formatarMes } from '@/lib/format'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  ROTULO_SITUACAO,
  SITUACOES,
  useCarga,
  useComparacao,
  useVersoesDoMes,
  type Carga,
  type Situacao,
} from './api-versoes'
import { CardDiferenca } from './Diferenca'
import { SeloSituacao, TabelaComparacao } from './TabelaComparacao'

/** Padrão: esconde os departamentos iguais. */
const FILTRO_PADRAO: Situacao[] = ['alterado', 'novo', 'removido']

function rotuloVersao(c: Pick<Carga, 'versao' | 'vigente'>) {
  return `v${c.versao}${c.vigente ? ' · vigente' : ''}`
}

export default function ComparacaoPage() {
  const [params, setParams] = useSearchParams()
  const idA = params.get('a')
  const idB = params.get('b')
  const [filtro, setFiltro] = useState<Situacao[]>(FILTRO_PADRAO)

  const cargaA = useCarga(idA)
  const cargaB = useCarga(idB)
  const a = cargaA.data
  const b = cargaB.data
  const mesRef = a?.mes_ref ?? b?.mes_ref
  const versoes = useVersoesDoMes(a?.distribuidora_id ?? b?.distribuidora_id, mesRef)
  const comparacao = useComparacao(idA, idB)

  const contagem = useMemo(() => {
    const c: Record<Situacao, number> = { alterado: 0, novo: 0, removido: 0, igual: 0 }
    for (const l of comparacao.data ?? []) c[l.situacao as Situacao]++
    return c
  }, [comparacao.data])
  const linhas = useMemo(
    () => (comparacao.data ?? []).filter((l) => filtro.includes(l.situacao as Situacao)),
    [comparacao.data, filtro],
  )
  const identicas = !!comparacao.data && contagem.alterado + contagem.novo + contagem.removido === 0

  function trocar(chave: 'a' | 'b', id: string) {
    const p = new URLSearchParams(params)
    p.set(chave, id)
    setParams(p, { replace: true })
  }

  const voltar = `/dun-professional/historico${mesRef ? `?ano=${mesRef.slice(0, 4)}` : ''}`
  const erro = cargaA.error ?? cargaB.error ?? versoes.error ?? comparacao.error

  const seletor = (chave: 'a' | 'b', rotulo: string, valor: string | null) => (
    <Field className="w-44">
      <FieldLabel>{rotulo}</FieldLabel>
      <Select
        value={valor}
        onValueChange={(v) => v && trocar(chave, String(v))}
        items={(versoes.data ?? []).map((v) => ({ value: v.id, label: rotuloVersao(v) }))}
      >
        <SelectTrigger className="w-full" aria-label={rotulo}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {(versoes.data ?? []).map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {rotuloVersao(v)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" render={<Link to={voltar} />}>
            <ArrowLeft data-icon="inline-start" />
            Histórico de cargas
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Comparação de Versões</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {NOME_DUNO_PRO}
              {mesRef && ` · ${formatarMes(mesRef)}`} · A = versão de referência, B = versão comparada
            </p>
          </div>
        </div>

        {versoes.data && (
          <div className="flex items-end gap-2">
            {seletor('a', 'Versão A', idA)}
            <Button
              variant="outline"
              size="icon"
              aria-label="Inverter A e B"
              title="Inverter A e B"
              onClick={() => idA && idB && setParams({ a: idB, b: idA }, { replace: true })}
            >
              <ArrowLeftRight />
            </Button>
            {seletor('b', 'Versão B', idB)}
          </div>
        )}
      </div>

      {(!idA || !idB) && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Escolha duas versões para comparar</AlertTitle>
          <AlertDescription>Abra a comparação a partir do Histórico de cargas.</AlertDescription>
        </Alert>
      )}

      {idA && idB && idA === idB && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>A e B são a mesma versão</AlertTitle>
          <AlertDescription>Escolha versões diferentes nos seletores acima.</AlertDescription>
        </Alert>
      )}

      {erro && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Erro ao carregar a comparação</AlertTitle>
          <AlertDescription>{erro.message}</AlertDescription>
        </Alert>
      )}

      {a && b && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <CardDiferenca
            rotulo="Faturamento líquido"
            antes={a.total_faturamento}
            depois={b.total_faturamento}
            rotuloAntes={`A · ${rotuloVersao(a)}`}
            rotuloDepois={`B · ${rotuloVersao(b)}`}
          />
          <CardDiferenca
            rotulo="Margem"
            antes={a.total_margem_valor}
            depois={b.total_margem_valor}
            rotuloAntes={`A · ${rotuloVersao(a)}`}
            rotuloDepois={`B · ${rotuloVersao(b)}`}
          />
        </div>
      )}

      {idA && idB && idA !== idB && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {comparacao.isPending ? (
                <>
                  <Spinner /> Comparando departamentos…
                </>
              ) : (
                <>
                  <span>{comparacao.data?.length ?? 0} departamentos:</span>
                  {SITUACOES.filter((s) => contagem[s] > 0).map((s) => (
                    <span key={s} className="flex items-center gap-1">
                      <SeloSituacao situacao={s} /> <span className="tabular-nums">{contagem[s]}</span>
                    </span>
                  ))}
                </>
              )}
            </div>

            <ToggleGroup
              multiple
              variant="outline"
              size="sm"
              value={filtro}
              onValueChange={(v) => setFiltro(v as Situacao[])}
              aria-label="Filtrar por situação"
            >
              {SITUACOES.map((s) => (
                <ToggleGroupItem
                  key={s}
                  value={s}
                  aria-label={ROTULO_SITUACAO[s]}
                  className="text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  {ROTULO_SITUACAO[s]} ({contagem[s]})
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {identicas && (
            <Alert className="border-positivo/30 bg-positivo/10 text-positivo">
              <CheckCircle2 />
              <AlertTitle>As duas versões são idênticas</AlertTitle>
              <AlertDescription className="text-positivo/85">
                Nenhum departamento mudou, entrou ou saiu. Marque "Igual" no filtro para ver todos.
              </AlertDescription>
            </Alert>
          )}

          {comparacao.isPending || !a || !b ? (
            <Skeleton className="h-96 w-full rounded-xl" />
          ) : (
            <TabelaComparacao
              linhas={linhas}
              versaoA={a.versao}
              versaoB={b.versao}
              mensagemVazia={filtro.length === 0 ? 'Marque ao menos uma situação no filtro.' : 'Nenhum departamento nessas situações.'}
            />
          )}
        </div>
      )}
    </div>
  )
}
