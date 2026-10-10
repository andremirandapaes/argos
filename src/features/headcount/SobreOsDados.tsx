import { useMemo } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { FonteHeadcount } from './api'
import { competencias, lacunas, rotuloMes, semSeparacaoVinculo, type Linha } from './regras'

const NOME_FONTE: Record<string, string> = {
  comercial_am: 'Comercial AM',
  comercial_rr: 'Comercial RR',
  logistica: 'Logística (Depósito AM e RR)',
  backoffice_am: 'Backoffice AM',
  backoffice_rr: 'Backoffice RR',
}
export const nomeFonte = (f: Pick<FonteHeadcount, 'fonte' | 'tipo' | 'competencias'>) =>
  f.tipo === 'sistema'
    ? `Sistema, ${f.competencias[0] ? rotuloMes(f.competencias[0]) : 'mês a definir'}`
    : (NOME_FONTE[f.fonte] ?? f.fonte)

const REGRAS = [
  'Headcount = colaboradores ativos no último dia do mês.',
  'Meses com exportação do sistema usam o sistema como fonte do Comercial e do Backoffice: área, distribuidora e centro (Vendas ou Merchan) vêm do centro de custo. Ficam fora: Diretoria, Dunorte Professional, Abastex (Contact Center), Núcleo de Inteligência Comercial e Unidades. Adm. Compras e Trade Marketing entram no Backoffice.',
  'Logística até Dez/25: planilha do Depósito, que passa por auditoria. De Jan/26 em diante: exportação do sistema (Depósito e Distribuição), com o tratamento que reproduz a planilha auditada (pessoas lotadas no Depósito que são da Distribuição são contadas na Distribuição). Enquanto um mês não tiver a exportação enviada, vale a planilha do Depósito.',
  'Terceirizados (INOVAR) não vêm do sistema: são lançados no ARGOS por estado, departamento e quantidade. Nos meses sem lançamento, valem os das planilhas manuais.',
  'Backoffice RR só existe nos meses com exportação do sistema.',
  'Empresa segue o estado: AM é a Dunorte (matriz) e RR é a Super Giro (filial).',
  'Comercial: vale só o que está dentro do quadro de cada equipe, até a linha TOTAL. Tudo é CLT, exceto linhas identificadas como terceirizado/INOVAR.',
  'Mix Norte passou a ter funcionários próprios em Ago/26; antes disso não existia.',
  'Logística: cargos detalhados de Jan/26 em diante (CLT). Terceirizados entram como total, sem cargo, separados por setor quando lançados no ARGOS.',
  'Backoffice: total por departamento, tratado como CLT.',
  'Sem detalhamento por cargo, a tabela mostra só o total. Nunca se preenche com zero nem se estima a distribuição.',
]

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold">{titulo}</h4>
      {children}
    </section>
  )
}

/** "Sobre os dados": regras, meses faltando, padronizações de nomes e bases carregadas (recolhido por padrão). */
export function SobreOsDados({
  fontes,
  linhas,
  mesesTerceirizados,
}: {
  fontes: FonteHeadcount[]
  linhas: readonly Linha[]
  mesesTerceirizados: string[]
}) {
  const ultimo = useMemo(() => competencias(linhas).at(-1), [linhas])
  const todas = useMemo(() => lacunas(linhas, ultimo), [linhas, ultimo])
  const faltando = todas.filter((l) => l.tipo === 'lacuna')
  const previstos = todas.filter((l) => l.tipo === 'previsto')
  const semVinculo = useMemo(() => semSeparacaoVinculo(linhas), [linhas])
  const padronizacoes = useMemo(() => {
    const m = new Map<string, string>()
    fontes.forEach((f) => f.padronizacoes.forEach(([de, para]) => m.set(de, para)))
    return [...m].sort((a, b) => a[1].localeCompare(b[1]))
  }, [fontes])
  const avisos = fontes.flatMap((f) => f.avisos.map((a) => `${nomeFonte(f)}: ${a}`))

  return (
    <Collapsible className="group/sobre rounded-xl border bg-card">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-5 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <h3 className="text-base font-semibold">Sobre os dados</h3>
            <p className="text-sm text-muted-foreground">Regras, lacunas das bases e padronizações de nomes</p>
          </div>
        </div>
        <ChevronDown className="size-5 text-muted-foreground transition-transform group-data-open/sobre:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid gap-8 border-t p-5 text-sm leading-relaxed md:grid-cols-2">
          <Secao titulo="Regras aplicadas">
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {REGRAS.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Secao>

          <Secao titulo="Meses faltando nas bases">
            {faltando.length === 0 ? (
              <p className="text-muted-foreground">Nenhum mês faltando.</p>
            ) : (
              <ul className="space-y-1 text-muted-foreground">
                {faltando.map((l) => (
                  <li key={l.seg}>
                    <span className="text-foreground">{l.seg}:</span> {l.faixas.join(', ')}
                  </li>
                ))}
              </ul>
            )}
            {previstos.length > 0 && ultimo && (
              <>
                <h4 className="mt-3 text-sm font-semibold">Entram junto com o mês equivalente de {ultimo.slice(0, 4)}</h4>
                <p className="text-muted-foreground">
                  O ano anterior é preenchido mês a mês, ao fechar o mesmo mês do ano corrente. Até lá, estes meses ficam sem valor e o
                  total aparece como parcial.
                </p>
                <ul className="space-y-1 text-muted-foreground">
                  {previstos.map((l) => (
                    <li key={l.seg}>
                      <span className="text-foreground">{l.seg}:</span> {l.faixas.join(', ')}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {semVinculo.length > 0 && (
              <>
                <h4 className="mt-3 text-sm font-semibold">Sem separação CLT/terceirizado</h4>
                <ul className="space-y-1 text-muted-foreground">
                  {semVinculo.map((s) => (
                    <li key={s.seg}>
                      <span className="text-foreground">{s.seg}:</span> {s.faixa} (só o total da área). Entra no filtro "Ambos", mas não
                      em CLT nem em Terceirizado.
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Secao>

          <Secao titulo="Padronizações de nomes">
            <ul className="space-y-1 text-muted-foreground">
              {padronizacoes.map(([de, para]) => (
                <li key={de}>
                  <span className="font-mono text-xs text-foreground">{de}</span> passou a <span className="text-foreground">{para}</span>
                </li>
              ))}
              <li>Nomes de equipe: Mega Marcas = Dunorte, Big Marcas = Meta Norte, Super Marcas = Elo Norte.</li>
              <li>Acentos e caixa dos cargos foram normalizados (ex.: LOGISTICA passou a Logística).</li>
            </ul>
          </Secao>

          <Secao titulo="Bases carregadas">
            <ul className="space-y-1 text-muted-foreground">
              {fontes.map((f) => (
                <li key={f.fonte}>
                  <span className="text-foreground">{nomeFonte(f)}</span>: {f.arquivo}, {rotuloMes(f.competencias[0])} a{' '}
                  {rotuloMes(f.competencias.at(-1)!)}
                  {f.importadoEm ? `, importada em ${new Date(f.importadoEm).toLocaleDateString('pt-BR')}` : ', carga inicial'}
                </li>
              ))}
            </ul>
            {mesesTerceirizados.length > 0 && (
              <p className="mt-2 text-muted-foreground">
                <span className="text-foreground">Terceirizados lançados:</span> {mesesTerceirizados.map(rotuloMes).join(', ')}
              </p>
            )}
            {avisos.length > 0 && (
              <>
                <h4 className="mt-3 text-sm font-semibold">Avisos de conferência</h4>
                <ul className="list-disc space-y-1 pl-5 text-alerta-foreground">
                  {avisos.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </>
            )}
          </Secao>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
