// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "./Dashboard";
import { criarLancamento, listarLancamentos } from "../lib/lancamentos";

// O Dashboard conversa com o servidor por estes quatro módulos. Mockados, a
// tela inteira roda em memória e dá para provocar a falha de rede que é
// impossível de reproduzir à mão.
vi.mock("../lib/supabase", () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));

vi.mock("../lib/lancamentos", () => ({
  listarLancamentos: vi.fn(async () => []),
  criarLancamento: vi.fn(async (item) => ({
    ...item,
    id: "novo-1",
    user_id: "u1",
    created_at: new Date().toISOString(),
  })),
  atualizarLancamento: vi.fn(async (id, item) => ({ ...item, id, user_id: "u1" })),
  removerLancamento: vi.fn(async () => {}),
  criarLancamentosEmLote: vi.fn(async () => []),
  removerLancamentosEmLote: vi.fn(async () => {}),
}));

vi.mock("../lib/recorrencias", () => ({
  listarRecorrencias: vi.fn(async () => []),
  gerarLancamentosRecorrentes: vi.fn(async () => []),
}));

// Os gráficos arrastam o recharts inteiro e não têm nada a ver com o que se
// testa aqui.
vi.mock("./Graficos", () => ({
  GraficoCategorias: () => null,
  GraficoAnual: () => null,
}));

const sessao = {
  user: { id: "u1", email: "eu@exemplo.com" },
} as unknown as Session;

async function abrirFormulario() {
  await userEvent.click(screen.getByRole("button", { name: "Novo lançamento" }));
  await screen.findByText("Novo lançamento", { selector: "h3" });
}

async function preencher(valor: string, descricao: string) {
  await userEvent.type(screen.getByLabelText("Valor (R$)"), valor);
  await userEvent.type(screen.getByLabelText("Descrição"), descricao);
  await userEvent.click(
    screen.getByRole("button", { name: "Salvar lançamento" })
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listarLancamentos).mockResolvedValue([]);
  });

  it("o + abre o formulário completo, não o campo de colar", async () => {
    render(<Dashboard session={sessao} />);
    await abrirFormulario();
    expect(screen.getByLabelText("Categoria")).toBeInTheDocument();
  });

  it("salvando com sucesso, fecha o formulário", async () => {
    render(<Dashboard session={sessao} />);
    await abrirFormulario();
    await preencher("200", "mesada pai");

    await waitFor(() =>
      expect(
        screen.queryByText("Novo lançamento", { selector: "h3" })
      ).not.toBeInTheDocument()
    );
    expect(criarLancamento).toHaveBeenCalledTimes(1);
  });

  // A regressão que motivou a correção: a conexão cai, o toast de erro
  // aparece — e o formulário sumia levando junto o que tinha sido digitado.
  it("falhando ao salvar, mantém o formulário aberto com o que foi digitado", async () => {
    vi.mocked(criarLancamento).mockRejectedValueOnce(new Error("sem rede"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Dashboard session={sessao} />);
    await abrirFormulario();
    await preencher("200", "mesada pai");

    expect(
      await screen.findByText(/Não foi possível salvar/)
    ).toBeInTheDocument();
    expect(
      screen.getByText("Novo lançamento", { selector: "h3" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Valor (R$)")).toHaveValue("200");
    expect(screen.getByLabelText("Descrição")).toHaveValue("mesada pai");
  });

  // Antes, trocar de mês refazia o fetch de todos os lançamentos de todos os
  // meses — a cada toque na seta.
  it("navegar entre meses não rebaixa a base inteira", async () => {
    render(<Dashboard session={sessao} />);
    await waitFor(() => expect(listarLancamentos).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    await userEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    await userEvent.click(screen.getByRole("button", { name: "Mês anterior" }));

    expect(listarLancamentos).toHaveBeenCalledTimes(1);
  });
});
