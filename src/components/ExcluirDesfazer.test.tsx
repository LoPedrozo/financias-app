// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "./Dashboard";
import { listarLancamentos, removerLancamento } from "../lib/lancamentos";
import type { Lancamento } from "../types";

// Excluir sem "tem certeza?", com Desfazer. O que não pode acontecer: apagar
// no servidor algo que a pessoa desfez, ou deixar de apagar o que ela não
// desfez.

vi.mock("../lib/supabase", () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock("../lib/lancamentos", () => ({
  listarLancamentos: vi.fn(async () => []),
  criarLancamento: vi.fn(), atualizarLancamento: vi.fn(),
  removerLancamento: vi.fn(async () => {}),
  criarLancamentosEmLote: vi.fn(), removerLancamentosEmLote: vi.fn(),
}));
vi.mock("../lib/recorrencias", () => ({
  listarRecorrencias: vi.fn(async () => []),
  gerarLancamentosRecorrentes: vi.fn(async () => []),
}));

const sessao = { user: { id: "u1", email: "eu@x.com" } } as unknown as Session;
const hoje = new Date(2026, 10, 6, 12);
const mercado: Lancamento = {
  id: "l1", user_id: "u1", tipo: "saida", valor: 152.4, descricao: "Mercado",
  categoria: "Alimentação", mes: 10, ano: 2026, data: "2026-11-06", created_at: "",
  recorrencia_id: "r9",
} as Lancamento;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(hoje);
  vi.mocked(listarLancamentos).mockResolvedValue([mercado]);
  vi.mocked(removerLancamento).mockClear();
});
afterEach(() => vi.useRealTimers());

async function excluirMercado() {
  render(<Dashboard session={sessao} />);
  await screen.findByText("Mercado");
  fireEvent.click(screen.getByRole("button", { name: "Excluir lançamento" }));
}

describe("excluir com Desfazer", () => {
  it("some na hora, sem perguntar, e oferece Desfazer", async () => {
    await excluirMercado();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Mercado")).toBeNull();
    expect(screen.getByText('"Mercado" excluído.')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desfazer" })).toBeInTheDocument();
    expect(removerLancamento).not.toHaveBeenCalled();
  });

  it("Desfazer devolve o lançamento e nada é apagado no servidor", async () => {
    await excluirMercado();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(await screen.findByText("Mercado")).toBeInTheDocument();
    expect(screen.getByText("Lançamento de volta.")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(removerLancamento).not.toHaveBeenCalled();
  });

  it("sem Desfazer, apaga no servidor uma vez, com o lançamento inteiro", async () => {
    await excluirMercado();
    await act(async () => { vi.advanceTimersByTime(7000); });
    expect(removerLancamento).toHaveBeenCalledTimes(1);
    // O objeto inteiro, com recorrencia_id: é com ele que o servidor registra
    // a exceção que impede a recorrência de recriar a data.
    expect(removerLancamento).toHaveBeenCalledWith(mercado);
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(removerLancamento).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Mercado")).toBeNull();
  });

  it("servidor recusou: o lançamento volta e o erro aparece", async () => {
    vi.mocked(removerLancamento).mockRejectedValueOnce(new Error("sem rede"));
    await excluirMercado();
    await act(async () => { vi.advanceTimersByTime(7000); });
    expect(await screen.findByText("Mercado")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível excluir. Verifique sua conexão.")).toBeInTheDocument();
  });
});
