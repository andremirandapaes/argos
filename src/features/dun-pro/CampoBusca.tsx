import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

/** Busca de departamento por nome ou código (Esc ou × limpam). */
export function CampoBusca({ valor, onMudar }: { valor: string; onMudar: (valor: string) => void }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onMudar('')}
        placeholder="Buscar departamento ou código"
        aria-label="Buscar departamento"
        className="h-8 w-72 pr-8 pl-8 hover:border-ring/60"
      />
      {valor && (
        <button
          type="button"
          onClick={() => onMudar('')}
          aria-label="Limpar busca"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
