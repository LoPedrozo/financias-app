export const brl = (v: number): string =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
