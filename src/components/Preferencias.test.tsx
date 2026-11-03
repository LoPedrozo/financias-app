// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "./Dashboard";
import { PreferenciasProvider } from "../hooks/usePreferencias";
import { CHAVE_PREFERENCIAS, VALOR_OCULTO } from "../lib/preferencias";
import { listarLancamentos } from "../lib/lancamentos";
import { listarRecorrencias } from "../lib/recorrencias";
import { supabase } from "../lib/supabase";

// Dashboard de verdade dentro do provider de verdade: o que se testa é o
// caminho inteiro, do toque na engrenagem até o atributo no <html> e o
// número sumindo da tela.
vi.mock("../lib/supabase", () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));
vi.mock("../lib/lancamentos", () => ({
  listarLancamentos: vi.fn(async () => []),
  criarLancamento: vi.fn(),
  atualizarLancamento: vi.fn(),
  removerLancamento: vi.fn(),
  criarLancamentosEmLote: vi.fn(),
  removerLancamentosEmLote: vi.fn(),
}));
vi.mock("../lib/recorrencias", () => ({
  listarRecorrencias: vi.fn(async () => []),
  gerarLancamentosRecorrentes: vi.fn(async () => []),
}));
vi.mock("./Graficos", () => ({
  GraficoCategorias: () => null,
  GraficoAnual: () => null,
}));

const sessao = {
  user: { id: "u1", email: "eu@exemplo.com" },
} as unknown as Session;

const hoje = new Date();
const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
const lancamento = {
  id: "l1", user_id: "u1", tipo: "entrada" as const, valor: 1790,
  descricao: "salário", categoria: "Salário",
  mes: hoje.getMonth(), ano: hoje.getFullYear(), data: iso, created_at: "",
};

function montar() {
  return render(
    <PreferenciasProvider>
      <Dashboard session={sessao} />
    </PreferenciasProvider>
  );
}

async function abrirPreferencias() {
  await userEvent.click(screen.getByRole("button", { name: "Preferências" }));
  return screen.findByRole("dialog", { name: "Preferências" });
}

const raiz = () => document.documentElement;

describe("preferências", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    ["data-tema", "data-destaque", "data-lista"].forEach((a) =>
      raiz().removeAttribute(a)
    );
    vi.mocked(listarLancamentos).mockResolvedValue([lancamento]);
    vi.mocked(listarRecorrencias).mockResolvedValue([
      {
        id: "r1", user_id: "u1", tipo: "saida", valor: 99.9,
        descricao: "spotify", categoria: "Assinaturas", frequencia: "mensal",
        dia_mes: 10, ativo: true, created_at: "2026-01-01T00:00:00Z",
      },
    ]);
  });

  it("a engrenagem abre as preferências, e o Sair mora lá dentro", async () => {
    montar();
    // O Sair saiu do cabeçalho...
    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
    const modal = await abrirPreferencias();
    // ...e está aqui, funcionando.
    await userEvent.click(within(modal).getByRole("button", { name: /Sair/ }));
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("tema escolhido vale na hora e fica salvo", async () => {
    montar();
    expect(raiz().getAttribute("data-tema")).toBe("claro");

    const modal = await abrirPreferencias();
    await userEvent.click(within(modal).getByRole("radio", { name: "Escuro" }));

    expect(raiz().getAttribute("data-tema")).toBe("escuro");
    expect(within(modal).getByRole("radio", { name: "Escuro" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS)!).tema).toBe("escuro");
  });

  it("cor de destaque troca, e voltar ao dourado limpa o atributo", async () => {
    montar();
    const modal = await abrirPreferencias();

    await userEvent.click(within(modal).getByRole("radio", { name: "Roxo" }));
    expect(raiz().getAttribute("data-destaque")).toBe("roxo");

    await userEvent.click(within(modal).getByRole("radio", { name: "Dourado" }));
    expect(raiz().hasAttribute("data-destaque")).toBe(false);
  });

  // O ponto da privacidade: nenhum número da tela principal pode sobrar.
  it("esconder valores some com todos os números da tela, e volta", async () => {
    montar();
    await screen.findByText("salário");
    // Renda, saldo e a linha da lista mostram o 1.790; o resumo, o 99,90.
    expect(screen.getAllByText(/1\.790,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/99,90/).length).toBeGreaterThan(0);

    const modal = await abrirPreferencias();
    await userEvent.click(within(modal).getByRole("switch", { name: /Esconder valores/ }));
    await userEvent.click(within(modal).getByRole("button", { name: "Fechar" }));

    expect(screen.queryByText(/1\.790,00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/99,90/)).not.toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(VALOR_OCULTO.replace("$", "\\$"))).length)
      .toBeGreaterThan(2);

    const modal2 = await abrirPreferencias();
    await userEvent.click(within(modal2).getByRole("switch", { name: /Esconder valores/ }));
    expect(screen.getAllByText(/1\.790,00/).length).toBeGreaterThan(0);
  });

  it("lista compacta liga o atributo que o CSS usa", async () => {
    montar();
    const modal = await abrirPreferencias();
    const interruptor = within(modal).getByRole("switch", { name: /Lista compacta/ });

    await userEvent.click(interruptor);
    expect(raiz().getAttribute("data-lista")).toBe("compacta");
    expect(interruptor).toHaveAttribute("aria-checked", "true");

    await userEvent.click(interruptor);
    expect(raiz().hasAttribute("data-lista")).toBe(false);
  });

  it("as linhas da lista têm os ganchos que o CSS compacto procura", async () => {
    montar();
    const descricao = await screen.findByText("salário");
    expect(descricao).toHaveClass("descricao-lancamento");
    expect(descricao.closest(".item-lancamento")).not.toBeNull();
    expect(descricao.closest(".lista-lancamentos")).not.toBeNull();
  });

  it("o que foi escolhido sobrevive a fechar e abrir o app", async () => {
    const { unmount } = montar();
    const modal = await abrirPreferencias();
    await userEvent.click(within(modal).getByRole("radio", { name: "Azul" }));
    await userEvent.click(within(modal).getByRole("switch", { name: /Esconder valores/ }));
    unmount();
    raiz().removeAttribute("data-destaque");

    montar();
    await waitFor(() => expect(raiz().getAttribute("data-destaque")).toBe("azul"));
    await screen.findByText("salário");
    expect(screen.queryByText(/1\.790,00/)).not.toBeInTheDocument();
  });

  // As linhas "a receber", "a pagar" e o projetado só entram no DOM com o
  // card aberto (hover no computador, toque no celular). Sem abrir, um teste
  // de privacidade passaria sem nunca ter olhado para elas.
  it("esconde também o detalhe do card do saldo", async () => {
    vi.setSystemTime(new Date(2026, 10, 3, 12));
    vi.mocked(listarRecorrencias).mockResolvedValue([]);
    vi.mocked(listarLancamentos).mockResolvedValue([
      { ...lancamento, mes: 10, ano: 2026, data: "2026-11-01" },
      {
        ...lancamento, id: "l2", descricao: "freela", valor: 130,
        mes: 10, ano: 2026, data: "2026-11-20",
      },
      {
        ...lancamento, id: "l3", tipo: "saida", descricao: "aluguel",
        categoria: "Moradia", valor: 800, mes: 10, ano: 2026, data: "2026-11-25",
      },
    ]);

    montar();
    await screen.findByText("aluguel");
    const card = screen.getByText("Saldo atual").closest(".card") as HTMLElement;

    await userEvent.hover(card);
    expect(within(card).getByText(/a receber/)).toHaveTextContent("130,00");
    expect(within(card).getByText(/a pagar/)).toHaveTextContent("800,00");
    // 1.790 + 130 − 800
    expect(within(card).getByText(/Saldo projetado/)).toHaveTextContent("1.120,00");

    await userEvent.unhover(card);
    const modal = await abrirPreferencias();
    await userEvent.click(within(modal).getByRole("switch", { name: /Esconder valores/ }));
    await userEvent.click(within(modal).getByRole("button", { name: "Fechar" }));

    await userEvent.hover(card);
    for (const linha of [/a receber/, /a pagar/, /Saldo projetado/]) {
      const texto = within(card).getByText(linha).textContent ?? "";
      expect(texto, `vazou em: ${texto}`).not.toMatch(/\d,\d{2}/);
      expect(texto).toContain("•••••");
    }

    vi.useRealTimers();
  });
});

