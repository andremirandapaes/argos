import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, CircleX, FileWarning, Save } from 'lucide-react'
import { toast } from 'sonner'
import { NOME_DUNO_PRO } from '@/lib/constantes'
import { formatarDataHora, formatarMes, formatarMoeda, formatarPct } from '@/lib/format'
import { Indicador } from '@/components/Indicador'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useDistribuidora, useTotaisMensais } from '../api'
import { useVersoesDoMes } from '../versoes/api-versoes'
import { CardDiferenca, SeloDiferenca } from '../versoes/Diferenca'
import { semDiferenca } from '../versoes/diferenca-util'
import { ErroRegistroCarga, useRegistrarCarga } from './api-importacao'
import { COLUNAS_MINIMAS, SOMA_PARTICIPACAO, lerArquivo, validarBase, type ResultadoValidacao } from './base-winthor'
import { SeletorArquivo } from './SeletorArquivo'
import { TabelaErros } from './TabelaErros'
import { TabelaPrevia } from './TabelaPrevia'

const MESES_NO_SELETOR = 24

/** "AAAA-MM-01" do mês atual deslocado em `delta` meses. */
function mesRelativo(delta: number) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

type Leitura =
  | { estado: 'vazio' }
  | { estado: 'lendo'; arquivo: File }
  | { estado: 'falhou'; arquivo: File; mensagem: string }
  | { estado: 'lido'; arquivo: File; resultado: ResultadoValidacao }

export default function ImportarPage() {
  const navigate = useNavigate()
  const distribuidora = useDistribuidora()
  const distId = distribuidora.data?.id
  const totais = useTotaisMensais(distId)

  const [mesRef, setMesRef] = useState(() => mesRelativo(-1)) // padrão: mês anterior ao atual
  const [leitura, setLeitura] = useState<Leitura>({ estado: 'vazio' })
  const [observacao, setObservacao] = useState('')
  const [confirmando, setConfirmando] = useState(false) // janela de confirmação do reenvio
  const leituraAtual = useRef(0) // descarta leituras antigas se o usuário trocar de arquivo no meio

  const versoes = useVersoesDoMes(distId, mesRef)
  const registrar = useRegistrarCarga()

  // ---- opções do seletor de mês (marca os meses que já têm base) ----
  const versaoPorMes = useMemo(
    () => new Map((totais.data ?? []).map((t) => [t.mes_ref!, t.versao_faturamento])),
    [totais.data],
  )
  const meses = useMemo(() => Array.from({ length: MESES_NO_SELETOR }, (_, i) => mesRelativo(-i)), [])

  // ---- versão vigente do mês e a próxima versão ----
  const vigente = versoes.data?.find((v) => v.vigente) ?? null
  const versaoPrevista = (versoes.data?.[0]?.versao ?? 0) + 1
  const reenvio = !!vigente

  async function escolherArquivo(arquivo: File) {
    const id = ++leituraAtual.current
    registrar.reset()
    setLeitura({ estado: 'lendo', arquivo })
    try {
      const resultado = validarBase(await lerArquivo(arquivo))
      if (id === leituraAtual.current) setLeitura({ estado: 'lido', arquivo, resultado })
    } catch (e) {
      if (id === leituraAtual.current) {
        setLeitura({ estado: 'falhou', arquivo, mensagem: (e as Error).message || 'Arquivo ilegível.' })
      }
    }
  }

  const resultado = leitura.estado === 'lido' ? leitura.resultado : null
  const valido = !!resultado && resultado.erros.length === 0
  const faltaObservacao = reenvio && observacao.trim().length === 0
  const podeGravar = valido && !faltaObservacao && !versoes.isPending && !registrar.isPending

  function gravar() {
    if (!resultado || leitura.estado !== 'lido' || !podeGravar) return
    const anterior = vigente
    registrar.mutate(
      {
        mesRef,
        versaoPrevista,
        arquivo: leitura.arquivo,
        linhas: resultado.linhas,
        observacao: observacao.trim() || null,
      },
      {
        onError: () => setConfirmando(false), // o erro aparece no card de confirmação
        onSuccess: ({ cargaId }) => {
          setConfirmando(false)
          toast.success(`Base de ${formatarMes(mesRef)} registrada como v${versaoPrevista}.`)
          if (anterior) {
            // reenvio: abre a comparação com a versão que estava vigente
            navigate(`/dun-professional/historico/comparar?a=${anterior.id}&b=${cargaId}`)
          } else {
            navigate(`/dun-professional/gerencial?mes=${mesRef.slice(0, 7)}`)
          }
        },
      },
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Importar Faturamento</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Base mensal do Winthor · {NOME_DUNO_PRO}. Cada envio vira uma nova versão do mês; nada é sobrescrito.
        </p>
      </div>

      {/* 1. mês + arquivo */}
      <Card>
        <CardHeader>
          <CardTitle>1. Arquivo</CardTitle>
          <CardDescription>Escolha o mês de referência e a planilha exportada do Winthor.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field className="max-w-xs">
              <FieldLabel>Mês de referência</FieldLabel>
              <Select
                value={mesRef}
                onValueChange={(v) => {
                  if (!v) return
                  setMesRef(v)
                  setObservacao('')
                  registrar.reset()
                }}
                items={meses.map((m) => ({ value: m, label: formatarMes(m) }))}
              >
                <SelectTrigger className="w-full" aria-label="Mês de referência">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {meses.map((m) => {
                      const v = versaoPorMes.get(m)
                      return (
                        <SelectItem key={m} value={m}>
                          {formatarMes(m)}
                          {v != null && (
                            <Badge variant="secondary" className="ml-auto font-normal">
                              já tem v{v}
                            </Badge>
                          )}
                        </SelectItem>
                      )
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Planilha</FieldLabel>
              <SeletorArquivo
                arquivo={leitura.estado === 'vazio' ? null : leitura.arquivo}
                desabilitado={leitura.estado === 'lendo' || registrar.isPending}
                onEscolher={escolherArquivo}
                onExtensaoInvalida={(nome) => toast.error(`"${nome}" não é .xls nem .xlsx.`)}
              />
              <FieldDescription>
                Leitura por posição: A = código, B = departamento, F = faturamento líquido, G = participação %, H = margem %.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {leitura.estado === 'lendo' && (
        <Card>
          <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
            <Spinner /> Lendo e validando a planilha…
          </CardContent>
        </Card>
      )}

      {leitura.estado === 'falhou' && (
        <Alert variant="destructive">
          <FileWarning />
          <AlertTitle>Não foi possível ler o arquivo</AlertTitle>
          <AlertDescription>{leitura.mensagem}</AlertDescription>
        </Alert>
      )}

      {/* 2a. erros bloqueantes */}
      {resultado && !valido && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleX className="text-destructive" />
              2. Validação: {resultado.erros.length} {resultado.erros.length === 1 ? 'problema' : 'problemas'}
            </CardTitle>
            <CardDescription>
              Corrija a planilha e escolha o arquivo de novo. Enquanto houver problemas, o envio fica bloqueado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TabelaErros erros={resultado.erros} />
          </CardContent>
        </Card>
      )}

      {/* 2b. prévia */}
      {resultado && valido && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="text-positivo" />
              2. Prévia de {formatarMes(mesRef)}
            </CardTitle>
            <CardDescription>
              Todas as validações passaram: {COLUNAS_MINIMAS}+ colunas, códigos inteiros e únicos, valores numéricos e soma
              da participação entre {SOMA_PARTICIPACAO.min.toLocaleString('pt-BR')} e{' '}
              {SOMA_PARTICIPACAO.max.toLocaleString('pt-BR')} (
              {resultado.resumo.somaParticipacao.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Indicador rotulo="Departamentos" tom="neutro" valor={resultado.resumo.qtdDepartamentos} />
              <Indicador rotulo="Faturamento líquido" tom="fat" valor={formatarMoeda(resultado.resumo.faturamento)} />
              <Indicador rotulo="Margem" tom="margem" valor={formatarMoeda(resultado.resumo.margem)} />
              <Indicador rotulo="Margem %" tom="margem" valor={formatarPct(resultado.resumo.margemPct)} />
            </div>
            <TabelaPrevia linhas={resultado.linhas} />
          </CardContent>
        </Card>
      )}

      {/* 3. confirmação */}
      {resultado && valido && (
        <Card>
          <CardHeader>
            <CardTitle>3. Confirmação</CardTitle>
            <CardDescription>
              {versoes.isPending
                ? 'Verificando versões já enviadas…'
                : reenvio
                  ? `Esta carga será a v${versaoPrevista} de ${formatarMes(mesRef)} e passará a ser a vigente.`
                  : `Primeira base de ${formatarMes(mesRef)}: será registrada como v1.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {reenvio && vigente && (
              <Alert className="border-alerta-foreground/25 bg-alerta text-alerta-foreground">
                <AlertTriangle />
                <AlertTitle>
                  Já existe a versão v{vigente.versao} deste mês. Esta carga será a v{versaoPrevista} e passará a ser a
                  vigente.
                </AlertTitle>
                <AlertDescription className="text-alerta-foreground/85">
                  v{vigente.versao} enviada em {formatarDataHora(vigente.enviado_em)} · {vigente.qtd_linhas} departamentos.
                  A versão anterior continua guardada no histórico.
                </AlertDescription>
              </Alert>
            )}

            {reenvio && vigente && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <CardDiferenca
                  rotulo="Faturamento líquido"
                  antes={vigente.total_faturamento}
                  depois={resultado.resumo.faturamento}
                  rotuloAntes={`v${vigente.versao} (vigente)`}
                  rotuloDepois={`v${versaoPrevista} (este arquivo)`}
                />
                <CardDiferenca
                  rotulo="Margem"
                  antes={vigente.total_margem_valor}
                  depois={resultado.resumo.margem}
                  rotuloAntes={`v${vigente.versao} (vigente)`}
                  rotuloDepois={`v${versaoPrevista} (este arquivo)`}
                />
              </div>
            )}

            <Field data-invalid={faltaObservacao && observacao.length > 0 ? true : undefined}>
              <FieldLabel htmlFor="observacao">
                Observação {reenvio ? <span className="text-destructive">*</span> : <span className="font-normal text-muted-foreground">(opcional)</span>}
              </FieldLabel>
              <Textarea
                id="observacao"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder={reenvio ? 'Explique o motivo do reenvio (ex.: correção de devolução lançada após o fechamento).' : 'Alguma informação sobre esta base?'}
                aria-invalid={faltaObservacao && observacao.length > 0 ? true : undefined}
                rows={3}
                maxLength={500}
              />
              {reenvio && <FieldDescription>Obrigatória no reenvio: fica registrada no histórico da versão.</FieldDescription>}
            </Field>

            {registrar.error && (
              <Alert variant="destructive">
                <CircleX />
                <AlertTitle>Não foi possível registrar a carga</AlertTitle>
                <AlertDescription>
                  {registrar.error.message}
                  {registrar.error instanceof ErroRegistroCarga &&
                    ' O arquivo chegou ao Storage, mas nenhum número foi alterado. Você pode tentar de novo.'}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="justify-end gap-2 border-t">
            <Button
              variant="outline"
              disabled={registrar.isPending}
              onClick={() => {
                leituraAtual.current++
                setLeitura({ estado: 'vazio' })
                setObservacao('')
                registrar.reset()
              }}
            >
              Cancelar
            </Button>
            {/* reenvio pede confirmação; primeira base do mês grava direto */}
            <Button onClick={() => (reenvio ? setConfirmando(true) : gravar())} disabled={!podeGravar}>
              {registrar.isPending ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              {registrar.isPending ? 'Registrando…' : `Registrar v${versaoPrevista}`}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* confirmação do reenvio */}
      {resultado && vigente && (
        <AlertDialog open={confirmando} onOpenChange={(aberto) => !registrar.isPending && setConfirmando(aberto)}>
          <AlertDialogContent className="data-[size=default]:sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Registrar a v{versaoPrevista} de {formatarMes(mesRef)}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                A v{versaoPrevista} passa a ser a vigente e os relatórios de {formatarMes(mesRef)} passam a usá-la. A v
                {vigente.versao} não é apagada: continua no histórico e pode voltar a ser a vigente pelo Histórico de cargas.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
              <LinhaConfirmacao rotulo="Faturamento líquido" dif={resultado.resumo.faturamento - vigente.total_faturamento} />
              <LinhaConfirmacao rotulo="Margem" dif={resultado.resumo.margem - vigente.total_margem_valor} />
              <LinhaConfirmacao
                rotulo="Departamentos"
                texto={
                  resultado.resumo.qtdDepartamentos === vigente.qtd_linhas
                    ? `${vigente.qtd_linhas} (igual)`
                    : `${vigente.qtd_linhas} → ${resultado.resumo.qtdDepartamentos}`
                }
              />
            </div>

            {semDiferenca(resultado.resumo.faturamento - vigente.total_faturamento) &&
            semDiferenca(resultado.resumo.margem - vigente.total_margem_valor) ? (
              <p className="text-sm font-medium text-positivo">Os totais são iguais aos da v{vigente.versao}.</p>
            ) : (
              <p className="text-sm font-medium text-destructive">
                Os totais mudam em relação à v{vigente.versao}. Confira antes de confirmar.
              </p>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={registrar.isPending}>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={gravar} disabled={registrar.isPending}>
                {registrar.isPending ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
                {registrar.isPending ? 'Registrando…' : `Confirmar v${versaoPrevista}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

/** Linha do resumo na janela de confirmação. */
function LinhaConfirmacao({ rotulo, dif, texto }: { rotulo: string; dif?: number; texto?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{rotulo}</span>
      {dif != null ? <SeloDiferenca dif={dif} /> : <span className="font-medium tabular-nums">{texto}</span>}
    </div>
  )
}

