import { useState } from 'react'
import { Info, Save } from 'lucide-react'
import { toast } from 'sonner'
import { formatarMes, formatarMoeda } from '@/lib/format'
import { InputMoeda } from '@/components/InputMoeda'
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { SeloDiferenca } from '../versoes/Diferenca'
import { semDiferenca } from '../versoes/diferenca-util'
import { ID_CAMPO_VALOR, useRegistrarDespesa, type SituacaoMes } from './api-despesas'

/** Card de lançamento rápido da despesa do mês. */
export function LancarDespesa({
  mesRef,
  meses,
  situacao,
  onMudarMes,
}: {
  mesRef: string
  meses: string[]
  situacao: (mesRef: string) => SituacaoMes
  onMudarMes: (mesRef: string) => void
}) {
  // o formulário começa limpo a cada mês: a página remonta este card com key={mesRef}
  const [valor, setValor] = useState<number | null>(null)
  const [observacao, setObservacao] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const registrar = useRegistrarDespesa()

  const { vigente, temFaturamento } = situacao(mesRef)
  const correcao = !!vigente
  const igualAoVigente = correcao && valor != null && semDiferenca(valor - vigente.valor)
  const faltaObservacao = correcao && observacao.trim().length === 0
  const podeGravar = valor != null && valor >= 0 && !igualAoVigente && !faltaObservacao && !registrar.isPending

  function gravar() {
    if (!podeGravar || valor == null) return
    registrar.mutate(
      { mesRef, valor, observacao: observacao.trim() || null },
      {
        onSuccess: () => {
          setConfirmando(false)
          setValor(null)
          setObservacao('')
          toast.success(
            `Despesa de ${formatarMes(mesRef)} ${correcao ? `corrigida (v${vigente!.versao + 1})` : 'lançada'}: ${formatarMoeda(valor)}.`,
            {
              description: temFaturamento
                ? 'O Relatório Gerencial já considera este valor.'
                : 'Entra no Relatório Gerencial quando a base de faturamento do mês for importada.',
            },
          )
        },
        onError: (e) => {
          setConfirmando(false)
          toast.error(`Não foi possível gravar a despesa: ${e.message}`)
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{correcao ? 'Corrigir despesa' : 'Lançar despesa'}</CardTitle>
        <CardDescription>Valor total da despesa do mês. Ele é rateado entre os departamentos no Relatório Gerencial.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Mês</FieldLabel>
            <Select
              value={mesRef}
              onValueChange={(v) => v && onMudarMes(v)}
              items={meses.map((m) => ({ value: m, label: formatarMes(m) }))}
            >
              <SelectTrigger className="w-full" aria-label="Mês da despesa">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {meses.map((m) => {
                    const s = situacao(m)
                    return (
                      <SelectItem key={m} value={m}>
                        {formatarMes(m)}
                        <Badge variant={s.vigente ? 'secondary' : 'outline'} className="ml-auto font-normal">
                          {s.vigente ? `v${s.vigente.versao} · ${formatarMoeda(s.vigente.valor)}` : 'não lançada'}
                        </Badge>
                      </SelectItem>
                    )
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
            {correcao && (
              <FieldDescription>
                Vigente: <strong className="text-foreground">{formatarMoeda(vigente.valor)}</strong> (v{vigente.versao}). A correção
                cria a v{vigente.versao + 1}; a anterior fica no histórico.
              </FieldDescription>
            )}
          </Field>

          <Field data-invalid={igualAoVigente || undefined}>
            <FieldLabel htmlFor={ID_CAMPO_VALOR}>{correcao ? 'Novo valor' : 'Valor'}</FieldLabel>
            <InputMoeda id={ID_CAMPO_VALOR} valor={valor} onChange={setValor} invalido={igualAoVigente} />
            {igualAoVigente && <FieldError>O valor é igual ao vigente; não há o que corrigir.</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor="despesa-observacao">
              Observação{' '}
              {correcao ? <span className="text-destructive">*</span> : <span className="font-normal text-muted-foreground">(opcional)</span>}
            </FieldLabel>
            <Textarea
              id="despesa-observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder={correcao ? 'Motivo da correção (obrigatório).' : 'Ex.: fechamento contábil de setembro.'}
              rows={2}
              maxLength={500}
            />
          </Field>

          {!temFaturamento && (
            <Alert>
              <Info />
              <AlertDescription>
                {formatarMes(mesRef)} ainda não tem base de faturamento: a despesa fica gravada e entra no Relatório Gerencial
                quando a base for importada.
              </AlertDescription>
            </Alert>
          )}
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-end border-t">
        <Button onClick={() => (correcao ? setConfirmando(true) : gravar())} disabled={!podeGravar}>
          {registrar.isPending ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
          {correcao ? `Corrigir ${formatarMes(mesRef)}` : `Lançar ${formatarMes(mesRef)}`}
        </Button>
      </CardFooter>

      {/* confirmação da correção */}
      {correcao && valor != null && (
        <AlertDialog open={confirmando} onOpenChange={(aberto) => !registrar.isPending && setConfirmando(aberto)}>
          <AlertDialogContent className="data-[size=default]:sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Corrigir a despesa de {formatarMes(mesRef)}?</AlertDialogTitle>
              <AlertDialogDescription>
                A v{vigente.versao + 1} passa a ser a vigente e o LB¹ de {formatarMes(mesRef)} é recalculado. A v{vigente.versao} continua
                no histórico.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">v{vigente.versao} (vigente)</span>
                <span className="tabular-nums">{formatarMoeda(vigente.valor)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">v{vigente.versao + 1} (nova)</span>
                <span className="font-medium tabular-nums">{formatarMoeda(valor)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Diferença</span>
                <SeloDiferenca dif={valor - vigente.valor} />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={registrar.isPending}>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={gravar} disabled={registrar.isPending}>
                {registrar.isPending ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
                {registrar.isPending ? 'Gravando…' : `Confirmar v${vigente.versao + 1}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Card>
  )
}
