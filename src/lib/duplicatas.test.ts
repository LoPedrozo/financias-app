import { describe, expect, it } from "vitest";
import {
  chaveDaConta,
  chaveExata,
  conjuntoDeContas,
  conjuntoExato,
} from "./duplicatas";
import type { Lancamento } from "../types";

function lanc(
  descricao: string,
  valor: number,
  data: string,
  tipo: "entrada" | "saida" = "saida"
): Lancamento {
  return {
    id: Math.random().toString(),
    user_id: "u",
    tipo,
    valor,
    descricao,
    categoria: "Outros",
    mes: Number(data.slice(5, 7)) - 1,
    ano: Number(data.slice(0, 4)),
    data,
    created_at: `${data}T10:00:00Z`,
  };
}

describe("chaveExata", () => {
  it("ignora acento e caixa na descrição", () => {
    expect(chaveExata(lanc("Almoço", 25, "2026-09-08"))).toBe(
      chaveExata(lanc("almoco", 25, "2026-09-08"))
    );
  });

  it("separa por valor", () => {
    expect(chaveExata(lanc("Almoço", 25, "2026-09-08"))).not.toBe(
      chaveExata(lanc("Almoço", 30, "2026-09-08"))
    );
  });

  it("separa por data — o mesmo almoço em dois dias são dois almoços", () => {
    expect(chaveExata(lanc("Almoço", 25, "2026-09-08"))).not.toBe(
      chaveExata(lanc("Almoço", 25, "2026-09-09"))
    );
  });

  it("separa por tipo", () => {
    expect(chaveExata(lanc("Pix", 100, "2026-09-08", "entrada"))).not.toBe(
      chaveExata(lanc("Pix", 100, "2026-09-08", "saida"))
    );
  });

  it("25 e 25,00 são o mesmo lançamento", () => {
    expect(chaveExata(lanc("Almoço", 25, "2026-09-08"))).toBe(
      chaveExata(lanc("Almoço", 25.0, "2026-09-08"))
    );
  });
});

describe("chaveDaConta", () => {
  it("a mesma conta com valor diferente continua a mesma conta", () => {
    expect(chaveDaConta(lanc("Conta de luz", 180, "2026-08-10"))).toBe(
      chaveDaConta(lanc("conta de luz", 210, "2026-09-10"))
    );
  });
});

describe("reconhecer uma lista recolada", () => {
  const jaLancado = [
    lanc("Cartão de crédito", 1900, "2026-10-05"),
    lanc("Empréstimo", 2800, "2026-10-05"),
  ];

  it("pega a leva inteira quando ela é colada de novo", () => {
    const existentes = conjuntoExato(jaLancado);
    const recolada = [
      { tipo: "saida" as const, descricao: "Cartão de crédito", valor: 1900, data: "2026-10-05" },
      { tipo: "saida" as const, descricao: "Empréstimo", valor: 2800, data: "2026-10-05" },
      { tipo: "saida" as const, descricao: "Estacionamento", valor: 150, data: "2026-10-05" },
    ];
    const repetidas = recolada.filter((l) => existentes.has(chaveExata(l)));
    expect(repetidas.map((l) => l.descricao)).toEqual([
      "Cartão de crédito",
      "Empréstimo",
    ]);
  });

  it("não confunde a mesma conta em meses diferentes", () => {
    const existentes = conjuntoExato(jaLancado);
    const novembro = {
      tipo: "saida" as const,
      descricao: "Cartão de crédito",
      valor: 1900,
      data: "2026-11-05",
    };
    expect(existentes.has(chaveExata(novembro))).toBe(false);
  });
});

describe("reconhecer o que o Repetir já trouxe", () => {
  it("o mês de destino barra a conta mesmo com o valor ajustado", () => {
    const destino = conjuntoDeContas([lanc("Internet", 120, "2026-09-12")]);
    const origem = lanc("internet", 135, "2026-08-12");
    expect(destino.has(chaveDaConta(origem))).toBe(true);
  });
});
