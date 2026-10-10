import { Construction } from 'lucide-react'

export function EmConstrucao({ etapa }: { etapa: number }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center text-muted-foreground">
      <Construction className="size-8 opacity-60" />
      <p className="text-sm">Esta tela será construída na etapa {etapa}.</p>
    </div>
  )
}
