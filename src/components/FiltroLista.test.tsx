// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "./Dashboard";
import { listarLancamentos } from "../lib/lancamentos";
import type { Lancamento } from "../types";

// Tocar em Renda ou Gastos filtra a LISTA. O que não pode acontecer: o filtro
// mexer em qualquer número — cards, saldo atual, fim do mês.

vi.mock("../lib/supabase", () => ({ supabase: { auth: { signOut: vi.fn() } } }));
// Sem cartão configurado: o Dashboard busca o cartão a cada atualização.
vi.mock("../lib/cartao", () => ({
  obterCartao: vi.fn(async () => null),
  listarCompras: vi.fn(async () => []),
  listarPrevistos: vi.fn(async () => []),
}));
vi.mock("../lib/lancamentos", () => ({
  listarLancamentos: vi.fn(async () => []),
  criarLancamento: vi.fn(), atualizarLancamento: vi.fn(), removerLancamento: vi.fn(async () => {}),
  criarLancamentosEmLote: vi.fn(), removerLancamentosEmLote: vi.fn(),
}));
vi.mock("../lib/recorrencias", () => ({
  listarRecorrencias: vi.fn(async () => []),
  gerarLancamentosRecorrentes: vi.fn(async () => []),
}));

const sessao = { user: { id: "u1", email: "eu@x.com" } } as unknown as Session;
const l = (id: string, tipo: "entrada" | "saida", valor: number, data: string): Lancamento => ({
  id, user_id: "u1", tipo, valor, descricao: id, categoria: "Outros", mes: 10, ano: 2026, data, created_at: "",
});
const dados = [
  l("salario", "entrada", 8000, "2026-11-01"),
  l("mesada", "entrada", 6750, "2026-11-08"),
  l("mercado", "saida", 152.4, "2026-11-03"),
  l("cartao", "saida", 4715.47, "2026-11-10"),
];

beforeEach(() => {
  vi.setSystemTime(new Date(2026, 10, 6, 12));
  vi.mocked(listarLancamentos).mockResolvedValue(dados);
});
afterEach(() => vi.useRealTimers());

const lista = () => screen.getByText(/^Lançamentos de/).closest(".panel-mobile") as HTMLElement;
const nomesNaLista = () => ["salario", "mesada", "mercado", "cartao"].filter((n) => within(lista()).queryByText(n));
// Todos os números de cima: o card de Renda | Gastos e o cartão do saldo.
const numerosDeCima = () =>
  [document.querySelector(".resumo-mes"), document.querySelector(".card-saldo")].map((e) => e?.textContent);

async function montar() {
  render(<Dashboard session={sessao} />);
  await screen.findByText("salario");
}
const renda = () => screen.getByRole("button", { name: /^Renda/ });
const gastos = () => screen.getByRole("button", { name: /^Gastos/ });

describe("filtro pela Renda e pelos Gastos", () => {
  it("Renda mostra só as entradas; os números de cima não mudam", async () => {
    await montar();
    const antes = numerosDeCima();
    fireEvent.click(renda());
    expect(renda()).toHaveAttribute("aria-pressed", "true");
    expect(nomesNaLista()).toEqual(["salario", "mesada"]);
    expect(within(lista()).getByText(/Só entradas/)).toBeInTheDocument();
    expect(numerosDeCima()).toEqual(antes);
  });

  it("Gastos mostra só as saídas; os números de cima não mudam", async () => {
    await montar();
    const antes = numerosDeCima();
    fireEvent.click(gastos());
    expect(nomesNaLista()).toEqual(["mercado", "cartao"]);
    expect(numerosDeCima()).toEqual(antes);
  });

  it("tocar de novo, ou em Mostrar todos, volta a lista inteira", async () => {
    await montar();
    fireEvent.click(renda());
    fireEvent.click(renda());
    expect(renda()).toHaveAttribute("aria-pressed", "false");
    expect(nomesNaLista()).toHaveLength(4);

    fireEvent.click(gastos());
    fireEvent.click(within(lista()).getByRole("button", { name: /Mostrar todos/ }));
    expect(nomesNaLista()).toHaveLength(4);
    expect(within(lista()).queryByText(/Só saídas/)).toBeNull();
  });

  it("trocar de Renda para Gastos troca o filtro, não soma", async () => {
    await montar();
    fireEvent.click(renda());
    fireEvent.click(gastos());
    expect(renda()).toHaveAttribute("aria-pressed", "false");
    expect(gastos()).toHaveAttribute("aria-pressed", "true");
    expect(nomesNaLista()).toEqual(["mercado", "cartao"]);
  });

  it("mês sem nenhuma entrada: diz isso e oferece mostrar todos", async () => {
    vi.mocked(listarLancamentos).mockResolvedValue(dados.filter((d) => d.tipo === "saida"));
    render(<Dashboard session={sessao} />);
    await screen.findByText("mercado");
    fireEvent.click(renda());
    expect(screen.getByText("Nenhuma entrada em Novembro.")).toBeInTheDocument();
    const botoes = within(lista()).getAllByRole("button", { name: /Mostrar todos/ });
    fireEvent.click(botoes[botoes.length - 1]);
    expect(nomesNaLista()).toEqual(["mercado", "cartao"]);
  });
});
