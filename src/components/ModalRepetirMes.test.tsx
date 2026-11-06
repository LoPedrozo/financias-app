// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModalRepetirMes from "./ModalRepetirMes";
import type { Lancamento } from "../types";

// Trazer o mês passado para o mês da tela. Os testes travam o que vai para o
// servidor: só o que está marcado, com o valor ajustado, no mesmo dia do mês
// novo (ou no último, se ele for mais curto).

const l = (id: string, tipo: "entrada" | "saida", valor: number, data: string, extra: Partial<Lancamento> = {}): Lancamento => ({
  id, user_id: "u", tipo, valor, descricao: id, categoria: tipo === "entrada" ? "Mesada" : "Casa",
  mes: Number(data.slice(5, 7)) - 1, ano: Number(data.slice(0, 4)), data, created_at: `${data}T12:00:00Z`, ...extra,
});

const origem = [
  l("aluguel", "saida", 900, "2026-10-05"),
  l("mesada", "entrada", 500, "2026-10-01"),
  l("internet", "saida", 120, "2026-10-31"),
  l("netflix", "saida", 55.9, "2026-10-10", { recorrencia_id: "r1" }),
];

function abrir(jaNoMes: Lancamento[] = []) {
  const onSalvar = vi.fn(async () => {});
  const onFechar = vi.fn();
  render(
    <ModalRepetirMes mes={10} ano={2026} origem={origem} jaNoMes={jaNoMes} mesOrigemNome="Outubro" onFechar={onFechar} onSalvar={onSalvar} />
  );
  return { onSalvar, onFechar };
}

const caixa = (nome: string) => screen.getByRole("checkbox", { name: new RegExp(`^${nome}`) });

describe("ModalRepetirMes", () => {
  it("lista o mês passado sem os de recorrência, que se geram sozinhos", () => {
    abrir();
    expect(screen.getByRole("heading", { name: "Repetir Outubro em Novembro" })).toBeInTheDocument();
    expect(caixa("aluguel")).toBeChecked();
    expect(caixa("mesada")).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: /netflix/ })).not.toBeInTheDocument();
    expect(screen.getByText(/1 lançamento de recorrência ficou/)).toBeInTheDocument();
  });

  it("o que já existe no mês novo vem desmarcado", () => {
    abrir([l("aluguel", "saida", 950, "2026-11-05")]);
    expect(caixa("aluguel")).not.toBeChecked();
    expect(screen.getByText(/1 já existe em Novembro/)).toBeInTheDocument();
  });

  it("traz o que está marcado, com o valor ajustado e o dia certo (31 vira 30)", async () => {
    const { onSalvar } = abrir();
    await userEvent.click(caixa("mesada"));
    const internet = screen.getByLabelText("Valor de internet");
    await userEvent.clear(internet);
    await userEvent.type(internet, "129,90");
    await userEvent.click(screen.getByRole("button", { name: "Trazer 2 para Novembro" }));
    expect(onSalvar).toHaveBeenCalledWith([
      { tipo: "saida", valor: 900, descricao: "aluguel", categoria: "Casa", mes: 10, ano: 2026, data: "2026-11-05" },
      { tipo: "saida", valor: 129.9, descricao: "internet", categoria: "Casa", mes: 10, ano: 2026, data: "2026-11-30" },
    ]);
  });

  it("valor inválido trava o botão e diz onde olhar", async () => {
    const { onSalvar } = abrir();
    const aluguel = screen.getByLabelText("Valor de aluguel");
    await userEvent.clear(aluguel);
    const botao = screen.getByRole("button", { name: "Confira os valores em vermelho" });
    expect(botao).toBeDisabled();
    await userEvent.click(botao);
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it("nada marcado: o botão pede para escolher", async () => {
    abrir();
    for (const n of ["aluguel", "mesada", "internet"]) await userEvent.click(caixa(n));
    expect(screen.getByRole("button", { name: "Escolha o que repetir" })).toBeDisabled();
  });

  it("o resumo soma entradas menos saídas do que está marcado", async () => {
    abrir();
    // 500 − 900 − 120 = −520
    expect(screen.getByText(/3 de 3/)).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.textContent?.replace(/\s/g, " ") === "− R$ 520,00")).toBeInTheDocument();
  });
});
