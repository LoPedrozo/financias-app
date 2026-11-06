// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModalAdicionar from "./ModalAdicionar";
import type { Lancamento } from "../types";

// Escrever ou colar vários. O que importa: o que vai para o servidor, o aviso
// antes de duplicar, o rascunho que sobrevive e a saída para o formulário.

// A data das linhas sem data: no visual antigo um campo de data rotulado
// "Data…"; no novo, o "Outra" dos atalhos.
function mudarData(iso: string) {
  const outra = screen.queryByLabelText("Outra data");
  fireEvent.change(outra ?? screen.getByLabelText(/^Data/), { target: { value: iso } });
}

function abrir(props: Partial<React.ComponentProps<typeof ModalAdicionar>> = {}) {
  const onSalvar = vi.fn(async () => {});
  const onFechar = vi.fn();
  const onFormularioCompleto = vi.fn();
  render(
    <ModalAdicionar
      dataPadrao="2026-11-06"
      jaLancados={[]}
      onSalvar={onSalvar}
      onFechar={onFechar}
      onFormularioCompleto={onFormularioCompleto}
      {...props}
    />
  );
  return { onSalvar, onFechar, onFormularioCompleto };
}

beforeEach(() => {
  localStorage.clear();
  vi.setSystemTime(new Date(2026, 10, 6, 12));
});
afterEach(() => vi.useRealTimers());

describe("ModalAdicionar", () => {
  it("lê as linhas, mostra a prévia e salva tudo de uma vez", async () => {
    const { onSalvar } = abrir();
    await userEvent.type(document.querySelector("textarea")!, "almoço 25{Enter}+ mesada 500");
    expect(screen.getByText("2 lançamentos")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Salvar 2 lançamentos" }));
    expect(onSalvar).toHaveBeenCalledWith([
      { tipo: "saida", valor: 25, descricao: "almoço", categoria: "Alimentação", mes: 10, ano: 2026, data: "2026-11-06" },
      { tipo: "entrada", valor: 500, descricao: "mesada", categoria: "Mesada", mes: 10, ano: 2026, data: "2026-11-06" },
    ]);
  });

  it("a data escolhida vale para as linhas sem data, e a competência sai dela", async () => {
    const { onSalvar } = abrir();
    await userEvent.type(document.querySelector("textarea")!, "uber 18{Enter}12/10 internet 120");
    mudarData("2026-10-31");
    await userEvent.click(screen.getByRole("button", { name: "Salvar 2 lançamentos" }));
    expect(onSalvar).toHaveBeenCalledWith([
      expect.objectContaining({ descricao: "uber", data: "2026-10-31", mes: 9 }),
      expect.objectContaining({ descricao: "internet", data: "2026-10-12", mes: 9 }),
    ]);
  });

  it("tocar no sinal troca entrada e saída, e a categoria é refeita", async () => {
    const { onSalvar } = abrir();
    // "mesada" o app já lê como entrada; tocando, vira saída — e Mesada não
    // existe entre as saídas, então a categoria cai no padrão.
    await userEvent.type(document.querySelector("textarea")!, "mesada 500");
    await userEvent.click(screen.getByRole("button", { name: /mesada: entrada/ }));
    expect(screen.getByRole("button", { name: /mesada: saída/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Salvar lançamento" }));
    expect(onSalvar).toHaveBeenCalledWith([expect.objectContaining({ tipo: "saida", categoria: "Outros" })]);
  });

  it("dá para corrigir a categoria de uma linha", async () => {
    const { onSalvar } = abrir();
    await userEvent.type(document.querySelector("textarea")!, "presente mãe 80");
    await userEvent.selectOptions(screen.getByLabelText("Categoria de presente mãe"), "Outros");
    await userEvent.click(screen.getByRole("button", { name: "Salvar lançamento" }));
    expect(onSalvar).toHaveBeenCalledWith([expect.objectContaining({ categoria: "Outros" })]);
  });

  it("avisa o que já está lançado e tira as repetidas num toque", async () => {
    const ja: Lancamento = {
      id: "x", user_id: "u", tipo: "saida", valor: 25, descricao: "almoço", categoria: "Alimentação",
      mes: 10, ano: 2026, data: "2026-11-06", created_at: "",
    };
    const { onSalvar } = abrir({ jaLancados: [ja] });
    await userEvent.type(document.querySelector("textarea")!, "almoço 25{Enter}uber 18");
    expect(screen.getByText(/1 linha já está lançada/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tirar a repetida" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar lançamento" }));
    expect(onSalvar).toHaveBeenCalledWith([expect.objectContaining({ descricao: "uber" })]);
  });

  it("tirar uma linha da lista", async () => {
    const { onSalvar } = abrir();
    await userEvent.type(document.querySelector("textarea")!, "almoço 25{Enter}uber 18");
    await userEvent.click(screen.getByRole("button", { name: "Tirar almoço da lista" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar lançamento" }));
    expect(onSalvar).toHaveBeenCalledWith([expect.objectContaining({ descricao: "uber" })]);
  });

  it("sem linhas, o botão pede para escrever; com Ctrl+Enter, salva", async () => {
    const { onSalvar } = abrir();
    expect(screen.getByRole("button", { name: "Escreva ou cole acima" })).toBeDisabled();
    await userEvent.type(document.querySelector("textarea")!, "café 6{Control>}{Enter}{/Control}");
    expect(onSalvar).toHaveBeenCalledTimes(1);
  });

  it("o texto fica guardado e volta na próxima vez, com a opção de limpar", async () => {
    const { onFechar } = abrir();
    await userEvent.type(document.querySelector("textarea")!, "pão 10");
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onFechar).toHaveBeenCalled();
    document.body.innerHTML = "";
    abrir();
    expect(document.querySelector("textarea")).toHaveValue("pão 10");
    expect(screen.getByText(/Recuperei o que você tinha escrito/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(document.querySelector("textarea")).toHaveValue("");
  });

  it("com uma linha, o formulário completo abre já preenchido", async () => {
    const { onFormularioCompleto } = abrir();
    await userEvent.type(document.querySelector("textarea")!, "almoço 25");
    await userEvent.click(screen.getByRole("button", { name: /Abrir formulário completo/ }));
    expect(onFormularioCompleto).toHaveBeenCalledWith(
      { tipo: "saida", valor: 25, descricao: "almoço", categoria: "Alimentação" },
      "2026-11-06"
    );
  });
});

