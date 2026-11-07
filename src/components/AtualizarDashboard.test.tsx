// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "./Dashboard";
import { listarLancamentos } from "../lib/lancamentos";
import type { Lancamento } from "../types";

// A atualização de fundo — voltar ao app, puxar a tela, o "tentar de novo"
// da faixa — acontece com a lista já na tela. Ela não pode trocar os seus
// dados por blocos de carregamento, e uma falha nela é a faixa "Não consegui
// atualizar", não a tela de erro no lugar de tudo.

vi.mock("../lib/supabase", () => ({ supabase: { auth: { signOut: vi.fn() } } }));
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
const l = (id: string, valor = 10): Lancamento => ({
  id, user_id: "u1", tipo: "saida", valor, descricao: id, categoria: "Outros",
  mes: 10, ano: 2026, data: "2026-11-03", created_at: "",
});

function voltarAoApp() {
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

beforeEach(() => {
  vi.setSystemTime(new Date(2026, 10, 6, 12));
  vi.mocked(listarLancamentos).mockReset();
  vi.mocked(listarLancamentos).mockResolvedValue([l("mercado")]);
});
afterEach(() => {
  vi.useRealTimers();
  // @ts-expect-error — o jsdom não tem matchMedia; tira o mock do celular.
  delete window.matchMedia;
});

describe("atualização de fundo", () => {
  it("voltar ao app atualiza sem trocar a lista por blocos de carregamento", async () => {
    render(<Dashboard session={sessao} />);
    await screen.findByText("mercado");
    let entregar!: (v: Lancamento[]) => void;
    vi.mocked(listarLancamentos).mockImplementationOnce(() => new Promise((r) => (entregar = r)));
    voltarAoApp();
    // Enquanto o servidor não responde, a lista de antes continua à vista.
    expect(screen.getByText("mercado")).toBeInTheDocument();
    expect(document.querySelector(".skeleton-pulse")).toBeNull();
    await act(async () => entregar([l("mercado"), l("farmácia", 48.7)]));
    expect(await screen.findByText("farmácia")).toBeInTheDocument();
  });

  it("falha na atualização de fundo: os dados ficam e aparece a faixa, não a tela de erro", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Dashboard session={sessao} />);
    await screen.findByText("mercado");
    vi.mocked(listarLancamentos).mockRejectedValueOnce(new Error("sem rede"));
    voltarAoApp();
    expect(await screen.findByText(/Não consegui atualizar/)).toBeInTheDocument();
    expect(screen.getByText("mercado")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível carregar seus lançamentos.")).not.toBeInTheDocument();
  });

  it("o tentar de novo da faixa, dando certo, tira a faixa", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Dashboard session={sessao} />);
    await screen.findByText("mercado");
    vi.mocked(listarLancamentos).mockRejectedValueOnce(new Error("sem rede"));
    voltarAoApp();
    await screen.findByText(/Não consegui atualizar/);
    await userEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));
    await waitFor(() => expect(screen.queryByText(/Não consegui atualizar/)).not.toBeInTheDocument());
  });

  it("no celular, puxar a tela para baixo no topo atualiza", async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never;
    render(<Dashboard session={sessao} />);
    await screen.findByText("mercado");
    const antes = vi.mocked(listarLancamentos).mock.calls.length;
    vi.mocked(listarLancamentos).mockResolvedValueOnce([l("mercado"), l("uber", 23.9)]);
    fireEvent.touchStart(document.body, { touches: [{ clientX: 200, clientY: 120 }] });
    fireEvent.touchMove(document.body, { touches: [{ clientX: 200, clientY: 200 }] });
    fireEvent.touchMove(document.body, { touches: [{ clientX: 200, clientY: 300 }] });
    fireEvent.touchEnd(document.body, { touches: [] });
    // O conteúdo desceu para abrir espaço ao indicador...
    const pagina = document.querySelector(".page-root") as HTMLElement;
    expect(pagina.getAttribute("data-puxando")).toBe("atualizando");
    expect(pagina.style.getPropertyValue("--puxado")).not.toBe("0px");
    expect(await screen.findByText("uber")).toBeInTheDocument();
    // ...e volta ao lugar quando termina.
    await waitFor(() => expect(pagina.hasAttribute("data-puxando")).toBe(false), { timeout: 2000 });
    expect(vi.mocked(listarLancamentos).mock.calls.length).toBe(antes + 1);
    expect(screen.getByRole("status", { hidden: true })).toBeInTheDocument();
  });
});
