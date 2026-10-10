# ARGOS — Módulo 1: Gerencial DUN PROFESSIONAL

> Prompt de implementação para o Claude Code.
> Itens marcados com **[AJUSTAR]** são decisões em aberto. Resolva antes de colar, ou deixe o Claude Code perguntar.

---

## 1. Contexto

O **ARGOS** é um sistema interno do NIC (Grupo Medeiros) para tirar os relatórios gerenciais do Excel. Ele é modular, e este é o primeiro módulo.

**O que o módulo substitui.** Hoje o gerencial mensal da DUN PROFESSIONAL é feito na planilha `Resultados_DUN_PROFESSIONAL_2026.xlsx`:

- Todo mês entra uma base do Winthor com faturamento líquido e margem % por departamento.
- Entra também a despesa total do mês.
- A despesa é rateada entre os departamentos pela participação de cada um no faturamento, e daí sai o lucro (LB¹) por departamento.

**Requisito central: histórico imutável.** Os dados do ERP às vezes mudam depois do fechamento, por erro operacional. Por isso:

- Toda base enviada e toda despesa lançada fica guardada como uma **versão**.
- Nada é sobrescrito ou apagado.
- Cada mês tem uma versão **vigente**.
- O usuário consegue comparar versões e ver o que mudou.

---

## 2. Stack

É a mesma do sistema de Contratos:

- **Front:** React, TypeScript, Vite, Tailwind e shadcn/ui. Use as skills `frontend-design-pessoal` e `shadcn`.
- **Tabelas:** AgGrid.
- **Gráficos:** Recharts.
- **Backend:** Supabase (Postgres, Auth, Storage e a API gerada automaticamente). **Sem backend próprio e sem Prisma.**
- **Migrations:** arquivos `.sql` em `supabase/migrations/`.
- **Tipos:** `supabase gen types typescript`.
- **Leitura de planilha:** SheetJS, instalado pelo CDN oficial, porque o pacote `xlsx` do npm está desatualizado: `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` **[AJUSTAR: conferir a versão mais recente em cdn.sheetjs.com]**.
- **Credenciais:** `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- **Sem AWS.** Os arquivos originais ficam no Supabase Storage.

---

## 3. Banco de dados (já pronto, não recriar)

O banco está definido e testado em `supabase/migrations/20260927000000_argos_inicial.sql`. **Leia o arquivo inteiro antes de começar.** Os comentários explicam cada regra.

### Regras que o front DEVE respeitar

1. **Nunca inserir, alterar ou apagar direto** em `cargas_faturamento`, `faturamento_linhas` ou `lancamentos_despesa`. O RLS bloqueia de qualquer forma. Toda gravação é via RPC:
   - `registrar_carga_faturamento(p_distribuidora_slug, p_mes_ref, p_linhas, p_arquivo_nome, p_arquivo_path, p_observacao)`. Cria uma nova versão do mês, já vigente.
   - `definir_carga_vigente(p_carga_id)`
   - `registrar_despesa(p_distribuidora_slug, p_mes_ref, p_valor_total, p_observacao)`
   - `definir_despesa_vigente(p_lancamento_id)`
   - `comparar_cargas_faturamento(p_carga_a, p_carga_b)`
2. **Nenhum cálculo financeiro no front.** Participação, rateio, LB¹, anual e percentuais vêm prontos das views. O front só formata.
3. **Percentuais nas views são frações** (`0.2281` = 22,81%). A única exceção é `faturamento_linhas.margem_pct`, que guarda o % como veio do Winthor.
4. `mes_ref` é sempre o dia 1 do mês (`2026-09-01`).
5. A distribuidora deste módulo tem o slug `dun-professional`.

### Views

| View | Uso |
|---|---|
| `vw_gerencial_mensal` | DUN PROFESSIONAL, mês a mês, por departamento |
| `vw_gerencial_mensal_total` | Linha TOTAL de cada mês e base do gráfico |
| `vw_gerencial_anual` | Bloco ANO por departamento (rateio pela participação anual) |
| `vw_gerencial_anual_total` | Total do ano |
| `vw_professional_mensal` / `vw_professional_anual` | Só os departamentos exclusivos PROFESSIONAL |
| `vw_faturamento_vigente` / `vw_despesa_vigente` | Dados crus da versão vigente |

### Perfis

A tabela `perfis` define três papéis:

- **admin:** pode tudo e gerencia usuários.
- **editor:** envia bases, lança despesas, troca versões e edita departamentos.
- **leitor:** só visualiza.

Um usuário sem perfil não vê nada. Use `rpc('papel_atual')` para esconder no front os botões que o papel não permite. O banco já bloqueia essas ações; esconder os botões é só usabilidade.

---

## 4. Setup (primeira vez)

1. Criar o projeto Vite com React e TypeScript. Configurar Tailwind, shadcn, supabase-js, AgGrid, Recharts e SheetJS.
2. Aplicar a migration no Supabase (`supabase db push` ou colar no SQL Editor).
3. Rodar **uma vez** o `supabase/seed/seed_historico_2026.sql`. Ele importa janeiro a agosto de 2026 da planilha atual.
4. Criar o usuário no Supabase Auth e depois o primeiro admin:
   ```sql
   insert into public.perfis (user_id, nome, papel) values ('<uuid>', 'Nic', 'admin');
   ```
5. Gerar os tipos: `supabase gen types typescript --project-id <id> > src/types/database.ts`.

---

## 5. Telas

### 5.1 Layout geral

- Login com e-mail e senha (Supabase Auth).
- Sidebar com a marca **ARGOS** **[AJUSTAR: cores, logo e identidade visual]**.
- Um grupo de menu "DUN PROFESSIONAL" com as telas abaixo. O layout precisa estar preparado para novos módulos (outras distribuidoras e orçamento).
- Formatação pt-BR:
  - Moeda: `R$ 1.234.567,89`.
  - Percentual: 2 casas, `22,81%`.
  - Mês: `Ago/26`.

### 5.2 Gerencial (tela principal)

- **Filtros:**
  - Seletor de **visão**: "Mensal" ou "Anual".
  - Seletor de **mês** ou **ano**. O padrão é o último mês com carga vigente.
- **Cards:** Faturamento líquido, Rentabilidade (R$ e %), Despesa, LB¹ (R$ e %) e Custo operacional %.
- **Versões em uso:** mostrar em badge, por exemplo "Faturamento v2 · Despesa v1".
- **Mês sem despesa:** mostrar um alerta amarelo ("Despesa não lançada; LB considera despesa zero") com um botão que leva ao lançamento.
- **Tabela AgGrid.** As colunas seguem a planilha: `%` (participação) · `FAT LÍQ` · `RENTAB` · `%` · `DESPESA` (rateada) · `LB¹` · `%`.
  - Linha **TOTAL** fixa no rodapé, vinda de `vw_gerencial_mensal_total` ou `vw_gerencial_anual_total`. Não somar no front.
  - Ordenação padrão por faturamento decrescente **[AJUSTAR]**.
  - LB¹ negativo em vermelho.
  - Botão "Exportar Excel" da tabela (SheetJS).
- **Fontes de dados:**
  - Mensal: `vw_gerencial_mensal` e `vw_gerencial_mensal_total`.
  - Anual: `vw_gerencial_anual` e `vw_gerencial_anual_total`.

### 5.3 Evolução (gráfico)

Substitui a aba "Base Gráficos".

- Seletor de ano.
- Gráfico combinado (Recharts `ComposedChart`):
  - Barras: faturamento líquido, no eixo esquerdo.
  - Linhas: Rentabilidade %, LB¹ % e Custo operacional %, no eixo direito.
- Abaixo, uma tabela pequena com os mesmos números por mês.
- Fonte: `vw_gerencial_mensal_total`.

### 5.4 PROFESSIONAL (departamentos exclusivos)

- Mesma estrutura de filtros (mensal ou anual).
- Colunas: `%` (participação sobre o total dos exclusivos) · `FAT LÍQ` · `RENTAB` · `%`. **Sem despesa e sem LB.**
- **Mostrar todos os departamentos marcados como exclusivos, mesmo os sem venda no período.** Busque `departamentos where exclusivo_professional`, faça o left join no front com a view e mostre zeros quando não houver dado.
- Linha TOTAL.
- Fonte: `vw_professional_mensal` e `vw_professional_anual`.

### 5.5 Importar base do Winthor

Esta é a tela mais importante. O fluxo tem quatro passos.

**1. Seleção.** O usuário escolhe o **mês de referência** (padrão: mês anterior ao atual) e o arquivo (`.xls` ou `.xlsx`).

**2. Leitura.** Usar SheetJS no navegador:
- Ler a primeira aba com `header: 1` e `raw: true`.
- Ignorar linhas totalmente vazias.
- **O arquivo não tem cabeçalho**, então a leitura é por posição (índice 0):

| Coluna | Índice | Campo | Tipo |
|---|---|---|---|
| A | 0 | código do departamento | inteiro |
| B | 1 | nome do departamento | texto (aplicar trim) |
| F | 5 | faturamento líquido | número |
| G | 6 | participação % | número (só para validação) |
| H | 7 | margem % | número (ex.: `25.2195`) |

- Se algum número vier como texto no formato pt-BR (`1.234,56`), converter.

**3. Validações bloqueantes.** Se qualquer uma falhar, mostrar uma lista clara de erros com o número da linha e **não permitir enviar**:
- Todas as linhas têm pelo menos 8 colunas. O layout atual tem 18 **[AJUSTAR: exigir exatamente 18?]**.
- A coluna A é inteira em todas as linhas.
- A coluna B não está vazia.
- As colunas F e H são numéricas.
- Não há código repetido.
- A soma da coluna G está entre 99,9 e 100,1. Isso confirma que o arquivo veio completo **[AJUSTAR: tolerância]**.

**4. Prévia e confirmação.**
- Mostrar: quantidade de departamentos, faturamento total, rentabilidade total (Σ F × H / 100) e rentabilidade %.
- Se o mês já tiver versão vigente:
  - Avisar "Já existe a versão vN deste mês. Esta carga será a vN+1 e passará a ser a vigente."
  - Mostrar a diferença de faturamento e de rentabilidade total contra a vigente.
  - Exigir uma observação explicando o motivo do reenvio.
- Ao confirmar:
  1. Fazer upload do arquivo original para o bucket `argos-bases` no caminho `dun-professional/AAAA-MM/v{n}_{timestamp}_{nome_original}`.
  2. Chamar `registrar_carga_faturamento`. Em `p_linhas`, enviar um array de `{ codigo, nome, faturamento_liquido, margem_pct, linha_original }`, onde `linha_original` é a linha inteira do arquivo (as 18 colunas).
  3. Em caso de sucesso: se for a versão 2 ou maior, abrir direto a **comparação** com a versão anterior; senão, ir para o Gerencial do mês.
  4. Se o RPC falhar depois do upload, mostrar o erro. O arquivo órfão no storage é aceitável, porque não afeta os números.

### 5.6 Despesas

- Seletor de ano.
- Tabela com os 12 meses. Para cada mês: valor vigente, versão, quem lançou e quando, e a observação.
- Botão **Lançar** (mês sem despesa) ou **Corrigir** (mês com despesa). Ambos abrem um dialog com:
  - Valor, com input de moeda pt-BR.
  - Observação, obrigatória ao corrigir.
  - Ao salvar, chamar `registrar_despesa`.
- Cada mês pode ser expandido para ver todas as versões, com o botão "Tornar vigente" (`definir_despesa_vigente`, com confirmação).

### 5.7 Histórico de cargas

- Filtro por ano. Lista agrupada por mês com todas as versões:
  - Versão e badge **vigente**.
  - Origem (upload ou histórico da planilha).
  - Nome do arquivo, com download por signed URL do Storage.
  - Quem enviou (join com `perfis`) e quando.
  - Quantidade de linhas, faturamento e rentabilidade totais.
  - Observação.
- **Ações:**
  - "Comparar": escolher duas versões do mesmo mês. O padrão é a vigente contra a anterior.
  - "Tornar vigente": chama `definir_carga_vigente`, com confirmação.
- **Tela de comparação:** usa `comparar_cargas_faturamento(a, b)`.
  - Mostrar cards com a diferença total de faturamento e de rentabilidade.
  - Tabela com departamento, FAT A, FAT B, Δ, RENTAB A, RENTAB B e Δ.
  - Filtro por situação (`alterado`, `novo`, `removido`, `igual`), com padrão "escondendo iguais".
  - Colorir Δ positivo e negativo.

### 5.8 Departamentos (configuração)

- Tabela com código Winthor, nome, "Exclusivo PROFESSIONAL" (switch) e data de atualização.
- Badge "sem código" para departamentos vindos só do histórico. O código é preenchido sozinho quando o departamento aparecer numa base.
- O switch faz `update` direto na tabela `departamentos` (o RLS permite para admin e editor).
- Filtro "só exclusivos" e busca por nome.

### 5.9 Usuários (só admin)

- Lista de `perfis` com nome e papel, e opção de alterar o papel.
- A criação de usuários é feita no painel do Supabase, e aqui só se vincula o perfil **[AJUSTAR: convite por e-mail dentro do app?]**.

---

## 6. Critérios de aceite

Depois de aplicar a migration e o seed, os números abaixo **precisam bater com a planilha**. Eles foram conferidos no banco durante o desenho:

| Conferência | Valor esperado |
|---|---|
| Ago/26: faturamento líquido | R$ 2.637.066,51 |
| Ago/26: rentabilidade | R$ 576.446,40 |
| Ago/26: despesa | R$ 220.349,50 |
| Ago/26: LB¹ | R$ 356.096,90 (13,50%) |
| Jan/26: LB¹ | R$ 170.903,16 (9,34%) |
| Ano 2026 (jan–ago): faturamento | R$ 17.682.386,16 |
| Ano 2026: LB¹ | R$ 2.174.948,56 (12,30%) |

Teste de ponta a ponta:
1. Reenviar a base `1464_prof_agosto.xls` para Ago/26.
2. Deve ser criada a **v2**, vigente, com os mesmos totais.
3. A comparação v1 × v2 deve mostrar **61 departamentos iguais e 2 novos com valor zero** (BRINDES ROTA NORTE e BOEHRINGER INGELHEIM).
4. Os departamentos que estavam "sem código" e aparecem na base devem ganhar o código automaticamente.

---

## 7. Ordem de implementação

1. Setup, login, layout e leitura do papel.
2. Tela Gerencial, só leitura (valida o seed contra os critérios de aceite).
3. Importar base, com validações e prévia.
4. Histórico e comparação.
5. Despesas.
6. PROFESSIONAL e Evolução.
7. Departamentos e Usuários.

Pare ao fim de cada etapa para eu validar.

---

## 8. Fora do escopo (não implementar)

- Média mensal.
- Conciliação com o Qlik.
- Metas de margem por departamento.
- Detalhamento de despesa por conta (virá num futuro módulo de orçamento).
- Leitura direta do banco do Winthor. Por enquanto a entrada é o upload do arquivo.

**[AJUSTAR]** Hospedagem do front (servidor Ubuntu interno com Nginx? Vercel?) e domínio.
