import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronsUpDown, KeyRound, LogOut, PanelLeftClose, Pin, Search } from 'lucide-react'
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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { BuscaTelas } from './BuscaTelas'

// item ativo: pílula creme, texto forte e ícone em petróleo
const ITEM_ATIVO = 'data-active:font-medium data-active:[&>svg]:text-sidebar-primary'
const ICONE_SUAVE = '[&>svg]:text-sidebar-foreground/65'
// hover: brilho claro suave (fundo levemente aceso + contorno fino claro) para ir destacando a linha
const BRILHO =
  'transition-[background-color,box-shadow] duration-150 hover:bg-sidebar-hover hover:shadow-[inset_0_0_0_1px_var(--sidebar-hover-borda)] data-active:hover:bg-sidebar-accent'

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

/** Um módulo: grupo recolhível com as telas dentro (linha de árvore). Recolhida a sidebar, vira ícone com dica. */
function ItemModulo({ modulo, papel }: { modulo: Modulo; papel: Papel | null }) {
  const { pathname } = useLocation()
  const { state, isMobile } = useSidebar()
  const telas = telasVisiveis(modulo, papel)
  const moduloAtivo = rotaAtiva(pathname, `/${modulo.id}`)
  const [aberto, setAberto] = useState(moduloAtivo)

  // ao navegar para dentro do módulo (por link ou URL), abre o grupo
  const [estavaAtivo, setEstavaAtivo] = useState(moduloAtivo)
  if (moduloAtivo !== estavaAtivo) {
    setEstavaAtivo(moduloAtivo)
    if (moduloAtivo) setAberto(true)
  }

  if (state === 'collapsed' && !isMobile) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          render={<NavLink to={`/${modulo.id}/${modulo.telaInicial}`} />}
          isActive={moduloAtivo}
          tooltip={modulo.titulo}
          className={`${BRILHO} ${ITEM_ATIVO}`}
        >
          <modulo.icone />
          <span>{modulo.titulo}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Collapsible open={aberto} onOpenChange={setAberto} render={<SidebarMenuItem />}>
      <CollapsibleTrigger render={<SidebarMenuButton className={`${BRILHO} ${ICONE_SUAVE}`} title={modulo.subtitulo} />}>
        <modulo.icone />
        <span className="flex-1 truncate">{modulo.titulo}</span>
        <ChevronDown className="ml-auto -rotate-90 opacity-60 transition-transform duration-200 in-data-panel-open:rotate-0" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub className="mt-0.5 mr-0 gap-0.5 pr-0">
          {telas.map((tela) => {
            const rota = rotaDaTela(modulo, tela)
            return (
              <SidebarMenuSubItem key={rota}>
                <SidebarMenuSubButton
                  render={<NavLink to={rota} />}
                  isActive={rotaAtiva(pathname, rota)}
                  className={`h-8 ${BRILHO} ${ICONE_SUAVE} ${ITEM_ATIVO}`}
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

/** Telas do sistema (ex.: Usuários): itens simples no pé do menu, como "Configurações". */
function ItensSistema({ papel }: { papel: Papel | null }) {
  const { pathname } = useLocation()
  const itens = MODULOS.filter((m) => m.area === 'sistema').flatMap((m) =>
    telasVisiveis(m, papel).map((tela) => ({ rota: rotaDaTela(m, tela), tela })),
  )
  if (!itens.length) return null
  return (
    <SidebarMenu>
      {itens.map(({ rota, tela }) => (
        <SidebarMenuItem key={rota}>
          <SidebarMenuButton
            render={<NavLink to={rota} />}
            isActive={rotaAtiva(pathname, rota)}
            tooltip={tela.titulo}
            className={`${BRILHO} ${ICONE_SUAVE} ${ITEM_ATIVO}`}
          >
            <tela.icone />
            <span>{tela.titulo}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

/** Topo: logo + recolher/fixar e busca. Fica dentro da Sidebar para ler o estado dela (inclusive aberta pelo mouse). */
function Cabecalho({ onBuscar }: { onBuscar: () => void }) {
  const { state, isMobile, toggleSidebar, espiando } = useSidebar()
  const recolhida = state === 'collapsed' && !isMobile
  return (
    <SidebarHeader className="gap-3 p-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-1.5">
      {recolhida ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <button type="button" onClick={toggleSidebar} aria-label="Expandir menu" className={`rounded-md p-0.5 ${BRILHO}`} />
            }
          >
            <ArgosMarca compacta className="[&>img]:size-8" />
          </TooltipTrigger>
          <TooltipContent side="right">Expandir menu</TooltipContent>
        </Tooltip>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <ArgosMarca />
          {/* aberta só pelo mouse: o botão fixa aberta; aberta de verdade: o botão recolhe */}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label={espiando ? 'Manter menu aberto' : 'Recolher menu'}
                  className={`flex size-8 items-center justify-center rounded-md text-sidebar-foreground/65 hover:text-sidebar-foreground ${BRILHO}`}
                />
              }
            >
              {espiando ? <Pin className="size-4" /> : <PanelLeftClose className="size-4" />}
            </TooltipTrigger>
            <TooltipContent side="right">{espiando ? 'Manter menu aberto' : 'Recolher menu'}</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* busca de telas */}
      {recolhida ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => onBuscar()}
                aria-label="Buscar tela"
                className={`flex size-8 items-center justify-center rounded-md border border-sidebar-border text-sidebar-foreground/65 ${BRILHO}`}
              />
            }
          >
            <Search className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="right">Buscar tela (Ctrl+K)</TooltipContent>
        </Tooltip>
      ) : (
        <button
          type="button"
          onClick={() => onBuscar()}
          className={`flex h-9 w-full items-center gap-2 rounded-md border border-sidebar-border px-2.5 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground ${BRILHO}`}
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Buscar</span>
          <kbd className="rounded border border-sidebar-border px-1.5 py-px font-sans text-[11px] text-sidebar-foreground/60">Ctrl K</kbd>
        </button>
      )}
    </SidebarHeader>
  )
}

export function AppSidebar() {
  const { sessao } = useSessao()
  const { papel, nome } = usePerfil()
  const email = sessao?.user.email ?? ''
  const exibicao = nome || email
  const [trocandoSenha, setTrocandoSenha] = useState(false)
  const [buscando, setBuscando] = useState(false)

  // Ctrl+K (ou ⌘K) abre a busca de telas de qualquer lugar
  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setBuscando(true)
      }
    }
    window.addEventListener('keydown', atalho)
    return () => window.removeEventListener('keydown', atalho)
  }, [])

  const modulos = MODULOS.filter((m) => m.area === 'modulo' && telasVisiveis(m, papel).length > 0)

  return (
    <Sidebar variant="floating" collapsible="icon" abrirAoPassar>
      <Cabecalho onBuscar={() => setBuscando(true)} />

      <SidebarContent>
        <SidebarGroup className="pt-1">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {modulos.map((modulo) => (
                <ItemModulo key={modulo.id} modulo={modulo} papel={papel} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 p-3 group-data-[collapsible=icon]:px-1.5">
        <ItensSistema papel={papel} />
        <SidebarSeparator className="mx-0" />
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    tooltip={exibicao}
                    className={`rounded-lg border border-sidebar-border px-2 data-popup-open:bg-sidebar-accent group-data-[collapsible=icon]:border-0 ${BRILHO}`}
                  />
                }
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/12 text-xs font-semibold text-sidebar-primary">
                  {iniciais(exibicao) || '?'}
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-medium">{exibicao}</span>
                  <span className="truncate text-xs text-sidebar-foreground/60">{papel ? ROTULO_PAPEL[papel] : email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="min-w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="text-sm font-medium text-foreground">{exibicao}</div>
                    <div className="text-xs text-muted-foreground">
                      {email}
                      {papel ? ` · ${ROTULO_PAPEL[papel]}` : ''}
                    </div>
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

      <BuscaTelas aberto={buscando} onFechar={() => setBuscando(false)} papel={papel} />

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
