// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import MonthPicker from "./MonthPicker";

afterEach(() => vi.useRealTimers());

const montar = (mes: number, ano: number) => {
  const onChange = vi.fn();
  render(<MonthPicker mes={mes} ano={ano} onChange={onChange} />);
  return onChange;
};

describe("carrossel de meses", () => {
  it("mostra o mês da tela no meio e dois vizinhos de cada lado, abreviados", () => {
    vi.setSystemTime(new Date(2026, 10, 6));
    montar(10, 2026);
    expect(screen.getByRole("button", { name: /agora: Novembro de 2026/ })).toHaveTextContent(/^Nov$/);
    expect(screen.getByRole("button", { name: "Mês anterior" })).toHaveTextContent(/^Out$/);
    expect(screen.getByRole("button", { name: "Próximo mês" })).toHaveTextContent(/^Dez$/);
    expect(screen.getByRole("button", { name: "Setembro de 2026" })).toHaveTextContent(/^Set$/);
    expect(screen.getByRole("button", { name: "Janeiro de 2027" })).toHaveTextContent(/^Jan$/);
  });

  // O ano mora na data do topo. No carrossel ele só aparece quando o mês da
  // tela é de outro ano — senão "Jan" de 2027 pareceria janeiro deste ano.
  it("o ano só aparece fora do ano corrente", () => {
    vi.setSystemTime(new Date(2026, 10, 6));
    const { container, rerender } = render(<MonthPicker mes={11} ano={2026} onChange={vi.fn()} />);
    expect(container).not.toHaveTextContent("2026");
    rerender(<MonthPicker mes={0} ano={2027} onChange={vi.fn()} />);
    expect(container.querySelector(".mp-ano")).toHaveTextContent("2027");
    rerender(<MonthPicker mes={11} ano={2025} onChange={vi.fn()} />);
    expect(container.querySelector(".mp-ano")).toHaveTextContent("2025");
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
