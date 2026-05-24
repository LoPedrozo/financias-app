import { describe, it, expect } from "vitest";
import {
  filtrarPorMes,
  somarPorTipo,
  calcularSaldoAcumulado,
  agruparPorCategoria,
  calcularBalancoAnual,
} from "./calculos";
import type { Categoria, Lancamento, Tipo } from "../types";
import { MESES } from "../types";

function l(
  partes: Partial<Lancamento> & {
    tipo: Tipo;
    valor: number;
    mes: number;
    ano: number;
  }
): Lancamento {
  return {
    id: partes.id ?? Math.random().toString(36).slice(2),
    user_id: partes.user_id ?? "u1",
    descricao: partes.descricao ?? "",
    categoria: partes.categoria ?? "Outros",
    data: partes.data ?? null,
    created_at: partes.created_at ?? "2026-01-01T00:00:00Z",
    ...partes,
  };
}

const categoriasSaida: Categoria[] = [
  { nome: "Alimentação", cor: "#a" },
  { nome: "Lazer", cor: "#b" },
  { nome: "Outros", cor: "#c" },
];

const categoriasEntrada: Categoria[] = [
  { nome: "Salário", cor: "#d" },
  { nome: "Freelance", cor: "#e" },
];

describe("filtrarPorMes", () => {
  it("retorna apenas lançamentos do mês/ano informados", () => {
    const dados = [
      l({ tipo: "saida", valor: 10, mes: 3, ano: 2026 }),
      l({ tipo: "saida", valor: 20, mes: 4, ano: 2026 }),
      l({ tipo: "entrada", valor: 30, mes: 3, ano: 2025 }),
    ];
    expect(filtrarPorMes(dados, 3, 2026)).toHaveLength(1);
    expect(filtrarPorMes(dados, 3, 2026)[0].valor).toBe(10);
  });

  it("retorna lista vazia quando não há lançamentos no período", () => {
    expect(filtrarPorMes([], 0, 2026)).toEqual([]);
  });
});

describe("somarPorTipo", () => {
  it("soma apenas lançamentos do tipo informado", () => {
    const dados = [
      l({ tipo: "entrada", valor: 1000, mes: 3, ano: 2026 }),
      l({ tipo: "saida", valor: 200, mes: 3, ano: 2026 }),
      l({ tipo: "saida", valor: 50.5, mes: 3, ano: 2026 }),
    ];
    expect(somarPorTipo(dados, "entrada")).toBe(1000);
    expect(somarPorTipo(dados, "saida")).toBe(250.5);
  });

  it("retorna 0 para lista vazia", () => {
    expect(somarPorTipo([], "entrada")).toBe(0);
    expect(somarPorTipo([], "saida")).toBe(0);
  });

  it("retorna 0 quando não há lançamentos do tipo", () => {
    const dados = [l({ tipo: "saida", valor: 100, mes: 0, ano: 2026 })];
    expect(somarPorTipo(dados, "entrada")).toBe(0);
  });
});

describe("calcularSaldoAcumulado", () => {
  it("acumula entradas e subtrai saídas até o mês/ano informado", () => {
    const dados = [
      l({ tipo: "entrada", valor: 1000, mes: 0, ano: 2026 }),
      l({ tipo: "saida", valor: 300, mes: 0, ano: 2026 }),
      l({ tipo: "entrada", valor: 500, mes: 1, ano: 2026 }),
      l({ tipo: "saida", valor: 100, mes: 1, ano: 2026 }),
    ];
    expect(calcularSaldoAcumulado(dados, 0, 2026)).toBe(700);
    expect(calcularSaldoAcumulado(dados, 1, 2026)).toBe(1100);
  });

  it("inclui anos anteriores integralmente", () => {
    const dados = [
      l({ tipo: "entrada", valor: 200, mes: 11, ano: 2025 }),
      l({ tipo: "saida", valor: 50, mes: 5, ano: 2024 }),
      l({ tipo: "entrada", valor: 100, mes: 0, ano: 2026 }),
    ];
    expect(calcularSaldoAcumulado(dados, 0, 2026)).toBe(250);
  });

  it("ignora lançamentos de meses futuros no mesmo ano", () => {
    const dados = [
      l({ tipo: "entrada", valor: 100, mes: 0, ano: 2026 }),
      l({ tipo: "entrada", valor: 9999, mes: 5, ano: 2026 }),
    ];
    expect(calcularSaldoAcumulado(dados, 0, 2026)).toBe(100);
  });

  it("retorna 0 para lista vazia", () => {
    expect(calcularSaldoAcumulado([], 5, 2026)).toBe(0);
  });
});

describe("agruparPorCategoria", () => {
  it("soma valores por categoria do tipo informado", () => {
    const dados = [
      l({ tipo: "saida", valor: 50, mes: 3, ano: 2026, categoria: "Alimentação" }),
      l({ tipo: "saida", valor: 30, mes: 3, ano: 2026, categoria: "Alimentação" }),
      l({ tipo: "saida", valor: 20, mes: 3, ano: 2026, categoria: "Lazer" }),
      l({ tipo: "entrada", valor: 999, mes: 3, ano: 2026, categoria: "Outros" }),
    ];
    const r = agruparPorCategoria(dados, "saida", categoriasSaida);
    expect(r).toHaveLength(2);
    expect(r.find((c) => c.name === "Alimentação")?.value).toBe(80);
    expect(r.find((c) => c.name === "Lazer")?.value).toBe(20);
  });

  it("omite categorias sem lançamentos", () => {
    const dados = [
      l({ tipo: "saida", valor: 10, mes: 0, ano: 2026, categoria: "Lazer" }),
    ];
    const r = agruparPorCategoria(dados, "saida", categoriasSaida);
    expect(r.map((c) => c.name)).toEqual(["Lazer"]);
  });

  it("preserva a cor da categoria correspondente", () => {
    const dados = [
      l({ tipo: "entrada", valor: 1, mes: 0, ano: 2026, categoria: "Salário" }),
    ];
    const r = agruparPorCategoria(dados, "entrada", categoriasEntrada);
    expect(r[0]).toEqual({ name: "Salário", value: 1, cor: "#d" });
  });

  it("retorna lista vazia para entrada vazia", () => {
    expect(agruparPorCategoria([], "saida", categoriasSaida)).toEqual([]);
  });

  it("ignora categorias não presentes no array de categorias", () => {
    const dados = [
      l({
        tipo: "saida",
        valor: 50,
        mes: 0,
        ano: 2026,
        categoria: "CategoriaInexistente",
      }),
    ];
    expect(agruparPorCategoria(dados, "saida", categoriasSaida)).toEqual([]);
  });
});

describe("calcularBalancoAnual", () => {
  it("retorna 12 entradas, uma por mês, com sobra = entradas - saídas", () => {
    const dados = [
      l({ tipo: "entrada", valor: 1000, mes: 0, ano: 2026 }),
      l({ tipo: "saida", valor: 400, mes: 0, ano: 2026 }),
      l({ tipo: "entrada", valor: 800, mes: 2, ano: 2026 }),
      l({ tipo: "saida", valor: 900, mes: 2, ano: 2026 }),
    ];
    const r = calcularBalancoAnual(dados, 2026, MESES);
    expect(r).toHaveLength(12);
    expect(r[0]).toEqual({ mes: "Jan", sobra: 600 });
    expect(r[1]).toEqual({ mes: "Fev", sobra: 0 });
    expect(r[2]).toEqual({ mes: "Mar", sobra: -100 });
  });

  it("ignora lançamentos de outros anos", () => {
    const dados = [
      l({ tipo: "entrada", valor: 5000, mes: 0, ano: 2025 }),
      l({ tipo: "saida", valor: 100, mes: 0, ano: 2026 }),
    ];
    const r = calcularBalancoAnual(dados, 2026, MESES);
    expect(r[0].sobra).toBe(-100);
  });

  it("retorna todos os meses com sobra 0 para lista vazia", () => {
    const r = calcularBalancoAnual([], 2026, MESES);
    expect(r).toHaveLength(12);
    expect(r.every((m) => m.sobra === 0)).toBe(true);
  });
});
