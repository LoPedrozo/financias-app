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

export const CATEGORIAS_SAIDA: Categoria[] = [
  { nome: "Alimentação", cor: "#d4937a" },
  { nome: "Transporte", cor: "#6a8caf" },
  { nome: "Lazer", cor: "#7faf94" },
  { nome: "Educação", cor: "#c9a86a" },
  { nome: "Assinaturas", cor: "#a87bbf" },
  { nome: "Saúde", cor: "#cf7b6a" },
  { nome: "Tecnologia", cor: "#5d8aa8" },
  { nome: "Beleza", cor: "#d98aa8" },
  { nome: "Casa", cor: "#9b9b7a" },
  { nome: "Cartão de Crédito / Contas", cor: "#b56576" },
  { nome: "Vestuário", cor: "#8a6fa3" },
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
