import { Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Marca ARGOS: ícone (Argos, o gigante de cem olhos) + nome. Trocar aqui quando houver logo oficial. */
export function ArgosMarca({ className, compacta = false }: { className?: string; compacta?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
        <Eye className="size-4.5" strokeWidth={2.25} />
      </div>
      {!compacta && (
        <div className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-[0.2em]">ARGOS</span>
          <span className="mt-1 text-[10px] tracking-wide opacity-60">Grupo Medeiros · NIC</span>
        </div>
      )}
    </div>
  )
}
