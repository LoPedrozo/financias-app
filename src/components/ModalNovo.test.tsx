// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModalNovo from "./ModalNovo";

function abrir(props: Partial<React.ComponentProps<typeof ModalNovo>> = {}) {
  const onSalvar = vi.fn();
  const onFechar = vi.fn();
  const onColarLista = vi.fn();
  render(
    <ModalNovo
      dataInicial="2026-11-03"
      onSalvar={onSalvar}
      onFechar={onFechar}
      onColarLista={onColarLista}
      {...props}
    />
  );
  return { onSalvar, onFechar, onColarLista };
}

describe("ModalNovo", () => {
  it("abre em Entrada, com as categorias de entrada", () => {
    abrir();
    expect(screen.getByLabelText("Categoria")).toHaveValue("Salário");
    expect(
      screen.getByPlaceholderText("ex: salário de outubro")
    ).toBeInTheDocument();
  });

  it("trocar para Saída troca a lista de categorias", async () => {
    abrir();
    await userEvent.click(screen.getByRole("button", { name: "Saída" }));
    expect(screen.getByLabelText("Categoria")).toHaveValue("Alimentação");
  });

  it("salva com a competência tirada da data, não do mês na tela", async () => {
    const { onSalvar } = abrir();
    await userEvent.type(screen.getByLabelText("Valor (R$)"), "1500,50");
    await userEvent.type(screen.getByLabelText("Descrição"), "mesada pai");
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar lançamento" })
    );

    expect(onSalvar).toHaveBeenCalledWith({
      tipo: "entrada",
      valor: 1500.5,
      descricao: "mesada pai",
      categoria: "Salário",
      mes: 10,
      ano: 2026,
      data: "2026-11-03",
    });
  });

  it("não salva sem descrição, e diz por quê", async () => {
    const { onSalvar } = abrir();
    await userEvent.type(screen.getByLabelText("Valor (R$)"), "20");
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar lançamento" })
    );

    expect(onSalvar).not.toHaveBeenCalled();
    expect(
      screen.getByText("Descrição obrigatória (mínimo 3 caracteres).")
    ).toBeInTheDocument();
  });

  it("leva para o Adicionar o que já tinha sido digitado", async () => {
    const { onColarLista } = abrir();
    await userEvent.type(screen.getByLabelText("Valor (R$)"), "25");
    await userEvent.type(screen.getByLabelText("Descrição"), "almoço");
    await userEvent.click(
      screen.getByRole("button", { name: /Escrever ou colar vários/ })
    );

    expect(onColarLista).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "entrada", valor: 25, descricao: "almoço" }),
      "2026-11-03"
    );
  });

  it("editando, respeita o tipo e os valores do lançamento", () => {
    abrir({
      lancamentoParaEditar: {
        id: "1", user_id: "u", tipo: "saida", valor: 40, descricao: "almoço",
        categoria: "Alimentação", mes: 10, ano: 2026, data: "2026-11-02",
        created_at: "2026-11-02T12:00:00Z",
      },
    });
    expect(screen.getByLabelText("Valor (R$)")).toHaveValue("40");
    expect(screen.getByLabelText("Categoria")).toHaveValue("Alimentação");
    // Sem o botão de ir para o Adicionar: editar é sobre uma linha só.
    expect(
      screen.queryByRole("button", { name: /Escrever ou colar vários/ })
    ).not.toBeInTheDocument();
  });
});
