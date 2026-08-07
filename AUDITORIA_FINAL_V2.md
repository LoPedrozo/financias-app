# Auditoria Final V2 — Minhas Finanças

## Resultado geral

**Aprovado com ressalvas.**

Segurança está sólida: testei o isolamento empiricamente com três contas e um convite
revogado, e nada vazou. Nenhum achado crítico. O que segura o deploy não é risco de
dados — é um conjunto de arestas de robustez e de manutenção: um `grupo_id` sem índice
que vai doer com volume, falhas de carregamento que somem em silêncio, e um bundle de
890 kB entregue de uma vez no celular.

**Nota sobre o escopo do pedido:** o enunciado pede para auditar `colaboradores_lista`,
`buscar_user_id_por_email` e `ModalColaboradores`. **Nenhum dos três existe.** O modelo
evoluiu durante a implementação para `grupos` + `membros_grupo`, e o convite por email
foi removido de propósito (era um oráculo de enumeração de usuários). Auditei o que está
no ar hoje.

## Contagem

**0 críticos · 7 médios · 9 baixos**

---

## 1. Segurança

Categoria bem cuidada. Testei, não só li.

**Isolamento verificado com dados reais.** Uma conta sem nenhum vínculo (`mayara2204`)
enxerga: 0 grupos, 0 membros, 0 listas, 0 itens, 0 convites, 0 recorrências — e
exatamente **2 lançamentos, que são os dela**, de 89 no banco. A RLS de `lancamentos`
está correta.

**Convite revogado não funciona.** Gerei um link, apaguei o registro, e tentei consumir
com uma terceira conta: `Convite inválido ou expirado.` O token é de 18 bytes aleatórios
(144 bits) e o consumo é feito sob `FOR UPDATE`, então dois cliques simultâneos não
entram duas vezes.

**As 10 funções RPC estão todas** `SECURITY DEFINER` **com** `search_path` **fixo e
EXECUTE só para `authenticated`.** `anon` não tem SELECT/INSERT/UPDATE/DELETE em
nenhuma das 8 tabelas — só os privilégios inertes que o Supabase concede por padrão.

**Cache do PWA não toca no Supabase.** O `runtimeCaching` cobre apenas
`style/script/worker/font/image`. Nenhuma resposta de API é persistida.

**Sem credenciais no código.** Tudo por `import.meta.env`. O `.env.example` existe e
está correto.

### 🟡 `buscar_perfis_por_ids` devolve email de quem divide qualquer pilha
- Arquivo: função RPC `public.buscar_perfis_por_ids`
- Problema: a função entrega o email de qualquer pessoa que compartilhe **alguma** pilha
  com quem chama. É o comportamento desejado (mostrar "pago por fulano"), mas significa
  que entrar numa lista compartilhada expõe seu email a todos os membros dela — inclusive
  a quem entrar depois. Não é vazamento; é uma consequência do desenho que vale estar
  consciente.
- Sugestão: nenhuma mudança de código. Vale uma linha no modal de convite dizendo que
  quem entra passa a ver o email dos participantes.

### 🟡 Excluir pilha compartilhada apaga o histórico do outro sem aviso a ele
- Arquivo: `src/components/ContasAPagar.tsx` (`confirmarExclusaoDaPilha`)
- Problema: o dono vê um aviso nomeando quem perde acesso, mas **a outra pessoa não
  recebe nada** — a pilha simplesmente some da tela dela. Meses de histórico
  desaparecem sem explicação.
- Sugestão: não há tabela de notificações. O mínimo viável é exigir que o dono remova os
  membros antes de excluir (transformando em dois passos deliberados) ou registrar a
  exclusão numa tabela `avisos` lida no próximo acesso.

### 🟢 `listas_contas` tem GRANT de UPDATE sem policy correspondente
- Arquivo: banco, tabela `listas_contas`
- Problema: `authenticated` tem UPDATE concedido, mas não existe policy de UPDATE — a
  RLS nega tudo por padrão. Funcionalmente seguro, porém é um privilégio concedido sem
  motivo, e a próxima policy criada por engano abriria a porta.
- Sugestão: `REVOKE UPDATE ON listas_contas FROM authenticated`.

### 🟢 Proteção contra senhas vazadas desligada
- Arquivo: painel do Supabase (Auth)
- Problema: o advisor sinaliza que a checagem contra HaveIBeenPwned está off.
- Sugestão: é um toggle no painel, não exige código.

---

## 2. Código morto e redundância

### 🟡 Nove exports sem nenhum consumidor
- Arquivos: `src/lib/listas.ts`, `src/lib/calculos.ts`, `src/lib/importarLista.ts`
- Problema: `listarGrupos`, `listarListas`, `buscarPerfis` e o tipo `ConviteGerado` em
  `listas.ts`; `ResumoPendentes`, `FatiaCategoria`, `BarraMes` em `calculos.ts`;
  `ContaLida`, `ListaLida` em `importarLista.ts`.
  Os de `calculos.ts` e `importarLista.ts` são tipos de retorno de funções exportadas —
  legítimos. Os três de `listas.ts` são **API de verdade sem chamador**: `listarListas`
  em especial duplica `listarListasDoMes` sem que nada a use.
- Sugestão: remover `listarListas` e `buscarPerfis` (esta é usada só internamente por
  `mapaDeEmails`, pode deixar de ser exportada). `listarGrupos` é usada por
  `garantirPilhaPessoal` — manter, mas parar de exportar.

### 🟢 O `styles.overlay` está copiado em 8 modais
- Arquivos: `ModalNovo`, `ModalItem`, `ModalRecorrencia`, `ConfirmModal`,
  `ModalCompartilhar`, `ModalNomeGrupo`, `ModalPassarPosse`, `ModalColarLista`
- Problema: o mesmo bloco de ~10 propriedades de overlay em oito arquivos. Mudar o
  desdobramento do fundo exige oito edições — e foi o que aconteceu ao adicionar
  `data-modal`.
- Sugestão: extrair um `<ModalBase>` que recebe `children` e cuida de overlay,
  `data-modal`, clique-fora e Escape.

### 🟢 `ContasAPagar.tsx` com 1.355 linhas
- Arquivo: `src/components/ContasAPagar.tsx`
- Problema: acumula seletor de pilhas, resumo, lista de itens, seção de pagos, toast de
  pagamento e a orquestração de 6 modais. Não há resíduo do placeholder antigo (o
  "Em breve" sumiu), mas o arquivo virou o maior do projeto por larga margem.
- Sugestão: extrair `ItemDaLista` e `ResumoDoMes` como componentes. Não é urgente.

---

## 3. Organização e arquitetura

Categoria bem cuidada.

**Nenhum `any` no `src/`** — zero ocorrências de `: any`, `<any>` ou `as any`.

**A separação foi mantida.** Toda a conversa com o banco vive em `lib/`; os componentes
não montam query nenhuma. `listas.ts` segue o padrão de `lancamentos.ts` e
`recorrencias.ts`: autentica antes de cada query, select explícito, `throw error`.

**Nomenclatura consistente em português**, inclusive nas funções do banco
(`eh_dono_do_grupo`, `pode_acessar_lista`).

### 🟡 `listas.ts` autentica de um jeito diferente dos irmãos
- Arquivo: `src/lib/listas.ts`
- Problema: usa o helper `usuarioAtual()`; `lancamentos.ts` e `recorrencias.ts` repetem
  o bloco `supabase.auth.getUser()` inline em cada função. O helper é melhor, mas agora
  há dois padrões no mesmo projeto.
- Sugestão: mover `usuarioAtual()` para um módulo comum e usar nos três.

### 🟢 Mensagens de erro centralizadas só em Contas a Pagar
- Arquivo: `src/lib/mensagens.ts`
- Problema: `ERROS`/`SUCESSOS`/`traduzirErro` cobrem a feature nova; lançamentos e
  recorrências ainda têm strings soltas nos componentes ("Não foi possível salvar.
  Verifique sua conexão.").
- Sugestão: migrar as demais para o mesmo módulo quando houver folga.

---

## 4. Performance

### 🟡 `itens_lista.lista_id` e `listas_contas.grupo_id` sem índice
- Arquivo: banco
- Problema: os únicos índices dessas tabelas são as chaves primárias e o
  `UNIQUE(grupo_id, mes, ano)`. **Toda** consulta de itens filtra por `lista_id`, e a RLS
  de `itens_lista` chama `pode_acessar_lista`, que faz `SELECT ... WHERE lc.id = lista`
  a cada linha avaliada. Com poucos registros ninguém sente; com um ano de histórico
  compartilhado vira varredura sequencial dentro da checagem de permissão.
- Sugestão: `CREATE INDEX ON itens_lista (lista_id)` e
  `CREATE INDEX ON listas_contas (grupo_id)`. É o achado de melhor relação
  custo/benefício da auditoria.

### 🟡 33 consultas sem paginação
- Arquivo: `src/lib/*.ts`
- Problema: `listarLancamentos()` traz **todos** os lançamentos do usuário, de todos os
  meses, a cada carga do Dashboard. Hoje são 89 linhas; com recorrências semanais são
  ~250 por ano por usuário, e o filtro por mês acontece no cliente.
- Sugestão: `listarLancamentos` poderia receber uma janela (ano corrente, ou
  competência ± 1). O saldo acumulado precisa do histórico, então exige cuidado — talvez
  um saldo pré-calculado por competência.

### 🟡 Bundle de 890 kB (243 kB gzip) num único arquivo
- Arquivo: `vite.config.ts`
- Problema: o Vite avisa a cada build. Recharts responde pela maior fatia e é usado só
  em dois gráficos do Início — que nem aparecem na aba Contas.
- Sugestão: `React.lazy` nos dois gráficos, ou `manualChunks` separando `recharts`.
  Num 4G o primeiro carregamento sente.

**Assinaturas de Realtime estão corretas.** Três canais, três `removeChannel` em cleanup
de `useEffect`. O canal de itens é chaveado por `listaId` — trocar de mês desmonta o
anterior. Ao sair da aba Contas o componente desmonta e os canais dele morrem junto.
Não há assinatura órfã.

**Geração de recorrências não repete chamadas.** O `useEffect` do Dashboard tem guarda
de competência antes de ir ao servidor, e o upsert usa
`onConflict: recorrencia_id,data` com `ignoreDuplicates` — rodar duas vezes no mesmo mês
é no-op, garantido pelo índice `lancamentos_recorrencia_data_unique`.

---

## 5. Qualidade e boas práticas

**Testes: 65 passando** (eram 33 na auditoria anterior). O interpretador da lista colada
tem 12 testes cobrindo o formato brasileiro (`1.900` = mil e novecentos vs `10.50` = dez
e cinquenta), hífen dentro da descrição, e divergência entre total escrito e soma.

**Validação dos formulários novos está igual à do `ModalNovo`** — `ModalItem` repete as
mesmas cinco regras (vazio, formato, ≤ 0, teto de 1 bilhão, descrição mínima).
`ModalColarLista` valida por construção: só vira conta o que o interpretador reconhecer.

**Acessibilidade:** 33 `aria-label` nos botões só-ícone; todos os inputs novos têm
`<label htmlFor>` associado.

**Mês passado está correto:** `garantirListaEditavel` barra criar e editar;
`marcarComoPago` **não** tem a trava, de propósito — esquecer de marcar julho e lembrar
em agosto é situação real.

**O toast "Lançar como saída?" funciona** e cria o lançamento na conta de quem marcou,
não de quem criou a lista. Verificado com duas contas.

**Recorrências não geram em meses anteriores** à criação — `podeGerarNaCompetencia`
compara com o `created_at` da regra e com a competência atual.

### 🟡 Seis falhas de carregamento somem em silêncio
- Arquivos: `ContasAPagar.tsx:192,219,227`, `Dashboard.tsx:201,212,217`
- Problema: são `.catch(console.error)` em recargas de fundo (itens, pilhas,
  recorrências, contas em aberto). Se a rede cair, a tela fica com dado velho e **o
  usuário não é avisado** — num app de dinheiro, um saldo desatualizado sem aviso é pior
  que um erro visível.
- Sugestão: um indicador discreto de "não consegui atualizar" no cabeçalho, em vez de
  toast (que seria intrusivo demais para recarga de fundo).

### 🟢 Sem teste automatizado para a camada de dados
- Arquivo: `src/lib/listas.ts`
- Problema: os 65 testes cobrem `calculos.ts` e `importarLista.ts` — funções puras.
  Toda a lógica de permissão, competência e agregação de `listas.ts` só é verificada
  manualmente.
- Sugestão: as partes puras (`vencimentoPadrao`, comparação de competência, o cálculo do
  percentual pago) dariam testes baratos.

### 🟢 O aviso de divergência do total não é registrado
- Arquivo: `src/components/ModalColarLista.tsx`
- Problema: quando o total escrito não bate com a soma (o caso real teve R$ 50 de
  diferença), o app avisa e deixa seguir — mas não guarda o total informado. Depois não
  há como saber que houve divergência.
- Sugestão: só relevante se você quiser auditar isso depois. Provavelmente não vale.

---

## 6. Experiência mobile

**Bottom nav não cobre conteúdo:** `.page-com-bottom-nav` reserva `padding-bottom: 80px`
contra os 64px da barra.

**Swipe com modal aberto está bloqueado.** Os 8 overlays têm `data-modal` e o `useSwipe`
checa o DOM em três pontos: início do gesto, fim do gesto e roda do trackpad.

**Tooltip do iOS:** o listener de fechamento entra num `setTimeout(0)` para não ser
atingido pelo toque que o abriu, e fecha também em rolagem, troca de mês e abertura de
modal.

### 🟡 Bugs de toque sem verificação em aparelho real
- Arquivos: `src/components/Dashboard.tsx`, `src/hooks/useSwipe.ts`
- Problema: as correções do tooltip iOS e do swipe-com-modal foram validadas por leitura
  de código. O navegador de teste não emula o comportamento de toque do Safari iOS, que
  é exatamente onde o bug original aparecia.
- Sugestão: **testar as duas no seu iPhone antes do deploy.** Segurar um lançamento
  futuro e tocar fora uma vez; e tentar deslizar entre meses com um modal aberto.

### 🟡 Realtime ao voltar do background não foi testado
- Arquivo: `src/components/ContasAPagar.tsx`
- Problema: quando o app fica em background (celular bloqueado, troca de aplicativo), o
  WebSocket cai. O supabase-js reconecta sozinho, mas **os eventos perdidos durante a
  queda não são recuperados** — a tela pode ficar desatualizada até uma ação que force
  recarga.
- Sugestão: recarregar ao voltar ao foreground via `visibilitychange`. São poucas linhas
  e fecham o buraco.

### 🟢 Descrições longas quebram em duas linhas a 375px
- Arquivo: `src/components/ContasAPagar.tsx`
- Problema: "Estacionamento" vira "Estaciname / nto" porque o valor ocupa metade da
  largura. Melhor que o corte com reticências de antes, mas ainda feio.
- Sugestão: no celular, valor em linha própria abaixo da descrição.

### 🟢 Contador de pessoas não distingue pilha própria de compartilhada
- Arquivo: `src/components/ContasAPagar.tsx`
- Problema: uma pilha só sua mostra "👥 1", o que sugere que existe compartilhamento
  onde não existe.
- Sugestão: esconder o número quando for 1, deixando só o ícone.

---

## ⭐ Top 5 — Prioridades antes do deploy

1. **Índices em `itens_lista(lista_id)` e `listas_contas(grupo_id)`** — duas linhas de
   SQL. É o que impede a RLS de degradar quando o histórico crescer, e o único item aqui
   que fica mais caro de resolver depois.
2. **Testar tooltip e swipe no iPhone** — as duas correções mais recentes não foram
   verificadas no aparelho onde o bug acontecia. É teste manual de dois minutos.
3. **Recarregar ao voltar do background** — sem isso, o app pode mostrar contas
   desatualizadas depois de o celular ficar bloqueado, que é o uso normal.
4. **Dar visibilidade às falhas de recarga de fundo** — seis pontos onde a rede cair
   deixa número velho na tela sem avisar. Num app de dinheiro isso corrói a confiança
   mais rápido que um erro explícito.
5. **Separar o Recharts do bundle principal** — 890 kB num único arquivo, sendo que os
   gráficos nem aparecem na aba Contas.

Nada nessa lista bloqueia o lançamento por risco de dados. São, em ordem, o que vai
doer primeiro conforme o app for usado de verdade.

---

## Build e testes

- `tsc && vite build`: ✅ limpa (só o aviso conhecido de chunk > 500 kB)
- `npm run test:run`: ✅ **65/65**

---

## Conclusão

**Sim, com ressalvas.**

A parte que costuma reprovar uma auditoria — segurança de dados entre usuários — está
sólida e foi verificada empiricamente, não presumida: três contas, um convite revogado,
um estranho sem vínculo, e nenhuma linha atravessou onde não devia. Zero achados
críticos.

As ressalvas são de robustez sob uso real: índices que faltam, falhas silenciosas de
recarga, e duas correções de toque que só o seu iPhone pode confirmar. Os itens 1 a 3 do
Top 5 são os que eu faria antes de mandar o link para a sua mãe; os outros dois podem
vir depois.
