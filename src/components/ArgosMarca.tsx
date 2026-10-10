import simbolo from '@/assets/marca/argos-simbolo.svg'
import { cn } from '@/lib/utils'

/** Marca Argos: símbolo oficial (olho de pavão em 4 camadas) + logotipo na serifada da marca. */
export function ArgosMarca({ className, compacta = false }: { className?: string; compacta?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img src={simbolo} alt="" aria-hidden className="size-9 shrink-0" draggable={false} />
      {!compacta && (
        <div className="flex flex-col leading-none">
          <span className="font-marca text-[23px] leading-none">Argos</span>
          <span className="mt-1 text-[10px] tracking-wide opacity-60">Grupo Medeiros · NIC</span>
        </div>
      )}
    </div>
  )
}
