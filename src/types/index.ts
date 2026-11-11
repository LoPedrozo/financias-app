export type Tipo = "entrada" | "saida";

export interface Lancamento {
  id: string;
  user_id: string;
  tipo: Tipo;
  valor: number;
  descricao: string;
  categoria: string;
  mes: number; // 0-11
  ano: number;
  data: string | null; // ISO YYYY-MM-DD; null para lançamentos antigos
  created_at: string;
  recorrencia_id?: string | null;
  /** Fatura do cartão calculada das compras (lib/fatura.ts): não existe no
   *  banco, não se edita nem se apaga — tocar nela abre a fatura. */
  fatura?: { cartao_id: string; fechamento: string };
}

// Dados para criar um lançamento (sem os campos gerados pelo banco)
export type NovoLancamento = Omit<
  Lancamento,
  "id" | "user_id" | "created_at" | "recorrencia_id"
>;

export type Frequencia = "semanal" | "mensal";

export interface Recorrencia {
  id: string;
  user_id: string;
  tipo: Tipo;
  valor: number;
  descricao: string;
  categoria: string;
  frequencia: Frequencia;
  dia_semana?: number; // 0=domingo, 1=segunda... 6=sábado
  dia_mes?: number; // 1-31
  ativo: boolean;
  created_at: string;
}

export type NovaRecorrencia = Omit<Recorrencia, "id" | "user_id" | "created_at">;

// Cartão de crédito.
//
// A compra no cartão não sai do saldo no dia: o dinheiro sai quando a fatura
// vence. Por isso as compras moram numa tabela própria, e a fatura de cada
// ciclo é calculada delas (lib/fatura.ts) e entra nas contas como um
// lançamento no dia do vencimento. Lançar a fatura à mão, como antes, contaria
// tudo duas vezes.
export interface Cartao {
  id: string;
  user_id: string;
  nome: string;
  /** Dia em que a fatura fecha. Compra feita nesse dia já vai para a próxima. */
  dia_fechamento: number;
  dia_vencimento: number;
  /** Quanto se pretende gastar por fatura, e quanto disso é essencial. */
  meta_total: number | null;
  meta_essenciais: number | null;
  /** Vencimento da primeira fatura acompanhada (AAAA-MM-DD). As de antes
   *  foram lançadas à mão e não são recalculadas. */
  inicio: string;
  created_at: string;
}

export type NovoCartao = Omit<Cartao, "id" | "user_id" | "created_at">;

export type ComoPagou = "aproximacao" | "online";

export interface CompraCartao {
  id: string;
  user_id: string;
  cartao_id: string;
  descricao: string;
  /** Valor total da compra; parcelada, ele se divide pelas faturas. */
  valor: number;
  categoria: string;
  /** Dia da compra (AAAA-MM-DD). */
  data: string;
  parcelas: number;
  /** null: segue a categoria (CATEGORIAS_ESSENCIAIS). */
  essencial: boolean | null;
  como: ComoPagou | null;
  created_at: string;
}

export type NovaCompraCartao = Omit<CompraCartao, "id" | "user_id" | "created_at">;

// Gasto que se repete e ainda vai acontecer — o lanche de toda sexta. Não
// vira compra sozinho: entra só na previsão da fatura, até o dia passar.
export interface PrevistoCartao {
  id: string;
  user_id: string;
  cartao_id: string;
  descricao: string;
  valor: number;
  categoria: string;
  frequencia: Frequencia;
  dia_semana: number | null;
  dia_mes: number | null;
  essencial: boolean | null;
  ativo: boolean;
  created_at: string;
}

export type NovoPrevistoCartao = Omit<PrevistoCartao, "id" | "user_id" | "created_at">;

// O que uma fatura já traz e outra pessoa paga direto ao banco (a parte da
// mãe). Muda de fatura para fatura. Ocupa a meta, mas não sai do saldo.
export interface FaturaCartao {
  id: string;
  user_id: string;
  cartao_id: string;
  /** Dia do fechamento: identifica a fatura. */
  fechamento: string;
  inicial: number;
  created_at: string;
}

// Uma "pilha" de contas: tem nome, dono e membros próprios. É o que permite
// dividir um conjunto de contas com uma pessoa e outro com outra, sem misturar.
export interface Grupo {
  id: string;
  nome: string;
  criador_id: string;
  pessoal: boolean;
  arquivado: boolean;
  created_at: string;
  // Preferência do usuário atual sobre esta pilha, resolvida a partir do
  // vínculo — mora em membros_grupo porque cada pessoa decide a sua.
  conta_no_saldo?: boolean;
}

// Quanto se perde ao excluir uma pilha — usado para dimensionar o aviso.
export interface ResumoGrupo {
  meses: number;
  contas: number;
  pessoas: number;
}

export interface MembroGrupo {
  id: string;
  grupo_id: string;
  user_id: string;
  entrou_em: string;
  conta_no_saldo: boolean;
  // Resolvido via RPC — a tabela guarda só o user_id.
  email?: string;
}

export interface ListaContas {
  id: string;
  grupo_id: string;
  mes: number; // 0-11
  ano: number;
  created_at: string;
}

export interface ItemLista {
  id: string;
  lista_id: string;
  descricao: string;
  valor: number;
  categoria: string;
  vencimento: string; // ISO YYYY-MM-DD
  pago: boolean;
  pago_por: string | null;
  pago_em: string | null;
  created_at: string;
  // Resolvido por listarItens via RPC — a tabela guarda só o user_id em pago_por.
  pago_por_email?: string | null;
}

export interface PerfilUsuario {
  id: string;
  email: string;
}

// O convite é da pessoa, não do mês: vale para todas as listas do dono, hoje e
// no futuro, até alguém sair ou o dono remover.
// O convite é de uma pilha específica: o link só puxa a pessoa para aquela.
export interface Convite {
  id: string;
  grupo_id: string;
  token: string;
  criado_em: string;
  expira_em: string;
  usado_em: string | null;
  usado_por: string | null;
}

// O que o convidado vê antes de decidir entrar.
export interface PreviaConvite {
  grupo_id: string;
  grupo_nome: string;
  dono_email: string;
  ja_membro: boolean;
}

// Dados para criar um item (sem os campos gerados pelo banco nem os de pagamento)
export type NovoItemLista = Omit<
  ItemLista,
  | "id"
  | "lista_id"
  | "pago"
  | "pago_por"
  | "pago_em"
  | "pago_por_email"
  | "created_at"
>;

export interface Categoria {
  nome: string;
  cor: string;
}

// As cores seguem o sentido do app: entrada é verde, saída é vermelho. Cada
// categoria tem o seu tom dentro da paleta — vermelhos de rosado a
// terracota nas saídas, verdes nas entradas — e "Outros" é cinza nas duas.
// Há teste que trava as faixas de matiz.
export const CATEGORIAS_SAIDA: Categoria[] = [
  { nome: "Alimentação", cor: "#d0806c" },
  { nome: "Transporte", cor: "#bb5c58" },
  { nome: "Lazer", cor: "#cc7b8b" },
  { nome: "Educação", cor: "#b56e4a" },
  { nome: "Assinaturas", cor: "#ac5d7a" },
  { nome: "Saúde", cor: "#d16c61" },
  { nome: "Tecnologia", cor: "#9b655f" },
  { nome: "Beleza", cor: "#d98ca3" },
  { nome: "Casa", cor: "#bc9076" },
  { nome: "Cartão de Crédito / Contas", cor: "#b65464" },
  { nome: "Vestuário", cor: "#c2958e" },
  { nome: "Outros", cor: "#9aa3b0" },
];

export const CATEGORIAS_ENTRADA: Categoria[] = [
  { nome: "Salário", cor: "#5a9b78" },
  { nome: "Mesada", cor: "#7fb89a" },
  { nome: "Freelance / Bico", cor: "#4f8a6b" },
  { nome: "Presente", cor: "#a8c98a" },
  { nome: "Empréstimo recebido", cor: "#6fa890" },
  { nome: "Rendimentos / Investimentos", cor: "#3f7d5e" },
  { nome: "Reembolso", cor: "#8fb39a" },
  { nome: "Vendas", cor: "#69a37e" },
  { nome: "Bolsa / Auxílio", cor: "#5d9c8c" },
  { nome: "Outros", cor: "#9aa3b0" },
];

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
