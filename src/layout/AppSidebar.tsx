import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronRight, ChevronsUpDown, KeyRound, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useSessao } from '@/auth/sessao-context'
import { papelAtende, usePerfil } from '@/auth/usePerfil'
import { MODULOS, rotaDaTela, type Modulo } from '@/modulos'
import type { Papel } from '@/types/database'
import { ROTULO_PAPEL } from '@/features/admin/papeis'
import { FormTrocarSenha } from '@/auth/FormTrocarSenha'
import { ArgosMarca } from '@/components/ArgosMarca'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'

const ROTULO_GRUPO = 'text-[11px] font-semibold tracking-wider uppercase'

function iniciais(texto: string) {
  return texto
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

function rotaAtiva(pathname: string, rota: string) {
  return pathname === rota || pathname.startsWith(rota + '/')
}

function telasVisiveis(modulo: Modulo, papel: Papel | null) {
  return modulo.telas.filter((t) => papelAtende(papel, t.papelMinimo))
}

/** Um módulo: item recolhível com as telas dentro. Recolhida a sidebar, vira link para a tela inicial. */
function ItemModulo({ modulo, papel }: { modulo: Modulo; papel: Papel | null }) {
  const { pathname } = useLocation()
  const { state, isMobile } = useSidebar()
  const telas = telasVisiveis(modulo, papel)
  const moduloAtivo = rotaAtiva(pathname, `/${modulo.id}`)
  const [aberto, setAberto] = useState(moduloAtivo)

  // ao navegar para dentro do módulo (por link ou URL), abre o item
  const [estavaAtivo, setEstavaAtivo] = useState(moduloAtivo)
  if (moduloAtivo !== estavaAtivo) {
    setEstavaAtivo(moduloAtivo)
    if (moduloAtivo) setAberto(true)
  }

  const cabecalho = (
    <>
      <modulo.icone />
      <div className="grid flex-1 text-left leading-tight">
        <span className="truncate font-medium">{modulo.titulo}</span>
        {modulo.subtitulo && <span className="truncate text-xs opacity-60">{modulo.subtitulo}</span>}
      </div>
    </>
  )

  if (state === 'collapsed' && !isMobile) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          render={<NavLink to={`/${modulo.id}/${modulo.telaInicial}`} />}
          isActive={moduloAtivo}
          tooltip={modulo.titulo}
        >
          {cabecalho}
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Collapsible open={aberto} onOpenChange={setAberto} render={<SidebarMenuItem />}>
      <CollapsibleTrigger render={<SidebarMenuButton size="lg" />}>
        {cabecalho}
        <ChevronRight className="ml-auto opacity-60 transition-transform duration-200 in-data-panel-open:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub className="mt-0.5">
          {telas.map((tela) => {
            const rota = rotaDaTela(modulo, tela)
            return (
              <SidebarMenuSubItem key={rota}>
                <SidebarMenuSubButton
                  render={<NavLink to={rota} />}
                  isActive={rotaAtiva(pathname, rota)}
                  className="h-8 data-active:font-medium data-active:text-white [&>svg]:text-sidebar-foreground/60 data-active:[&>svg]:text-sidebar-primary"
                >
                  <tela.icone />
                  <span>{tela.titulo}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )
          })}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Telas do sistema (ex.: Administração): lista simples, sem recolher. */
function GrupoSistema({ modulo, papel }: { modulo: Modulo; papel: Papel | null }) {
  const { pathname } = useLocation()
  const telas = telasVisiveis(modulo, papel)
  if (telas.length === 0) return null

  return (
    <SidebarGroup>
      <SidebarGroupLabel className={ROTULO_GRUPO}>{modulo.titulo}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {telas.map((tela) => {
            const rota = rotaDaTela(modulo, tela)
            return (
              <SidebarMenuItem key={rota}>
                <SidebarMenuButton
                  render={<NavLink to={rota} />}
                  isActive={rotaAtiva(pathname, rota)}
                  tooltip={tela.titulo}
                  className="data-active:text-white data-active:[&_svg]:text-sidebar-primary"
                >
                  <tela.icone />
                  <span>{tela.titulo}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppSidebar() {
  const { sessao } = useSessao()
  const { papel, nome } = usePerfil()
  const email = sessao?.user.email ?? ''
  const exibicao = nome || email
  const [trocandoSenha, setTrocandoSenha] = useState(false)

  const modulos = MODULOS.filter((m) => m.area === 'modulo' && telasVisiveis(m, papel).length > 0)
  const sistema = MODULOS.filter((m) => m.area === 'sistema')

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4 group-data-[collapsible=icon]:px-2">
        <ArgosMarca className="group-data-[collapsible=icon]:[&>div:last-child]:hidden" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={ROTULO_GRUPO}>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {modulos.map((modulo) => (
                <ItemModulo key={modulo.id} modulo={modulo} papel={papel} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* bloco do sistema fica no pé do menu */}
        <div className="mt-auto">
          {sistema.map((modulo) => (
            <GrupoSistema key={modulo.id} modulo={modulo} papel={papel} />
          ))}
        </div>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<SidebarMenuButton size="lg" className="data-popup-open:bg-sidebar-accent" />}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-xs font-semibold">
                  {iniciais(exibicao) || '?'}
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-medium">{exibicao}</span>
                  <span className="truncate text-xs opacity-60">{papel ? ROTULO_PAPEL[papel] : ''}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="min-w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="text-sm font-medium text-foreground">{exibicao}</div>
                    <div className="text-xs text-muted-foreground">{email}</div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTrocandoSenha(true)}>
                  <KeyRound />
                  Trocar senha
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => supabase.auth.signOut()}>
                  <LogOut />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />

      <Dialog open={trocandoSenha} onOpenChange={setTrocandoSenha}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Trocar senha</DialogTitle>
            <DialogDescription>A senha nova vale a partir do próximo login.</DialogDescription>
          </DialogHeader>
          {trocandoSenha && (
            <FormTrocarSenha
              onConcluido={() => {
                setTrocandoSenha(false)
                toast.success('Senha alterada.')
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}
