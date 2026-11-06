// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModalExportar from "./ModalExportar";
import ConfirmModal from "./ConfirmModal";
import type { Lancamento } from "../types";

const l = (id: string, mes: number, ano: number): Lancamento => ({
  id, user_id: "u", tipo: "saida", valor: 10, descricao: id, categoria: "Outros", mes, ano,
  data: `${ano}-${String(mes + 1).padStart(2, "0")}-05`, created_at: "",
});

describe("ModalExportar", () => {
  it("cada recorte mostra quantos leva; o vazio fica desligado", async () => {
    const onExportar = vi.fn();
    render(
      <ModalExportar mes={10} ano={2026} lancamentos={[l("a", 9, 2026), l("b", 0, 2025)]} onExportar={onExportar} onFechar={() => {}} />
    );
    expect(screen.getByRole("button", { name: /Novembro de 2026.*nenhum lançamento/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Ano de 2026.*1 lançamento/ })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: /^Tudo.*2 lançamentos/ }));
    expect(onExportar).toHaveBeenCalledWith({ tipo: "tudo" });
  });

  it("fecha pelo X", async () => {
    const onFechar = vi.fn();
    render(<ModalExportar mes={10} ano={2026} lancamentos={[]} onExportar={() => {}} onFechar={onFechar} />);
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onFechar).toHaveBeenCalledTimes(1);
  });
});

describe("ConfirmModal", () => {
  it("confirma e cancela pelos botões", async () => {
    const onConfirmar = vi.fn();
    const onCancelar = vi.fn();
    render(
      <ConfirmModal titulo="Excluir recorrência?" mensagem="Os lançamentos futuros somem." onConfirmar={onConfirmar} onCancelar={onCancelar} />
    );
    expect(screen.getByRole("heading", { name: "Excluir recorrência?" })).toBeInTheDocument();
    expect(screen.getByText("Os lançamentos futuros somem.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });
});
