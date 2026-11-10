// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "./Dashboard";
import { PreferenciasProvider } from "../hooks/usePreferencias";
import { listarLancamentos } from "../lib/lancamentos";
import { brl } from "../lib/format";
import type { Lancamento } from "../types";

// Os cards "Por categoria" e "Resumo do mês" na tela de verdade: o que eles
// mostram tem que bater, no centavo, com o card de Renda | Gastos, que é o
// número que a pessoa já conhece.

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
const l = (id: string, tipo: "entrada" | "saida", valor: number, mes: number, data: string, categoria = "Outros"): Lancamento => ({
  id, user_id: "u1", tipo, valor, descricao: id, categoria, mes, ano: 2026, data, created_at: "",
});
// brl() usa espaço inquebrável; o texto da tela é comparado normalizado.
const t = (s: string | null | undefined) => (s ?? "").replace(/\s/g, " ");
const dinheiro = (v: number) => t(brl(v));

const dados = [
  l("salario", "entrada", 8000, 10, "2026-11-01", "Salário"),
  l("mercado", "saida", 152.4, 10, "2026-11-03", "Alimentação"),
  l("uber", "saida", 23.9, 10, "2026-11-05", "Transporte"),
  l("cartao", "saida", 4715.47, 10, "2026-11-10", "Cartão de Crédito / Contas"), // agendado
  l("out-salario", "entrada", 7550, 9, "2026-10-01", "Salário"),
  l("out-mercado", "saida", 100, 9, "2026-10-04", "Alimentação"),
  l("out-cartao", "saida", 5120, 9, "2026-10-10", "Cartão de Crédito / Contas"), // depois do dia 6
];

beforeEach(() => {
  vi.setSystemTime(new Date(2026, 10, 6, 12));
  vi.mocked(listarLancamentos).mockResolvedValue(dados);
});
afterEach(() => vi.useRealTimers());

describe("Resumo do mês e Por categoria no Dashboard", () => {
  it("entrou e saiu são os mesmos números do card Renda | Gastos, e a sobra é a diferença", async () => {
    render(<Dashboard session={sessao} />);
    await screen.findByText("salario");
    const resumoMes = document.querySelector(".resumo-mes")!;
    const [renda, gastos] = [...resumoMes.querySelectorAll(".resumo-valor")].map((e) => t(e.textContent));
    expect(renda).toBe(dinheiro(8000));
    expect(gastos).toBe(dinheiro(176.3)); // o cartão do dia 10 ainda não aconteceu

    const card = screen.getByText(/^Resumo de novembro$/).parentElement!;
    expect(t(card.textContent)).toContain(`entrou ${dinheiro(8000)} · saiu ${dinheiro(176.3)}`);
    expect(t(card.querySelector(".resumo-sobra")!.textContent)).toBe(`+ ${dinheiro(7823.7)}`);
  });

  it("compara com o mesmo período de outubro (1 a 6), não com outubro inteiro", async () => {
    render(<Dashboard session={sessao} />);
    await screen.findByText("salario");
    const card = screen.getByText(/^Resumo de novembro$/).parentElement!;
    const texto = t(card.textContent);
    expect(texto).toContain("Comparado com 1 a 6 de outubro");
    // Out (1–6): entrou 7.550, saiu 100. Nov (1–6): entrou 8.000, saiu 176,30.
    expect(texto).toContain(`Gastou ${dinheiro(76.3)} a mais que no mesmo período de outubro`);
    expect(texto).not.toMatch(/que em o /);
    expect(texto).toContain(`Entrou ${dinheiro(450)} a mais`);
    expect(texto).toContain(`${dinheiro(373.7)} melhor que no mesmo período de outubro`); // 7.823,70 − 7.450
    expect(texto).toContain(`(lá sobrou ${dinheiro(7450)})`);
  });

  it("por categoria: o total é o mesmo dos Gastos, e as linhas somam o total", async () => {
    render(<Dashboard session={sessao} />);
    await screen.findByText("salario");
    const titulo = screen.getByText(/^Por categoria$/);
    const card = titulo.closest(".panel-mobile")!;
    expect(t(card.querySelector(".categorias-total")!.textContent)).toBe(dinheiro(176.3));
    const linhas = [...card.querySelectorAll(".categoria-linha")].map((li) => t(li.textContent));
    expect(linhas[0]).toContain("Alimentação");
    expect(linhas[0]).toContain(dinheiro(152.4));
    expect(linhas[1]).toContain("Transporte");

    fireEvent.click(screen.getByRole("button", { name: "Entradas" }));
    expect(t(card.querySelector(".categorias-total")!.textContent)).toBe(dinheiro(8000));
  });

  it("mês que já passou: conta o mês inteiro; sem o anterior, diz que não há com o que comparar", async () => {
    render(<Dashboard session={sessao} />);
    await screen.findByText("salario");
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    const card = (await screen.findByText(/^Resumo de outubro$/)).parentElement!;
    const texto = t(card.textContent);
    expect(texto).toContain("Sobrou no mês");
    expect(texto).toContain(`entrou ${dinheiro(7550)} · saiu ${dinheiro(5220)}`); // o cartão do dia 10 já passou
    expect(texto).toContain("Sem lançamentos em setembro para comparar.");
  });

  it("com valores escondidos, nenhum número vaza dos dois cards", async () => {
    localStorage.clear();
    // Como no app: o olho só funciona dentro do provedor de preferências.
    render(<PreferenciasProvider><Dashboard session={sessao} /></PreferenciasProvider>);
    await screen.findByText("salario");
    fireEvent.click(screen.getByRole("button", { name: "Esconder valores" }));
    const cards = [screen.getByText(/^Resumo de novembro$/).parentElement!, screen.getByText(/^Por categoria$/).closest(".panel-mobile")!];
    for (const c of cards) {
      const vazou = (c.textContent ?? "").match(/.{0,30}\d,\d\d.{0,10}/g);
      expect(vazou).toBeNull();
    }
  });
});
