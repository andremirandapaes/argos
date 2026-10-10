import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { MODULOS, rotaDaTela } from '@/modulos'
import { TemaToggle } from '@/components/TemaToggle'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'

function useTelaAtual() {
  const { pathname } = useLocation()
  for (const modulo of MODULOS) {
    for (const tela of modulo.telas) {
      const rota = rotaDaTela(modulo, tela)
      if (pathname === rota || pathname.startsWith(rota + '/')) return { modulo, tela }
    }
  }
  return null
}

export function AppLayout() {
  const atual = useTelaAtual()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur">
          {/* no desktop o menu recolhe pelo botão da própria sidebar; o gatilho fica só no celular */}
          <SidebarTrigger className="-ml-1 md:hidden" />
          <Separator orientation="vertical" className="mx-1 h-4 self-center md:hidden" />
          {atual && (
            <div className="flex min-w-0 items-baseline gap-2 text-sm">
              <span className="truncate text-muted-foreground">{atual.modulo.titulo}</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="truncate font-medium">{atual.tela.titulo}</span>
            </div>
          )}
          <div className="ml-auto">
            <TemaToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col">
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
