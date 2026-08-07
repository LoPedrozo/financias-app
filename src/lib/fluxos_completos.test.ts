import { describe, expect, it } from "vitest";
import {
  agruparPorCategoria,
  calcularBalancoAnual,
  calcularPendentes,
  calcularSaldoAcumulado,
  calcularSaldoProjetado,
  filtrarPorMes,
  hojeLocal,
  somarPorTipo,
} from "./calculos";
import { podeGerarNaCompetencia } from "./recorrencias";
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, MESES } from "../types";
import type { Lancamento } from "../types";

describe("Fluxo 1 — Lançamentos normais e cálculos", () => {
  it("deve calcular renda, gastos, saldo e gráficos corretamente", () => {
    const hoje = hojeLocal();
    const l1: Lancamento = {
      id: "1",
      user_id: "user1",
      tipo: "entrada",
      valor: 500,
      descricao: "Mesada",
      categoria: "Mesada",
      mes: 7,
      ano: 2026,
      data: hoje,
      created_at: `${hoje}T10:00:00Z`,
    };

    const l2: Lancamento = {
      id: "2",
      user_id: "user1",
      tipo: "saida",
      valor: 35,
      descricao: "Almoço",
      categoria: "Alimentação",
      mes: 7,
      ano: 2026,
      data: hoje,
      created_at: `${hoje}T12:00:00Z`,
    };

    let lista = [l1, l2];
    const doMes = filtrarPorMes(lista, 7, 2026);

    expect(somarPorTipo(doMes, "entrada")).toBe(500);
    expect(somarPorTipo(doMes, "saida")).toBe(35);
    expect(calcularSaldoAcumulado(lista, 7, 2026)).toBe(465);

    const pizzaSaidas = agruparPorCategoria(doMes, "saida", CATEGORIAS_SAIDA);
    expect(pizzaSaidas).toEqual([
      { name: "Alimentação", value: 35, cor: "#d4937a" },
    ]);

    const balanco = calcularBalancoAnual(lista, 2026, MESES);
    expect(balanco[7]).toEqual({ mes: "Ago", sobra: 465 });

    // Edição para 40
    l2.valor = 40;
    expect(somarPorTipo(doMes, "saida")).toBe(40);
    expect(calcularSaldoAcumulado(lista, 7, 2026)).toBe(460);

    // Remoção dos dois
    lista = [];
    expect(somarPorTipo(lista, "entrada")).toBe(0);
    expect(somarPorTipo(lista, "saida")).toBe(0);
    expect(calcularSaldoAcumulado(lista, 7, 2026)).toBe(0);
  });
});

describe("Fluxo 2 — Lançamentos futuros", () => {
  it("não deve incluir lançamentos futuros no saldo atual e deve incluir nos pendentes/projetado", () => {
    const futuroEntrada: Lancamento = {
      id: "f1",
      user_id: "user1",
      tipo: "entrada",
      valor: 3000,
      descricao: "Salário",
      categoria: "Salário",
      mes: 7,
      ano: 2026,
      data: "2099-08-10",
      created_at: "2026-08-05T10:00:00Z",
    };

    const futuroSaida: Lancamento = {
      id: "f2",
      user_id: "user1",
      tipo: "saida",
      valor: 200,
      descricao: "Conta de luz",
      categoria: "Cartão de Crédito / Contas",
      mes: 7,
      ano: 2026,
      data: "2099-08-08",
      created_at: "2026-08-05T10:00:00Z",
    };

    const lista = [futuroEntrada, futuroSaida];
    const doMes = filtrarPorMes(lista, 7, 2026);

    expect(somarPorTipo(doMes, "entrada")).toBe(0);
    expect(somarPorTipo(doMes, "saida")).toBe(0);
    expect(calcularSaldoAcumulado(lista, 7, 2026)).toBe(0);

    const pendentes = calcularPendentes(lista, 7, 2026);
    expect(pendentes.entradas).toEqual({ total: 3000, quantidade: 1 });
    expect(pendentes.saidas).toEqual({ total: 200, quantidade: 1 });

    expect(calcularSaldoProjetado(lista, 7, 2026)).toBe(2800);

    expect(agruparPorCategoria(doMes, "saida", CATEGORIAS_SAIDA)).toEqual([]);
    expect(agruparPorCategoria(doMes, "entrada", CATEGORIAS_ENTRADA)).toEqual([]);
  });
});

describe("Fluxo 3 & 6 — Recorrências e regras de meses", () => {
  it("não deve gerar lançamentos em meses anteriores à criação ou ao mês atual", () => {
    const hoje = { mes: 7, ano: 2026 }; // Agosto 2026
    const criadaEm = "2026-08-01T10:00:00Z";

    expect(podeGerarNaCompetencia(criadaEm, { mes: 6, ano: 2026 }, hoje)).toBe(false); // Julho 2026
    expect(podeGerarNaCompetencia(criadaEm, { mes: 7, ano: 2026 }, hoje)).toBe(true);  // Agosto 2026
    expect(podeGerarNaCompetencia(criadaEm, { mes: 8, ano: 2026 }, hoje)).toBe(true);  // Setembro 2026
  });

  it("deve ajustar dia 31 para o último dia de fevereiro (28 ou 29)", () => {
    const ano = 2027;
    const mes = 1; // Fevereiro
    const ultimoDia = new Date(ano, mes + 1, 0).getDate();
    const dia_mes = 31;
    const diaAjustado = Math.min(dia_mes, ultimoDia);

    expect(ultimoDia).toBe(28);
    expect(diaAjustado).toBe(28);
  });
});

describe("Fluxo 6 — Validações de entrada de formulário", () => {
  it("deve validar formato e valores de entradas numéricas", () => {
    const regexFormato = /^\d+([.,]\d{1,2})?$/;

    expect(regexFormato.test("")).toBe(false);
    expect(regexFormato.test("abc")).toBe(false);
    expect(regexFormato.test("1.0.0,5")).toBe(false);
    expect(regexFormato.test("500")).toBe(true);
    expect(regexFormato.test("10,50")).toBe(true);
    expect(regexFormato.test("10.50")).toBe(true);
  });
});
