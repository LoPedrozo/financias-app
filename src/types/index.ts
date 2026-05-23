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
  created_at: string;
}

// Dados para criar um lançamento (sem os campos gerados pelo banco)
export type NovoLancamento = Omit<Lancamento, "id" | "user_id" | "created_at">;

export interface Categoria {
  nome: string;
  cor: string;
}

export const CATEGORIAS: Categoria[] = [
  { nome: "Alimentação", cor: "#d4937a" },
  { nome: "Transporte", cor: "#6a8caf" },
  { nome: "Lazer", cor: "#7faf94" },
  { nome: "Faculdade", cor: "#c9a86a" },
  { nome: "Assinaturas", cor: "#a87bbf" },
  { nome: "Saúde", cor: "#cf7b6a" },
  { nome: "Tecnologia", cor: "#5d8aa8" },
  { nome: "Beleza", cor: "#d98aa8" },
  { nome: "Casa", cor: "#9b9b7a" },
  { nome: "Outros", cor: "#9aa3b0" },
];

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
