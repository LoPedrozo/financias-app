// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import MonthPicker from "./MonthPicker";

const montar = (mes: number, ano: number) => {
  const onChange = vi.fn();
  render(<MonthPicker mes={mes} ano={ano} onChange={onChange} />);
  return onChange;
};

describe("carrossel de meses", () => {
  it("mostra o mês da tela no meio e dois vizinhos de cada lado", () => {
    montar(10, 2026);
    expect(screen.getByRole("button", { name: /agora: Novembro de 2026/ })).toHaveTextContent("Novembro 2026");
    expect(screen.getByRole("button", { name: "Mês anterior" })).toHaveTextContent("Outubro");
    expect(screen.getByRole("button", { name: "Próximo mês" })).toHaveTextContent("Dezembro");
    expect(screen.getByRole("button", { name: "Setembro de 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Janeiro de 2027" })).toBeInTheDocument();
  });

  // Sem o ano, "Janeiro" ao lado de "Dezembro 2026" pareceria janeiro de 2026.
  it("na virada do ano, o vizinho mostra o ano dele", () => {
    montar(11, 2026);
    // O botão leva o nome inteiro e o abreviado (o CSS mostra um por largura).
    const proximo = screen.getByRole("button", { name: "Próximo mês" });
    expect(proximo.querySelector(".mp-nome-longo")).toHaveTextContent("Janeiro");
    expect(proximo.querySelector(".mp-nome-curto")).toHaveTextContent("Jan");
    expect(proximo.querySelector(".mp-vizinho-ano")).toHaveTextContent("2027");
    const anterior = screen.getByRole("button", { name: "Mês anterior" });
    expect(anterior.querySelector(".mp-nome-longo")).toHaveTextContent("Novembro");
    expect(anterior.querySelector(".mp-vizinho-ano")).toBeNull();
  });

  it("tocar num vizinho vai até ele, atravessando o ano", () => {
    const onChange = montar(11, 2026);
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(onChange).toHaveBeenLastCalledWith(0, 2027);
    fireEvent.click(screen.getByRole("button", { name: "Fevereiro de 2027" }));
    expect(onChange).toHaveBeenLastCalledWith(1, 2027);
    fireEvent.click(screen.getByRole("button", { name: "Outubro de 2026" }));
    expect(onChange).toHaveBeenLastCalledWith(9, 2026);
  });

  it("janeiro volta para dezembro do ano anterior", () => {
    const onChange = montar(0, 2027);
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(onChange).toHaveBeenLastCalledWith(11, 2026);
  });

  it("o mês do meio abre a grade para saltos longos", () => {
    const onChange = montar(10, 2026);
    fireEvent.click(screen.getByRole("button", { name: /agora: Novembro de 2026/ }));
    const grade = screen.getByRole("dialog", { name: "Selecionar mês e ano" });
    fireEvent.click(within(grade).getByRole("button", { name: "Próximo ano" }));
    fireEvent.click(within(grade).getByRole("button", { name: "Mar" }));
    expect(onChange).toHaveBeenLastCalledWith(2, 2027);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
