import { useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Search } from 'lucide-react'
import { papelAtende } from '@/auth/usePerfil'
import { MODULOS, rotaDaTela } from '@/modulos'
import type { Papel } from '@/types/database'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Busca de telas (Ctrl+K): lista todas as telas que o papel pode ver e vai direto para a escolhida. */
export function BuscaTelas({ aberto, onFechar, papel }: { aberto: boolean; onFechar: () => void; papel: Papel | null }) {
  const navigate = useNavigate()
  const [termo, setTermo] = useState('')
  const [selecionada, setSelecionada] = useState(0)

  const todas = useMemo(
    () =>
      MODULOS.flatMap((m) =>
        m.telas
          .filter((t) => papelAtende(papel, t.papelMinimo))
          .map((t) => ({ rota: rotaDaTela(m, t), titulo: t.titulo, modulo: m.titulo, icone: t.icone })),
      ),
    [papel],
  )
  const resultados = useMemo(() => {
    const t = normalizar(termo.trim())
    return t ? todas.filter((x) => normalizar(`${x.titulo} ${x.modulo}`).includes(t)) : todas
  }, [todas, termo])

  const fechar = () => {
    setTermo('')
    setSelecionada(0)
    onFechar()
  }
  const ir = (rota: string) => {
    fechar()
    navigate(rota)
  }
  const teclas = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelecionada((i) => Math.min(resultados.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelecionada((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' && resultados[selecionada]) {
      e.preventDefault()
      ir(resultados[selecionada].rota)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && fechar()}>
      <DialogContent className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogTitle className="sr-only">Buscar tela</DialogTitle>
        <DialogDescription className="sr-only">Digite para filtrar e Enter para abrir a tela.</DialogDescription>
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value)
              setSelecionada(0)
            }}
            onKeyDown={teclas}
            placeholder="Buscar tela…"
            aria-label="Buscar tela"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-2" role="listbox" aria-label="Telas">
          {resultados.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhuma tela encontrada.</li>}
          {resultados.map((r, i) => (
            <li key={r.rota} role="option" aria-selected={i === selecionada}>
              <button
                type="button"
                onMouseEnter={() => setSelecionada(i)}
                onClick={() => ir(r.rota)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm',
                  i === selecionada ? 'bg-accent text-accent-foreground' : 'text-foreground',
                )}
              >
                <r.icone className={cn('size-4 shrink-0', i === selecionada ? 'text-primary' : 'text-muted-foreground')} />
                <span className="flex-1 truncate">{r.titulo}</span>
                <span className="truncate text-xs text-muted-foreground">{r.modulo}</span>
                {i === selecionada && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
