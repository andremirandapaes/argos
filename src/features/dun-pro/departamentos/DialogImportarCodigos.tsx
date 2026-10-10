import { useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { FileSpreadsheet, Save, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { colunaNumerica, temaArgos } from '@/lib/aggrid'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { useAplicarCodigos, type Departamento } from './api-departamentos'
import { casarLista, lerLista, type ResultadoItem, type SituacaoCodigo } from './lista-codigos'

const ROTULO: Record<SituacaoCodigo, string> = {
  preencher: 'Será gravado',
  'ja-correto': 'Já está certo',
  'codigo-diferente': 'Já tem outro código',
  'codigo-em-uso': 'Código já usado',
  'nao-encontrado': 'Não encontrado',
}
// classes literais para o Tailwind enxergar
const COR: Record<SituacaoCodigo, string> = {
  preencher: 'border-positivo/30 bg-positivo/12 text-positivo',
  'ja-correto': 'border-transparent bg-muted text-muted-foreground',
  'codigo-diferente': 'border-alerta-foreground/30 bg-alerta text-alerta-foreground',
  'codigo-em-uso': 'border-destructive/30 bg-destructive/12 text-destructive',
  'nao-encontrado': 'border-destructive/30 bg-destructive/12 text-destructive',
}

function explicacao(r: ResultadoItem) {
  switch (r.situacao) {
    case 'codigo-diferente':
      return `Mantém o código atual (${r.codigoAtual}).`
    case 'codigo-em-uso':
      return `O código ${r.codigo} já é de: ${r.donoDoCodigo}.`
    case 'nao-encontrado':
      return 'Nenhum departamento com esse nome.'
    default:
      return ''
  }
}

const COLUNAS: ColDef<ResultadoItem>[] = [
  { field: 'linha', headerName: 'LINHA', ...colunaNumerica, width: 80 },
  { field: 'codigo', headerName: 'CÓD.', ...colunaNumerica, width: 90 },
  { field: 'nome', headerName: 'DEPARTAMENTO', minWidth: 220, flex: 1.4 },
  {
    field: 'situacao',
    headerName: 'SITUAÇÃO',
    headerClass: 'ag-centro',
    width: 170,
    cellRenderer: (p: { value: SituacaoCodigo }) => (
      <div className="flex h-full items-center justify-center">
        <Badge variant="outline" className={cn('font-medium', COR[p.value])}>
          {ROTULO[p.value]}
        </Badge>
      </div>
    ),
  },
  { colId: 'detalhe', headerName: 'DETALHE', minWidth: 220, flex: 1.2, valueGetter: (p) => (p.data ? explicacao(p.data) : ''), cellClass: 'text-muted-foreground' },
]

/** Importa a lista "código Winthor × departamento" com prévia; só grava os departamentos sem código. */
export function DialogImportarCodigos({
  aberto,
  onFechar,
  departamentos,
}: {
  aberto: boolean
  onFechar: () => void
  departamentos: Departamento[]
}) {
  const input = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [resultado, setResultado] = useState<ResultadoItem[] | null>(null)
  const [ignoradas, setIgnoradas] = useState<number[]>([])
  const [lendo, setLendo] = useState(false)
  const aplicar = useAplicarCodigos()

  const aGravar = useMemo(() => (resultado ?? []).filter((r) => r.situacao === 'preencher'), [resultado])
  const contagem = useMemo(() => {
    const c: Partial<Record<SituacaoCodigo, number>> = {}
    for (const r of resultado ?? []) c[r.situacao] = (c[r.situacao] ?? 0) + 1
    return c
  }, [resultado])

  async function escolher(f: File | undefined) {
    if (!f) return
    setArquivo(f)
    setLendo(true)
    try {
      const { itens, ignoradas: ign } = await lerLista(f)
      setResultado(casarLista(itens, departamentos))
      setIgnoradas(ign)
    } catch (e) {
      toast.error('Não foi possível ler o arquivo: ' + (e as Error).message)
      setResultado(null)
    } finally {
      setLendo(false)
    }
  }

  function fechar() {
    if (aplicar.isPending) return
    setArquivo(null)
    setResultado(null)
    setIgnoradas([])
    aplicar.reset()
    onFechar()
  }

  function gravar() {
    aplicar.mutate(
      aGravar.map((r) => ({ id: r.departamentoId!, codigo: r.codigo })),
      {
        onSuccess: ({ aplicados, falhas }) => {
          if (falhas.length) toast.warning(`${aplicados} código(s) gravado(s); ${falhas.length} falharam: ${falhas[0].mensagem}`)
          else toast.success(`${aplicados} código(s) gravado(s).`)
          fechar()
        },
        onError: (e) => toast.error('Não foi possível gravar: ' + e.message),
      },
    )
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && fechar()}>
      <DialogContent className="data-[size=default]:sm:max-w-4xl sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importar códigos Winthor</DialogTitle>
          <DialogDescription>
            Planilha ou CSV com duas colunas, em qualquer ordem: <strong>código</strong> e <strong>nome do departamento</strong>.
            Só os departamentos <strong>sem código</strong> recebem o código; os demais ficam como estão.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-kpi-fat/15 text-kpi-fat">
            <FileSpreadsheet />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            {arquivo ? <span className="truncate font-medium">{arquivo.name}</span> : <span className="text-muted-foreground">Nenhum arquivo escolhido</span>}
          </div>
          <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={lendo || aplicar.isPending}>
            {lendo ? <Spinner data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
            {arquivo ? 'Trocar arquivo' : 'Escolher arquivo'}
          </Button>
          <input
            ref={input}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={(e) => {
              escolher(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>

        {resultado && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{resultado.length} linhas:</span>
              {(Object.keys(ROTULO) as SituacaoCodigo[])
                .filter((s) => contagem[s])
                .map((s) => (
                  <Badge key={s} variant="outline" className={cn('font-medium', COR[s])}>
                    {ROTULO[s]}: {contagem[s]}
                  </Badge>
                ))}
              {ignoradas.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  (ignoradas: linha{ignoradas.length > 1 ? 's' : ''} {ignoradas.join(', ')} — cabeçalho ou incompletas)
                </span>
              )}
            </div>
            <div className="h-[min(380px,45svh)] overflow-hidden rounded-lg border">
              <AgGridReact<ResultadoItem>
                theme={temaArgos}
                rowData={resultado}
                columnDefs={COLUNAS}
                defaultColDef={{ sortable: true, resizable: true, suppressMovable: true }}
                suppressCellFocus
              />
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={aplicar.isPending}>
            Cancelar
          </Button>
          <Button onClick={gravar} disabled={aGravar.length === 0 || aplicar.isPending}>
            {aplicar.isPending ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            {aplicar.isPending ? 'Gravando…' : `Gravar ${aGravar.length} código(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
