import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { AlertTriangle, Briefcase, Building2, Info, Save, Truck, Users } from 'lucide-react'
import { toast } from 'sonner'
import { usePerfil } from '@/auth/usePerfil'
import { Indicador } from '@/components/Indicador'
import { compararDistribuidoras } from '@/lib/distribuidoras'
import { colunaNumerica, temaArgos } from '@/lib/aggrid'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { SeletorArquivo } from '@/features/dun-pro/importacao/SeletorArquivo'
import { useFontesHeadcount } from '../api'
import { AREAS, mesesAteHoje, padronizarDepartamento, rotuloMes } from '../regras'
import { fmtPessoas } from '../componentes'
import { lerAbas, useRegistrarBaseSistema } from './api-importacao'
import {
  LOGISTICA_DO_SISTEMA_DESDE,
  competenciaDoArquivo,
  ehExportacaoSistema,
  lerExportacaoSistema,
  type AbaPlanilha,
  type BaseSistema,
} from './ler-sistema'

type Leitura =
  | { estado: 'vazio' }
  | { estado: 'lendo'; arquivo: File }
  | { estado: 'lido'; arquivo: File; abas: AbaPlanilha[] }
  | { estado: 'falhou'; arquivo: File; mensagem: string }

type LinhaResumo = { id: string; area: string; uf: string; detalhe: string; centro: string; pessoas: number; total?: boolean }

const COLUNAS: ColDef<LinhaResumo>[] = [
  { field: 'area', headerName: 'ÁREA', width: 130, cellClass: (p) => (p.data?.total ? 'font-semibold' : undefined) },
  { field: 'uf', headerName: 'FILIAL', width: 90, ...colunaNumerica },
  { field: 'detalhe', headerName: 'DISTRIBUIDORA / DEPARTAMENTO / SETOR', flex: 1, minWidth: 240 },
  { field: 'centro', headerName: 'CENTRO', width: 120, ...colunaNumerica },
  { field: 'pessoas', headerName: 'PESSOAS', width: 110, ...colunaNumerica, valueFormatter: (p) => fmtPessoas(p.value) },
]

/** Atualizar bases do HeadCount: exportação do sistema (FPRE), uma por mês. */
export default function AtualizarBasesPage() {
  const navigate = useNavigate()
  const { podeEditar } = usePerfil()
  const fontes = useFontesHeadcount()
  const registrar = useRegistrarBaseSistema()
  const [leitura, setLeitura] = useState<Leitura>({ estado: 'vazio' })
  const [competenciaEscolhida, setCompetenciaEscolhida] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const leituraAtual = useRef(0) // descarta leituras antigas se trocar de arquivo no meio
  const meses = useMemo(() => mesesAteHoje(), [])

  async function escolherArquivo(arquivo: File) {
    const id = ++leituraAtual.current
    registrar.reset()
    setCompetenciaEscolhida(null)
    setLeitura({ estado: 'lendo', arquivo })
    try {
      const abas = await lerAbas(arquivo)
      if (id !== leituraAtual.current) return
      if (!ehExportacaoSistema(abas, arquivo.name)) {
        setLeitura({
          estado: 'falhou',
          arquivo,
          mensagem: 'Este arquivo não parece a exportação do sistema ("Relação de Colaboradores", arquivo FPRE…). Confira o arquivo.',
        })
        return
      }
      setLeitura({ estado: 'lido', arquivo, abas })
    } catch (e) {
      if (id === leituraAtual.current) setLeitura({ estado: 'falhou', arquivo, mensagem: (e as Error).message || 'Arquivo ilegível.' })
    }
  }

  // a leitura depende da competência (a Logística só entra de Set/26 em diante)
  const competencia = leitura.estado === 'lido' ? (competenciaEscolhida ?? competenciaDoArquivo(leitura.arquivo.name)) : null
  const base: BaseSistema | null = useMemo(
    () =>
      leitura.estado === 'lido' ? lerExportacaoSistema(leitura.abas, leitura.arquivo.name, competencia ? { competencia } : {}) : null,
    [leitura, competencia],
  )

  const resumo = useMemo(() => {
    const porArea: Record<string, Record<string, number>> = {}
    const linhas = new Map<string, LinhaResumo>()
    for (const l of base?.linhas ?? []) {
      porArea[l.area] ??= {}
      porArea[l.area][l.uf] = (porArea[l.area][l.uf] || 0) + l.quantidade
      const detalhe = l.area === 'Comercial' ? (l.distribuidora ?? '—') : l.departamento ? padronizarDepartamento(l.departamento) : '—'
      const id = [l.area, l.uf, detalhe, l.centro ?? ''].join('|')
      const atual = linhas.get(id) ?? { id, area: l.area, uf: l.uf, detalhe, centro: l.centro ?? '—', pessoas: 0 }
      atual.pessoas += l.quantidade
      linhas.set(id, atual)
    }
    const ordemCentro: Record<string, number> = { Vendas: 0, Merchan: 1 }
    const lista = [...linhas.values()].sort(
      (a, b) =>
        AREAS.indexOf(a.area as never) - AREAS.indexOf(b.area as never) ||
        a.uf.localeCompare(b.uf) ||
        (a.area === 'Comercial' ? compararDistribuidoras(a.detalhe, b.detalhe) : a.detalhe.localeCompare(b.detalhe)) ||
        (ordemCentro[a.centro] ?? 9) - (ordemCentro[b.centro] ?? 9),
    )
    const total = lista.reduce((s, l) => s + l.pessoas, 0)
    return { porArea, lista, total }
  }, [base])

  const existente = competencia ? (fontes.data ?? []).find((f) => f.fonte === `sistema_${competencia}`) : undefined
  const logisticaDoSistema = !!competencia && competencia >= LOGISTICA_DO_SISTEMA_DESDE
  const podeSalvar = !!base && !!competencia && base.linhas.length > 0 && podeEditar && !registrar.isPending

  function salvar() {
    if (!base || !podeSalvar) return
    registrar.mutate(base, {
      onError: () => setConfirmando(false),
      onSuccess: () => {
        setConfirmando(false)
        toast.success(`Base de ${rotuloMes(competencia!)} salva no painel.`)
        navigate('/headcount/painel')
      },
    })
  }

  const porUf = (area: string) => {
    const v = resumo.porArea[area]
    if (!v) return { valor: '—', apoio: 'sem pessoas nesta base' }
    const total = Object.values(v).reduce((a, b) => a + b, 0)
    return { valor: fmtPessoas(total), apoio: Object.entries(v).map(([uf, n]) => `${uf} ${fmtPessoas(n)}`).join(' · ') }
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Atualizar bases</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          HeadCount · exportação do sistema ("Relação de Colaboradores"), um arquivo por mês. A base do mês substitui a anterior.
        </p>
      </div>

      {!podeEditar && (
        <Alert>
          <Info />
          <AlertDescription>Seu perfil só visualiza. Para atualizar as bases, é preciso ser editor ou administrador.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Arquivo</CardTitle>
          <CardDescription>O mês vem do nome do arquivo (ex.: FPRE0092026.xlsx = Set/26) e pode ser ajustado abaixo.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SeletorArquivo
            arquivo={leitura.estado === 'vazio' ? null : leitura.arquivo}
            onEscolher={escolherArquivo}
            onExtensaoInvalida={(nome) => toast.error(`"${nome}" não é .xls nem .xlsx.`)}
            desabilitado={registrar.isPending}
            texto="Arraste a exportação do sistema (FPRE) aqui ou clique para escolher"
            dica="Arquivo .xlsx · abas AM e RR"
          />
          {leitura.estado === 'lendo' && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Lendo a planilha…
            </p>
          )}
          {leitura.estado === 'falhou' && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>Não foi possível usar este arquivo</AlertTitle>
              <AlertDescription>{leitura.mensagem}</AlertDescription>
            </Alert>
          )}
          {base && (
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Competência</span>
                <Select
                  value={competencia ?? ''}
                  onValueChange={(v) => v && setCompetenciaEscolhida(v)}
                  items={meses.map((c) => ({ value: c, label: rotuloMes(c) }))}
                >
                  <SelectTrigger className="h-9 w-36" aria-label="Competência">
                    <SelectValue placeholder="Escolher" />
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
              </div>
              {competencia && (
                <Badge variant="secondary" className="h-9 px-3 font-normal">
                  {logisticaDoSistema
                    ? 'Logística (Depósito e Distribuição) vem desta base'
                    : 'Logística deste mês continua da planilha do Depósito'}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {base && competencia && (
        <>
          {existente && (
            <Alert className="border-alerta-foreground/30 bg-alerta text-alerta-foreground">
              <AlertTriangle />
              <AlertTitle>Já existe a base do sistema de {rotuloMes(competencia)}</AlertTitle>
              <AlertDescription className="text-alerta-foreground/90">
                Arquivo {existente.arquivo}
                {existente.importadoEm ? `, importado em ${new Date(existente.importadoEm).toLocaleDateString('pt-BR')}` : ', carga inicial'}.
                Ao salvar, ela será substituída por esta.
              </AlertDescription>
            </Alert>
          )}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo da base">
            <Indicador tom="destaque" icone={Users} rotulo={`CLT desta base · ${rotuloMes(competencia)}`} valor={fmtPessoas(resumo.total)} apoio={Object.entries(base.resumo).map(([uf, n]) => `${uf} ${fmtPessoas(n)}`).join(' · ')} />
            <Indicador icone={Briefcase} rotulo="Comercial" {...porUf('Comercial')} />
            <Indicador icone={Building2} rotulo="Backoffice" {...porUf('Backoffice')} />
            <Indicador
              icone={Truck}
              rotulo="Logística"
              {...(logisticaDoSistema ? porUf('Logística') : { valor: '—', apoio: 'vem da planilha do Depósito' })}
            />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>O que vai entrar no painel</CardTitle>
              <CardDescription>Só CLT: os terceirizados (INOVAR) não vêm do sistema.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <AgGridReact<LinhaResumo>
                  theme={temaArgos}
                  rowData={resumo.lista}
                  pinnedBottomRowData={[{ id: '__total', area: 'Total', uf: '', detalhe: '', centro: '', pessoas: resumo.total, total: true }]}
                  columnDefs={COLUNAS}
                  defaultColDef={{ sortable: false, resizable: true, suppressMovable: true }}
                  getRowId={(p) => p.data.id}
                  domLayout="autoHeight"
                  suppressCellFocus
                />
              </div>
            </CardContent>
          </Card>

          {base.avisos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Avisos da leitura</CardTitle>
                <CardDescription>O que ficou fora do painel e os ajustes aplicados.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                  {base.avisos.map((a) => (
                    <li key={a} className="flex items-start gap-2">
                      <Info className="mt-0.5 size-4 shrink-0" />
                      {a}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {registrar.error && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>Não foi possível salvar</AlertTitle>
              <AlertDescription>{registrar.error.message}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLeitura({ estado: 'vazio' })} disabled={registrar.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => (existente ? setConfirmando(true) : salvar())} disabled={!podeSalvar}>
              {registrar.isPending ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              {registrar.isPending ? 'Salvando…' : 'Salvar no painel'}
            </Button>
          </div>
        </>
      )}

      {base && !competencia && (
        <Alert className="border-alerta-foreground/30 bg-alerta text-alerta-foreground">
          <AlertTriangle />
          <AlertDescription className="text-alerta-foreground/90">Escolha a competência do arquivo para ver o resumo.</AlertDescription>
        </Alert>
      )}

      <AlertDialog open={confirmando} onOpenChange={(a) => !a && !registrar.isPending && setConfirmando(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir a base de {competencia ? rotuloMes(competencia) : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              A base do sistema que está no painel ({existente?.arquivo}) será trocada por {leitura.estado !== 'vazio' ? leitura.arquivo.name : ''}.
              Não há versões no HeadCount: a anterior deixa de existir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={registrar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={salvar} disabled={registrar.isPending}>
              {registrar.isPending ? 'Salvando…' : 'Substituir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
