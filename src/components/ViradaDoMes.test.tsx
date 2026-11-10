// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "./Dashboard";
import { gerarLancamentosRecorrentes } from "../lib/recorrencias";

// O PWA fica aberto por dias no iPhone. Na virada do mês com ele em segundo
// plano, o topo mudava para "1 nov" e a tela continuava em outubro.

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
const titulo = () => screen.getByRole("heading", { name: /Lançamentos de/ }).textContent;

function voltarAoAppEm(quando: Date) {
  vi.setSystemTime(quando);
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

beforeEach(() => vi.setSystemTime(new Date(2026, 9, 31, 23, 50)));
afterEach(() => vi.useRealTimers());

describe("virada do mês com o app aberto", () => {
  it("quem estava no mês corrente passa para o novo, e as recorrências dele são geradas", async () => {
    render(<Dashboard session={sessao} />);
    expect(titulo()).toBe("Lançamentos de Outubro");
    voltarAoAppEm(new Date(2026, 10, 1, 8, 0));
    expect(titulo()).toBe("Lançamentos de Novembro");
    expect(vi.mocked(gerarLancamentosRecorrentes)).toHaveBeenCalledWith(10, 2026);
  });

  it("quem tinha ido olhar outro mês fica onde está", async () => {
    render(<Dashboard session={sessao} />);
    await userEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(titulo()).toBe("Lançamentos de Setembro");
    voltarAoAppEm(new Date(2026, 10, 1, 8, 0));
    expect(titulo()).toBe("Lançamentos de Setembro");
  });

  it("de dezembro para janeiro, o ano também vira", async () => {
    vi.setSystemTime(new Date(2026, 11, 31, 22, 0));
    render(<Dashboard session={sessao} />);
    voltarAoAppEm(new Date(2027, 0, 1, 9, 0));
    expect(titulo()).toBe("Lançamentos de Janeiro");
    expect(screen.getByText(/2027/)).toBeInTheDocument();
  });
});
