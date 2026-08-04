import { describe, it, expect } from "vitest";
import { podeGerarNaCompetencia } from "./recorrencias";

// Recorrência criada em 04/08/2026, 18h no horário de Brasília (21h UTC).
const CRIADA_EM = "2026-08-04T21:14:21.065613+00:00";
const HOJE = { mes: 7, ano: 2026 }; // agosto/2026

describe("podeGerarNaCompetencia", () => {
  it("gera no mês corrente", () => {
    expect(podeGerarNaCompetencia(CRIADA_EM, { mes: 7, ano: 2026 }, HOJE)).toBe(
      true
    );
  });

  it("gera em meses futuros", () => {
    expect(podeGerarNaCompetencia(CRIADA_EM, { mes: 8, ano: 2026 }, HOJE)).toBe(
      true
    );
    expect(podeGerarNaCompetencia(CRIADA_EM, { mes: 0, ano: 2027 }, HOJE)).toBe(
      true
    );
  });

  // O bug que inflava o saldo acumulado: navegar para trás no MonthPicker
  // materializava as ocorrências no mês já fechado, e o saldo de julho passava
  // a ser maior que o de agosto.
  it("não gera no mês anterior ao corrente", () => {
    expect(podeGerarNaCompetencia(CRIADA_EM, { mes: 6, ano: 2026 }, HOJE)).toBe(
      false
    );
  });

  it("não gera em anos anteriores", () => {
    expect(
      podeGerarNaCompetencia(CRIADA_EM, { mes: 11, ano: 2025 }, HOJE)
    ).toBe(false);
  });

  it("não gera antes do mês de criação, mesmo que o mês já tenha chegado", () => {
    // Recorrência criada em outubro, navegando para setembro em dezembro:
    // setembro não é passado em relação a nada além de hoje, mas é anterior
    // à existência da regra.
    const criadaEmOutubro = "2026-10-10T12:00:00+00:00";
    const dezembro = { mes: 11, ano: 2026 };
    expect(
      podeGerarNaCompetencia(criadaEmOutubro, { mes: 8, ano: 2026 }, dezembro)
    ).toBe(false);
  });

  it("gera no próprio mês de criação", () => {
    expect(podeGerarNaCompetencia(CRIADA_EM, { mes: 7, ano: 2026 }, HOJE)).toBe(
      true
    );
  });
});
