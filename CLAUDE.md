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
  sol/lua), "Minhas Finanças · data de hoje", os três controles soltos (sem
  moldura) e o mês em carrossel com os vizinhos dos lados. O e-mail fica nas
  preferências.
- **Renda e Gastos ficam num card só**, dividido ao meio, acima do cartão do
  saldo.
- **Animação é enfeite**: números que rolam terminam sempre no valor exato
  (há teste), e "reduzir movimento" do sistema desliga tudo.

## Ideias guardadas

Discutidas e adiadas. Só implemente se for pedido.

- Orçamento por categoria (teto mensal com barra de progresso).
- Busca e filtro de lançamentos.
- Comparação com o mês anterior nos cards.
- Aviso, no saldo projetado, do que já está lançado para os meses seguintes.
- Preferências sincronizadas na conta (hoje ficam no aparelho).
- Ícone do app na cor de destaque escolhida.
- Teste visual automatizado em navegador real dentro do projeto.
