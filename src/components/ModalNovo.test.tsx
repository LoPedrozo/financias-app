// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModalNovo from "./ModalNovo";

function abrir(props: Partial<React.ComponentProps<typeof ModalNovo>> = {}) {
  const onSalvar = vi.fn();
  const onFechar = vi.fn();
  const onColarLista = vi.fn();
  render(
    <ModalNovo
      onSalvar={onSalvar}
      onFechar={onFechar}
      onColarLista={onColarLista}
      {...props}
    />
  );
  return { onSalvar, onFechar, onColarLista };
}

const marcada = () => screen.getByRole("radio", { checked: true });
const salvar = (nome = "Salvar entrada") => userEvent.click(screen.getByRole("button", { name: nome }));

// Dia 1º de novembro: "Ontem" cai em outubro, que é o caso que importa para
// a competência.
beforeEach(() => vi.setSystemTime(new Date(2026, 10, 1, 12)));
afterEach(() => vi.useRealTimers());

describe("ModalNovo", () => {
  it("abre em Entrada, com as categorias de entrada e Salário marcada", () => {
    abrir();
    expect(screen.getByRole("button", { name: /Entrada/ })).toHaveAttribute("aria-pressed", "true");
    expect(marcada()).toHaveAccessibleName("Salário");
    expect(screen.getByRole("radio", { name: "Bolsa / Auxílio" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Alimentação" })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("ex: salário de outubro")).toBeInTheDocument();
  });

  it("trocar para Saída troca a grade de categorias e o botão", async () => {
    abrir();
    await userEvent.click(screen.getByRole("button", { name: /Saída/ }));
    expect(marcada()).toHaveAccessibleName("Alimentação");
    expect(screen.getByRole("radio", { name: "Cartão de Crédito / Contas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar saída" })).toBeInTheDocument();
  });

  // As fotos mostraram um contorno branco em quem deixava de estar
  // selecionado: o React tirava a cor e a borda ficava na cor do texto.
  it("categoria e data desmarcadas voltam a ter a borda transparente", async () => {
    abrir();
    const salario = screen.getByRole("radio", { name: "Salário" });
    const hoje = screen.getByRole("button", { name: /^Hoje/ });
    await userEvent.click(screen.getByRole("radio", { name: "Mesada" }));
    await userEvent.click(screen.getByRole("button", { name: /^Ontem/ }));
    expect(salario.style.borderColor).toBe("transparent");
    expect(hoje.style.borderColor).toBe("transparent");
    expect(screen.getByRole("radio", { name: "Mesada" }).style.borderColor).not.toBe("transparent");
  });

  it("a grade mostra o nome curto, mas grava o nome completo da categoria", async () => {
    const { onSalvar } = abrir();
    await userEvent.click(screen.getByRole("button", { name: /Saída/ }));
    const cartao = screen.getByRole("radio", { name: "Cartão de Crédito / Contas" });
    expect(cartao).toHaveTextContent("Cartão / Contas");
    await userEvent.click(cartao);
    expect(cartao).toHaveAttribute("aria-checked", "true");
    await userEvent.type(screen.getByLabelText("Valor"), "120");
    await userEvent.type(screen.getByLabelText("Descrição"), "internet");
    await salvar("Salvar saída");
    expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ tipo: "saida", categoria: "Cartão de Crédito / Contas" }));
  });

  it("abre em Hoje e salva com a data de hoje", async () => {
    const { onSalvar } = abrir();
    expect(screen.getByRole("button", { name: /^Hoje/ })).toHaveAttribute("aria-pressed", "true");
    await userEvent.type(screen.getByLabelText("Valor"), "1500,50");
    await userEvent.type(screen.getByLabelText("Descrição"), "mesada pai");
    await salvar();
    expect(onSalvar).toHaveBeenCalledWith({
      tipo: "entrada", valor: 1500.5, descricao: "mesada pai", categoria: "Salário",
      mes: 10, ano: 2026, data: "2026-11-01",
    });
  });

  it("Ontem no dia 1º grava no mês anterior: a competência sai da data", async () => {
    const { onSalvar } = abrir();
    await userEvent.click(screen.getByRole("button", { name: /^Ontem/ }));
    expect(screen.getByRole("button", { name: /^Ontem/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Hoje/ })).toHaveAttribute("aria-pressed", "false");
    await userEvent.type(screen.getByLabelText("Valor"), "25");
    await userEvent.type(screen.getByLabelText("Descrição"), "almoço");
    await salvar();
    expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ mes: 9, ano: 2026, data: "2026-10-31" }));
  });

  it("Outra: a data escolhida aparece no lugar da palavra e vale para a competência", async () => {
    const { onSalvar } = abrir();
    fireEvent.change(screen.getByLabelText("Outra data"), { target: { value: "2025-12-12" } });
    expect(screen.getByLabelText("Outra data").parentElement).toHaveTextContent("12 dez 2025");
    expect(screen.getByRole("button", { name: /^Hoje/ })).toHaveAttribute("aria-pressed", "false");
    await userEvent.type(screen.getByLabelText("Valor"), "80");
    await userEvent.type(screen.getByLabelText("Descrição"), "presente");
    await salvar();
    expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ mes: 11, ano: 2025, data: "2025-12-12" }));
  });

  it("vindo de outro mês (data inicial dia 1º de dezembro), abre em Outra com a data", () => {
    abrir({ dataInicial: "2026-12-01" });
    expect(screen.getByLabelText("Outra data").parentElement).toHaveTextContent("1 dez");
    expect(screen.getByRole("button", { name: /^Hoje/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("data apagada no seletor: não salva e diz por quê", async () => {
    const { onSalvar } = abrir();
    fireEvent.change(screen.getByLabelText("Outra data"), { target: { value: "" } });
    await userEvent.type(screen.getByLabelText("Valor"), "20");
    await userEvent.type(screen.getByLabelText("Descrição"), "lanche");
    await salvar();
    expect(onSalvar).not.toHaveBeenCalled();
    expect(screen.getByText("Informe uma data válida.")).toBeInTheDocument();
    // Um toque em Hoje resolve.
    await userEvent.click(screen.getByRole("button", { name: /^Hoje/ }));
    expect(screen.queryByText("Informe uma data válida.")).not.toBeInTheDocument();
    await salvar();
    expect(onSalvar).toHaveBeenCalledTimes(1);
  });

  it("não salva sem descrição, e diz por quê", async () => {
    const { onSalvar } = abrir();
    await userEvent.type(screen.getByLabelText("Valor"), "20");
    await salvar();
    expect(onSalvar).not.toHaveBeenCalled();
    expect(screen.getByText("Descrição obrigatória (mínimo 3 caracteres).")).toBeInTheDocument();
  });

  it("valor: só aceita número, recusa formato estranho e valor absurdo", async () => {
    const { onSalvar } = abrir();
    const campo = screen.getByLabelText("Valor");
    await userEvent.type(campo, "R$ 1a2");
    expect(campo).toHaveValue("12");
    await userEvent.clear(campo);
    await userEvent.type(campo, "10,505");
    await userEvent.type(screen.getByLabelText("Descrição"), "teste");
    await salvar();
    expect(screen.getByText("Formato inválido. Use ex: 10,50 ou 10.50")).toBeInTheDocument();
    await userEvent.clear(campo);
    await userEvent.type(campo, "2000000000");
    await salvar();
    expect(screen.getByText("Valor muito alto. Verifique se digitou corretamente.")).toBeInTheDocument();
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it("o valor encolhe quando fica comprido, para caber na tela", async () => {
    abrir();
    const campo = screen.getByLabelText("Valor");
    // O campo herda o tamanho da caixa em volta dele.
    const tamanho = () => campo.parentElement!.style.fontSize;
    await userEvent.type(campo, "25");
    expect(tamanho()).toBe("44px");
    await userEvent.type(campo, "0000,00");
    expect(tamanho()).toBe("36px");
    await userEvent.type(campo, "00");
    expect(tamanho()).toBe("30px");
  });

  it("Enter no campo de descrição salva", async () => {
    const { onSalvar } = abrir();
    await userEvent.type(screen.getByLabelText("Valor"), "30");
    await userEvent.type(screen.getByLabelText("Descrição"), "uber{Enter}");
    expect(onSalvar).toHaveBeenCalledTimes(1);
  });

  it("leva para o Adicionar o que já tinha sido digitado", async () => {
    const { onColarLista } = abrir({ dataInicial: "2026-11-03" });
    await userEvent.type(screen.getByLabelText("Valor"), "25");
    await userEvent.type(screen.getByLabelText("Descrição"), "almoço");
    await userEvent.click(screen.getByRole("button", { name: /Escrever ou colar vários/ }));
    expect(onColarLista).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "entrada", valor: 25, descricao: "almoço", categoria: "Salário" }),
      "2026-11-03"
    );
  });

  it("editando, respeita o tipo e os valores do lançamento", async () => {
    const { onSalvar } = abrir({
      lancamentoParaEditar: {
        id: "1", user_id: "u", tipo: "saida", valor: 40.5, descricao: "almoço",
        categoria: "Alimentação", mes: 9, ano: 2026, data: "2026-10-20",
        created_at: "2026-10-20T12:00:00Z",
      },
    });
    expect(screen.getByRole("heading", { name: "Editar lançamento" })).toBeInTheDocument();
    expect(screen.getByLabelText("Valor")).toHaveValue("40,50");
    expect(marcada()).toHaveAccessibleName("Alimentação");
    expect(screen.getByLabelText("Outra data").parentElement).toHaveTextContent("20 out");
    // Sem o botão de ir para o Adicionar: editar é sobre uma linha só.
    expect(screen.queryByRole("button", { name: /Escrever ou colar vários/ })).not.toBeInTheDocument();
    await salvar("Salvar alterações");
    expect(onSalvar).toHaveBeenCalledWith({
      tipo: "saida", valor: 40.5, descricao: "almoço", categoria: "Alimentação",
      mes: 9, ano: 2026, data: "2026-10-20",
    });
  });

  it("valores iniciais (conta paga, atalho) chegam preenchidos", () => {
    abrir({ valoresIniciais: { tipo: "saida", valor: 99.9, descricao: "luz", categoria: "Casa" } });
    expect(screen.getByLabelText("Valor")).toHaveValue("99,90");
    expect(screen.getByLabelText("Descrição")).toHaveValue("luz");
    expect(marcada()).toHaveAccessibleName("Casa");
    expect(screen.getByRole("button", { name: "Salvar saída" })).toBeInTheDocument();
  });

  it("fecha pelo X e tocando fora, mas não tocando dentro", async () => {
    const { onFechar } = abrir();
    await userEvent.click(screen.getByRole("heading", { name: "Novo lançamento" }));
    expect(onFechar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onFechar).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onFechar).toHaveBeenCalledTimes(2);
  });
});
