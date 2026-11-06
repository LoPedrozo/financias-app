// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "./Dashboard";

vi.mock("../lib/supabase", () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock("../lib/lancamentos", () => ({
  listarLancamentos: vi.fn(async () => []),
  criarLancamento: vi.fn(), atualizarLancamento: vi.fn(), removerLancamento: vi.fn(),
  criarLancamentosEmLote: vi.fn(), removerLancamentosEmLote: vi.fn(),
}));
vi.mock("../lib/recorrencias", () => ({
  listarRecorrencias: vi.fn(async () => []),
  gerarLancamentosRecorrentes: vi.fn(async () => []),
}));
vi.mock("./Graficos", () => ({ GraficoCategorias: () => null, GraficoAnual: () => null }));

const sessao = { user: { id: "u1", email: "eu@x.com" } } as unknown as Session;

afterEach(() => {
  vi.useRealTimers();
  // @ts-expect-error — o jsdom não tem vibrate; tira o mock.
  delete navigator.vibrate;
});

describe("tom do período no topo", () => {
  it("marca a tarde no <html> e limpa ao sair", async () => {
    vi.setSystemTime(new Date(2026, 10, 6, 15));
    const { unmount } = render(<Dashboard session={sessao} />);
    await screen.findByText(/Nenhum lançamento/);
    expect(document.documentElement.dataset.periodo).toBe("tarde");
    unmount();
    // O login não tem o véu: sem atributo, o fundo volta a ser liso.
    expect(document.documentElement.dataset.periodo).toBeUndefined();
  });

  it("de madrugada é noite", async () => {
    vi.setSystemTime(new Date(2026, 10, 6, 2));
    render(<Dashboard session={sessao} />);
    await screen.findByText(/Nenhum lançamento/);
    expect(document.documentElement.dataset.periodo).toBe("noite");
  });
});

describe("vibração", () => {
  it("vibra ao trocar de mês e ao esconder valores, não ao abrir", async () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    render(<Dashboard session={sessao} />);
    await screen.findByText(/Nenhum lançamento/);
    expect(vibrate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(vibrate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Esconder valores" }));
    expect(vibrate).toHaveBeenCalledTimes(2);
  });
});
