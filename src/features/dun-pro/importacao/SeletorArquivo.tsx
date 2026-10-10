import { useRef, useState, type DragEvent } from 'react'
import { FileSpreadsheet, RefreshCw, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const EXTENSOES = ['.xls', '.xlsx']

function extensaoValida(nome: string) {
  return EXTENSOES.some((ext) => nome.toLowerCase().endsWith(ext))
}

function tamanhoLegivel(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Área para soltar/escolher uma planilha (.xls ou .xlsx). Textos padrão: base do Winthor (Duno Pro). */
export function SeletorArquivo({
  arquivo,
  onEscolher,
  onExtensaoInvalida,
  desabilitado = false,
  texto = 'Arraste a planilha do Winthor aqui ou clique para escolher',
  dica = 'Arquivos .xls ou .xlsx · primeira aba, sem cabeçalho',
}: {
  arquivo: File | null
  onEscolher: (arquivo: File) => void
  onExtensaoInvalida: (nome: string) => void
  desabilitado?: boolean
  texto?: string
  dica?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = useState(false)

  function receber(lista: FileList | null) {
    const f = lista?.[0]
    if (!f) return
    if (!extensaoValida(f.name)) return onExtensaoInvalida(f.name)
    onEscolher(f)
  }

  function soltar(e: DragEvent) {
    e.preventDefault()
    setArrastando(false)
    if (!desabilitado) receber(e.dataTransfer.files)
  }

  const inputOculto = (
    <input
      ref={input}
      type="file"
      accept={EXTENSOES.join(',')}
      className="sr-only"
      disabled={desabilitado}
      onChange={(e) => {
        receber(e.target.files)
        e.target.value = '' // permite escolher o mesmo arquivo de novo
      }}
    />
  )

  if (arquivo) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-kpi-fat/15 text-kpi-fat">
          <FileSpreadsheet />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{arquivo.name}</span>
          <span className="text-xs text-muted-foreground">{tamanhoLegivel(arquivo.size)}</span>
        </div>
        <Button variant="outline" size="sm" disabled={desabilitado} onClick={() => input.current?.click()}>
          <RefreshCw data-icon="inline-start" />
          Trocar arquivo
        </Button>
        {inputOculto}
      </div>
    )
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault()
        if (!desabilitado) setArrastando(true)
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={soltar}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
        'hover:border-ring/60 hover:bg-accent/40',
        arrastando && 'border-ring bg-accent/60',
        desabilitado && 'pointer-events-none opacity-50',
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Upload />
      </div>
      <span className="text-sm font-medium">{texto}</span>
      <span className="text-xs text-muted-foreground">{dica}</span>
      {inputOculto}
    </label>
  )
}
