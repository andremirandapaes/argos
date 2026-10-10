import { useMemo, useState } from 'react'
import { Link, Route, Routes, useSearchParams } from 'react-router-dom'
import { AlertTriangle, GitCompareArrows } from 'lucide-react'
import { toast } from 'sonner'
import { usePerfil } from '@/auth/usePerfil'
import { NOME_DUNO_PRO } from '@/lib/constantes'
import { formatarMes } from '@/lib/format'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useDistribuidora, useTotaisMensais } from '../api'
import { baixarArquivoOriginal, useCargasDoAno, useNomesPerfis, versaoParaComparar, type Carga } from './api-versoes'
import ComparacaoPage from './ComparacaoPage'
import { DialogTornarVigente } from './DialogTornarVigente'
import { TabelaVersoes, type ContextoVersoes } from './TabelaVersoes'

/** Rotas do Histórico: a lista (índice) e a comparação entre versões. */
export default function HistoricoPage() {
  return (
    <Routes>
      <Route index element={<ListaHistorico />} />
      <Route path="comparar" element={<ComparacaoPage />} />
    </Routes>
  )
}

/** Link da comparação padrão de um mês: vigente contra a anterior. */
function linkComparacao(versoes: Carga[]) {
  const vigente = versoes.find((v) => v.vigente)
  if (!vigente) return null
  const outra = versaoParaComparar(versoes, vigente)
  if (!outra) return null
  // A = a mais antiga das duas; B = a mais nova
  const [a, b] = outra.versao < vigente.versao ? [outra, vigente] : [vigente, outra]
  return `comparar?a=${a.id}&b=${b.id}`
}

function ListaHistorico() {
  const { podeEditar } = usePerfil()
  const [params, setParams] = useSearchParams()
  const distribuidora = useDistribuidora()
  const distId = distribuidora.data?.id
  const totais = useTotaisMensais(distId)
  const nomes = useNomesPerfis()
  const [alvo, setAlvo] = useState<Carga | null>(null)

  const anos = useMemo(
    () => [...new Set((totais.data ?? []).map((t) => Number(t.mes_ref!.slice(0, 4))))].sort((a, b) => b - a),
    [totais.data],
  )
  const ano = Number(params.get('ano')) || anos[0]
  const cargas = useCargasDoAno(distId, ano)

  // agrupa por mês, mantendo a ordem (mês mais recente primeiro; versão mais nova primeiro)
  const porMes = useMemo(() => {
    const grupos = new Map<string, Carga[]>()
    for (const c of cargas.data ?? []) grupos.set(c.mes_ref, [...(grupos.get(c.mes_ref) ?? []), c])
    return [...grupos.entries()]
  }, [cargas.data])

  const contexto: ContextoVersoes = useMemo(
    () => ({
      nomes: nomes.data,
      podeEditar,
      onTornarVigente: setAlvo,
      onBaixar: (c) =>
        baixarArquivoOriginal(c.arquivo_path!, c.arquivo_nome).catch((e: Error) =>
          toast.error(`Não foi possível baixar o arquivo: ${e.message}`),
        ),
    }),
    [nomes.data, podeEditar],
  )

  const vigenteDoAlvo = alvo ? (porMes.find(([mes]) => mes === alvo.mes_ref)?.[1].find((v) => v.vigente) ?? null) : null
  const carregando = distribuidora.isPending || totais.isPending || cargas.isPending
  const erro = distribuidora.error ?? totais.error ?? cargas.error

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Histórico de Cargas</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {NOME_DUNO_PRO} · todas as versões da base do Winthor, mês a mês. Nada é apagado: só muda qual versão é a vigente.
          </p>
        </div>
        {anos.length > 0 && (
          <Select
            value={ano ?? null}
            onValueChange={(v) => v && setParams({ ano: String(v) }, { replace: true })}
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
        )}
      </div>

      {erro && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Erro ao carregar o histórico</AlertTitle>
          <AlertDescription>{erro.message}</AlertDescription>
        </Alert>
      )}

      {carregando && !erro && (
        <div className="flex flex-col gap-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!carregando && !erro && porMes.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Nenhuma base enviada em {ano ?? 'nenhum ano'}</EmptyTitle>
            <EmptyDescription>As versões aparecem aqui depois da primeira importação do mês.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {porMes.map(([mes, versoes]) => {
        const link = linkComparacao(versoes)
        return (
          <Card key={mes}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {formatarMes(mes)}
                <Badge variant="secondary" className="font-normal">
                  {versoes.length} {versoes.length === 1 ? 'versão' : 'versões'}
                </Badge>
              </CardTitle>
              <CardAction>
                {link ? (
                  <Button variant="outline" size="sm" render={<Link to={link} />}>
                    <GitCompareArrows data-icon="inline-start" />
                    Comparar versões
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Só uma versão: nada para comparar</span>
                )}
              </CardAction>
            </CardHeader>
            <CardContent>
              <TabelaVersoes versoes={versoes} contexto={contexto} />
            </CardContent>
          </Card>
        )
      })}

      <DialogTornarVigente alvo={alvo} atual={vigenteDoAlvo} onFechar={() => setAlvo(null)} />
    </div>
  )
}
