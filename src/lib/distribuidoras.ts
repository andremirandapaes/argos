// Diretriz interna do Grupo Medeiros: ordem e cor de cada distribuidora.
// Vale para todo o ARGOS (filtros, legendas, gráficos e tabelas): a cor segue a distribuidora,
// nunca a posição. Os tons (claro/escuro) estão em index.css (--dist-*) e foram validados
// para daltonismo com o dataviz validate_palette nesta ordem.

export const DISTRIBUIDORAS = [
  { nome: 'Dunorte', cor: 'var(--dist-dunorte)' }, // vermelho
  { nome: 'Meta Norte', cor: 'var(--dist-meta-norte)' }, // verde
  { nome: 'Elo Norte', cor: 'var(--dist-elo-norte)' }, // roxo/lilás
  { nome: 'Super Giro', cor: 'var(--dist-super-giro)' }, // amarelo
  { nome: 'Rota Norte', cor: 'var(--dist-rota-norte)' }, // azul claro
  { nome: 'Mix Norte', cor: 'var(--dist-mix-norte)' }, // azul escuro
] as const

const indice = (nome: string | null | undefined) => DISTRIBUIDORAS.findIndex((d) => d.nome === nome)

/** Posição na ordem oficial (fora da lista vai para o fim). */
export const ordemDistribuidora = (nome: string | null | undefined) => {
  const i = indice(nome)
  return i < 0 ? 99 : i
}

/** Cor oficial (fora da lista: cinza neutro). */
export const corDistribuidora = (nome: string | null | undefined) => {
  const i = indice(nome)
  return i < 0 ? 'var(--muted-foreground)' : DISTRIBUIDORAS[i].cor
}

/** Para ordenar: ordem oficial e, empatando, alfabética. */
export const compararDistribuidoras = (a: string, b: string) => ordemDistribuidora(a) - ordemDistribuidora(b) || a.localeCompare(b)
