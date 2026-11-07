// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModalRecorrencia from "./ModalRecorrencia";
import type { Lancamento, Recorrencia } from "../types";

// O que a recorrência grava. As interações passam por estas funções, que
// funcionam com a lista suspensa antiga e com a grade/chips do visual novo:
// os mesmos testes valem antes e depois da troca.
const valor = () => screen.getByLabelText(/^Valor/);
async function escolherCategoria(nome: string) {
  const radio = screen.queryByRole("radio", { name: nome });
  if (radio) await userEvent.click(radio);
  else await userEvent.selectOptions(screen.getByLabelText("Categoria"), nome);
}
async function escolherDiaDaSemana(nome: string, indice: number) {
  const chip = screen.queryByRole("radio", { name: nome });
  if (chip) await userEvent.click(chip);
  else await userEvent.selectOptions(screen.getByLabelText("Dia da semana"), String(indice));
}

function abrir(props: Partial<React.ComponentProps<typeof ModalRecorrencia>> = {}) {
  const onSalvar = vi.fn(async () => {});
  const onFechar = vi.fn();
  render(<ModalRecorrencia onSalvar={onSalvar} onFechar={onFechar} {...props} />);
  return { onSalvar, onFechar };
}

beforeEach(() => vi.setSystemTime(new Date(2026, 10, 6, 12)));
afterEach(() => vi.useRealTimers());

describe("ModalRecorrencia", () => {
  it("cria uma saída mensal com o dia escolhido", async () => {
    const { onSalvar } = abrir();
    await userEvent.type(valor(), "49,90");
    await userEvent.type(screen.getByLabelText("Descrição"), "Netflix");
    await escolherCategoria("Assinaturas");
    await userEvent.clear(screen.getByLabelText("Dia do mês"));
    await userEvent.type(screen.getByLabelText("Dia do mês"), "15");
    await userEvent.click(screen.getByRole("button", { name: "Salvar recorrência" }));
    expect(onSalvar).toHaveBeenCalledWith(
      {
        tipo: "saida", valor: 49.9, descricao: "Netflix", categoria: "Assinaturas",
        frequencia: "mensal", ativo: true, dia_semana: undefined, dia_mes: 15,
      },
      []
    );
  });

  it("entrada semanal: a categoria volta para a primeira de entrada e grava o dia da semana", async () => {
    const { onSalvar } = abrir();
    await userEvent.click(screen.getByRole("button", { name: /Entrada/ }));
    await userEvent.type(valor(), "130");
    await userEvent.type(screen.getByLabelText("Descrição"), "Mesada");
    await userEvent.click(screen.getByRole("button", { name: /Semanal/ }));
    await escolherDiaDaSemana("Sexta", 5);
    await userEvent.click(screen.getByRole("button", { name: "Salvar recorrência" }));
    expect(onSalvar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "entrada", categoria: "Salário", frequencia: "semanal", dia_semana: 5, dia_mes: undefined }),
      []
    );
  });

  it("não salva com dia do mês fora de 1 a 31, nem sem descrição", async () => {
    const { onSalvar } = abrir();
    await userEvent.type(valor(), "10");
    await userEvent.clear(screen.getByLabelText("Dia do mês"));
    await userEvent.type(screen.getByLabelText("Dia do mês"), "32");
    await userEvent.click(screen.getByRole("button", { name: "Salvar recorrência" }));
    expect(onSalvar).not.toHaveBeenCalled();
    expect(screen.getByText("Dia do mês deve ser entre 1 e 31.")).toBeInTheDocument();
    expect(screen.getByText("Descrição obrigatória (mínimo 3 caracteres).")).toBeInTheDocument();
  });

  it("conta já lançada à mão no mês: avisa e, marcado, pula aquele mês", async () => {
    const manual: Lancamento = {
      id: "m1", user_id: "u", tipo: "saida", valor: 49.9, descricao: "Netflix", categoria: "Assinaturas",
      mes: 10, ano: 2026, data: "2026-11-03", created_at: "2026-11-03T10:00:00Z",
    };
    const { onSalvar } = abrir({ mesAlvo: { mes: 10, ano: 2026, nome: "Novembro", lancamentos: [manual] } });
    await userEvent.type(valor(), "49,90");
    await userEvent.type(screen.getByLabelText("Descrição"), "Netflix");
    await userEvent.clear(screen.getByLabelText("Dia do mês"));
    await userEvent.type(screen.getByLabelText("Dia do mês"), "15");
    expect(screen.getByText(/lançado à mão/)).toBeInTheDocument();
    const pular = screen.getByRole("checkbox", { name: /Não gerar em Novembro/ });
    expect(pular).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Salvar recorrência" }));
    expect(onSalvar).toHaveBeenLastCalledWith(expect.objectContaining({ descricao: "Netflix" }), ["2026-11-15"]);

    await userEvent.click(pular);
    await userEvent.click(screen.getByRole("button", { name: "Salvar recorrência" }));
    expect(onSalvar).toHaveBeenLastCalledWith(expect.objectContaining({ descricao: "Netflix" }), []);
  });

  // Com o Salvar fixo no rodapé, um aviso no fim da folha podia nunca ser
  // visto: ele aparece logo abaixo da descrição, antes das categorias.
  it("o aviso de conta já lançada fica antes das categorias", async () => {
    const manual: Lancamento = {
      id: "m1", user_id: "u", tipo: "saida", valor: 49.9, descricao: "Netflix", categoria: "Assinaturas",
      mes: 10, ano: 2026, data: "2026-11-03", created_at: "2026-11-03T10:00:00Z",
    };
    abrir({ mesAlvo: { mes: 10, ano: 2026, nome: "Novembro", lancamentos: [manual] } });
    await userEvent.type(screen.getByLabelText("Descrição"), "Netflix");
    const aviso = screen.getByText(/lançado à mão/);
    const categorias = screen.getByText("Categoria");
    expect(aviso.compareDocumentPosition(categorias) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("editando: vem preenchida, mantém o ativo e salva como alteração", async () => {
    const rec: Recorrencia = {
      id: "r1", user_id: "u", tipo: "saida", valor: 120, descricao: "Internet", categoria: "Casa",
      frequencia: "mensal", dia_mes: 10, ativo: false, created_at: "2026-01-01T00:00:00Z",
    };
    const { onSalvar } = abrir({ recorrenciaParaEditar: rec });
    expect(screen.getByRole("heading", { name: "Editar recorrência" })).toBeInTheDocument();
    expect(screen.getByLabelText("Descrição")).toHaveValue("Internet");
    expect(screen.getByLabelText("Dia do mês")).toHaveValue(10);
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(onSalvar).toHaveBeenCalledWith(
      { tipo: "saida", valor: 120, descricao: "Internet", categoria: "Casa", frequencia: "mensal", ativo: false, dia_semana: undefined, dia_mes: 10 },
      []
    );
  });

  it("fecha pelo X", async () => {
    const { onFechar } = abrir();
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onFechar).toHaveBeenCalledTimes(1);
  });
});
