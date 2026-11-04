# Minhas Finanças — instruções para o Claude

App pessoal de finanças (React + Vite + Supabase), PWA instalado no iPhone.
Uma pessoa só usa e mantém, quase sempre **pelo celular, sem computador** —
ela não roda o projeto localmente nem testa antes de você.

## Como entregar uma mudança

1. Faça a mudança numa branch e rode tudo (ver "Verificação" abaixo).
2. Abra o PR e **mande o link do preview do Vercel** junto com o que mudou e
   o que vale conferir no celular. O link está no comentário do bot do Vercel
   no PR; o alias fixo da branch segue o formato
   `financias-app-git-<branch>-lorenzo-ps-projects-92f84bb0.vercel.app`
   (o Vercel encurta e põe um hash no nome da branch — pegue o real pela API
   do Vercel ou pelo comentário, não monte de cabeça).
3. **Só faça o merge na `main` depois de a pessoa dizer que pode.** A `main`
   faz deploy de produção sozinha no Vercel; mergear é publicar.
4. Depois do merge, confirme que o deploy de produção ficou `READY` e avise
   que o app vai mostrar a faixa "Tem uma versão nova do app" para atualizar.

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
- A feature de contas a pagar está desligada por `CONTAS_A_PAGAR_HABILITADO`
  em `src/lib/flags.ts`; o código continua no repositório.
