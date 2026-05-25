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
}

// Dados para criar um lançamento (sem os campos gerados pelo banco)
export type NovoLancamento = Omit<Lancamento, "id" | "user_id" | "created_at">;

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
