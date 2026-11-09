# Minhas Finanças — instruções para o Claude Code

App pessoal de finanças (React + Vite + Supabase), publicado no Vercel e
usado como PWA no celular. Este arquivo registra o fluxo de trabalho e as
decisões de produto que já foram tomadas, para que cada sessão parta delas
em vez de redescobri-las.

## Fluxo de entrega

1. Faça a mudança numa branch e rode a verificação abaixo.
2. Abra o PR com o **link do preview do Vercel** e o que vale conferir na
   tela. O link está no comentário do bot do Vercel no PR; o alias fixo da
   branch segue o formato
   `financias-app-git-<branch>-lorenzo-ps-projects-92f84bb0.vercel.app` (o
   Vercel encurta o nome da branch e põe um hash — pegue o real pela API ou
   pelo comentário, não monte de cabeça).
3. **Só faça merge na `main` com aprovação explícita.** A `main` faz deploy
   de produção sozinha: mergear é publicar.
4. Depois do merge, confirme que o deploy de produção ficou `READY`. O app
   mostra a faixa "Tem uma versão nova do app" para quem já está com ele
   aberto.

Previews não pedem login no Vercel, mas usam **o mesmo banco** de produção:
o que se cria ou apaga lá é real. O login com Google pode redirecionar para
produção; no preview, entrar com e-mail e senha.

## Verificação antes de abrir PR

```bash
npm install
printf 'VITE_SUPABASE_URL=https://exemplo.supabase.co\nVITE_SUPABASE_ANON_KEY=chave-fake\n' > .env.local
npx tsc --noEmit
npm run test:run
npm run build
rm .env.local
```

- Teste novo de regressão: confira que ele **falha no código antigo** antes
  de confiar nele. Já aconteceu de teste passar no código quebrado.
- Mudança visual: confira num navegador de verdade (Chromium via Playwright)
  em várias larguras — no mínimo 320, 360, 390 e desktop — nos dois temas.
  O jsdom não calcula layout. Use "Fevereiro" (o mês de nome mais longo)
  como pior caso para o cabeçalho.

## Convenções do código

- Comentários em português, explicando o **porquê**, não o quê.
- Testes de `src/lib` rodam em node; teste que renderiza componente começa
  com `// @vitest-environment jsdom`.
- Todo valor em dinheiro da tela principal passa por `useDinheiro()`
  (`src/hooks/usePreferencias.tsx`), nunca `brl()` direto — senão vaza com
  "esconder valores" ligado.
- No `style` inline, nunca misturar o atalho `border` com `borderColor` (nem
  `font` com `fontSize`): ao desmarcar um item, o React tira a cor e a borda
  fica na cor do texto — um contorno branco no escuro. Use `borderWidth`,
  `borderStyle` e `borderColor` separados.
- Campo de texto com fonte de 16px ou mais: abaixo disso o iPhone dá zoom
  na página ao tocar nele.
- Todo modal usa a casca `Folha` (`src/components/Folha.tsx`: folha que sobe
  de baixo no celular, título com X, corpo que rola, rodapé fixo acima do
  teclado) e as peças de `src/components/campos.tsx` (rótulo, campo, valor
  grande, atalhos de data, grade de categorias, botões). Não recriar overlay
  nem estilos de campo dentro do modal. Os do Contas a pagar (desligado)
  ficaram no estilo antigo.
- Em cima da cor de destaque (botão, +, card do saldo), a tinta é
  `var(--sobre-destaque)`, nunca `#fff`; o destaque como texto (link, aba
  ativa) é `var(--destaque-texto)`, não `var(--accent)`. Cada cor tem os
  seus, com 4,5:1 no pior fundo (há teste). Branco sobre o dourado dava 1,9:1.
- Cores só por tokens CSS em `src/styles/global.css`. O tema escuro é
  `:root[data-tema="escuro"]` e precisa redefinir todo token de cor do claro
  (há teste). O script no `index.html` aplica tema/cor/lista antes do React e
  espelha `src/lib/preferencias.ts` (há teste que compara os dois).

## Decisões de produto

Já discutidas e fechadas. Não desfaça sem perguntar.

- **Contas a pagar está desligada** (`CONTAS_A_PAGAR_HABILITADO` em
  `src/lib/flags.ts`; o código continua no repositório). Conta futura entra
  como lançamento com a data do vencimento, no mês em que vence.
- **O saldo projetado vai até o mês que está na tela**, sem antecipar os
  meses seguintes. Para ver um compromisso de novembro, navega-se até
  novembro.
- **O + abre o formulário completo, já em Entrada** — Entrada vem antes de
  Saída no seletor. Escrever várias linhas ou colar uma lista é a opção
  secundária, dentro do formulário.
- **Verde e vermelho não são cor de destaque**: no app, verde é entrada e
  vermelho é saída.
- **O olho de esconder valores fica ao lado da engrenagem**, no grupo de
  controles do cabeçalho.
- **O topo não tem logo**: o ícone tem cor fixa e destoava da cor de
  destaque. No lugar, a saudação pela hora do dia ("Boa tarde, Lorenzo" com
  sol/lua), "Minhas Finanças · Sexta, 6 nov 2026", os três controles soltos
  (sem moldura) e o mês em carrossel só com abreviações (OUT NOV DEZ). O ano
  fica na data do topo; no carrossel só aparece quando o mês da tela é de
  outro ano. O e-mail fica nas preferências. No computador (≥1024px) o topo
  é uma linha só, com o carrossel no centro exato da página, em cima da
  divisória Renda | Gastos.
- **Renda e Gastos ficam num card só**, dividido ao meio, acima do cartão do
  saldo.
- **Animação é enfeite**: números que rolam terminam sempre no valor exato
  (há teste), e "reduzir movimento" do sistema desliga tudo. A folha desce
  ao fechar (uma cópia só de imagem, em `Folha.tsx`, porque quem fecha é o
  pai), a linha apagada encolhe antes de sair e o que acabou de entrar ou
  mudar acende de leve na lista.
- **Excluir não pergunta "tem certeza?"**: o lançamento some e aparece
  "Desfazer" por 7s. A exclusão no servidor só vai quando a janela fecha (ou
  na hora, se o app for para o segundo plano) — desfazer devolve o mesmo
  lançamento, sem recriar.
- **Tocar em Renda ou Gastos filtra só a lista.** Cards, saldo e gráficos
  continuam olhando o mês inteiro (há teste).
- **Foco no iPhone**: o Lorenzo não usa Android; recurso que só funciona no
  Android não entra.
- **Preto total e Vidro são interruptores** em Preferências → Estilo, não
  temas novos. O preto só vale com o tema escuro e fica gravado mesmo no
  claro, para o "Automático" sair preto à noite. O vidro vale em qualquer
  tema: cards, painéis e a barra de baixo ficam translúcidos sobre manchas
  de cor (a cor de destaque/tom do período e o anil); os modais continuam
  sólidos. A opacidade foi escolhida pelo contraste do texto no pior ponto
  do fundo (`src/teste/vidro.test.ts`) — mais transparente que isso deixa o
  cinza ilegível. Cor de destaque nunca é verde nem vermelha (há teste).
- **Resumo e "Por categoria" contam como os cards de Renda/Gastos** (só o que
  já aconteceu) e comparam o mês atual com o **mesmo período** do anterior
  (dia 6 contra 1 a 6 do mês passado); mês que já passou, inteiro contra
  inteiro. Contas em centavos, em `src/lib/resumoMes.ts`, com sorteio contra
  gabarito nos testes.

## Roteiro combinado

Aprovado em partes, nesta ordem. Uma parte por vez, cada uma com o próprio
PR e preview. Antes de mexer no visual de uma parte, mostrar protótipos para
escolha (como foi feito com o topo).

1. ~~**Correções dos gráficos.**~~ Feita. Balão do gráfico do ano ilegível no escuro
   ("sobra" cru, texto escuro sobre fundo escuro); eixo com "9000" em vez de
   "9 mil"; contorno branco nas fatias da pizza no escuro; balão que gruda
   na tela depois do toque no celular; título "Gastos por categoria"
   quebrando linha no tablet.
2. ~~**Lista de lançamentos.**~~ Feita (opção A): agrupada por dia com o
   total do dia, agendados no topo com a data na linha, ícone da categoria
   em círculo, deslizar para Editar/Apagar no celular (lápis e lixeira à
   vista no computador) e apagar com Desfazer.
3. ~~**Formulário de novo lançamento.**~~ Feita (opção A): valor grande no
   topo, atalhos de data (Hoje / Ontem / Outra), descrição, categorias em
   grade com ícone, salvar fixo no rodapé — no iPhone, logo acima do teclado
   (`useAreaVisivel`).
4. ~~**Gráficos.**~~ Feita: a pizza e o "Quanto sobrou no ano" deram lugar a
   "Por categoria" (lista com barra, % e diferença para o mês anterior) e
   "Resumo do mês" (sobra, comparação em frases e sobra dos últimos 6 meses).
5. ~~**Temas.**~~ Feita, num PR só: cores de destaque laranja e
   azul-petróleo; Preto total (OLED); Vidro (vidro fosco sobre manchas de
   cor, independente de claro/escuro).
6. ~~**Qualidade de vida.**~~ Feita: tocar em Renda ou Gastos filtra a
   lista; puxar a tela para baixo, no topo, atualiza (só toque, sem modal
   aberto; o conteúdo desce e o indicador aparece no espaço de cima). A
   atualização de fundo — voltar ao app, puxar, "tentar de novo" da faixa —
   é silenciosa: mantém a lista à vista e falha vira a faixa "Não consegui
   atualizar", não a tela de erro. Descartados: "lançar de novo" num toque
   (o Lorenzo não quis) e atalhos do ícone (só Android).
7. ~~**Auditoria.**~~ Feita: contraste sobre a cor de destaque, virada do mês
   com o app aberto, Esc nas folhas, aviso acima do +, valor com milhar nos
   formulários, verde e vermelho legíveis no claro, animações de fechar,
   apagar e destacar. O build já corta o Contas a pagar desligado (a chave em
   `flags.ts` é constante); não vale separar em arquivo à parte.

## Ideias guardadas

Discutidas e adiadas. Só implemente se for pedido.

- Orçamento por categoria (teto mensal com barra de progresso).
- Lembrete de contas (notificação no iPhone no dia em que um lançamento
  agendado vence).
- Busca e filtro de lançamentos.
- Aviso, no saldo projetado, do que já está lançado para os meses seguintes.
- Preferências sincronizadas na conta (hoje ficam no aparelho).
- Ícone do app na cor de destaque escolhida.
- Teste visual automatizado em navegador real dentro do projeto.
