// Interruptores de features que existem no código mas estão fora do ar.
//
// Contas a pagar compartilhadas está desligada por decisão de produto: a tela
// ficou confusa de usar e o botão de adicionar conta não aparece no celular.
// O código todo (listas.ts, ContasAPagar, convites, importação de lista)
// continua no repositório e coberto pelos testes — para religar, basta trocar
// este valor para `true`.
//
// Com a feature desligada:
// - a aba Contas some da barra inferior e do header no desktop;
// - o app não consulta mais as tabelas de pilhas/itens nem abre canal Realtime;
// - o saldo projetado volta a considerar só os lançamentos;
// - links de convite (?convite=...) são ignorados e limpos da URL.
export const CONTAS_A_PAGAR_HABILITADO: boolean = false;
