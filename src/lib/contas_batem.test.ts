import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calcularPendentes,
  calcularSaldoAcumulado,
  calcularSaldoProjetado,
  mesmoDiaNoMes,
  somarPorTipo,
  filtrarPorMes,
} from "./calculos";
import type { Lancamento } from "../types";

// Auditoria das contas: o card do saldo mostra quatro números lado a lado
// (saldo atual, a receber, a pagar e o projetado) e o usuário lê os quatro
// como uma soma. Se eles não fecharem, o app está mentindo mesmo que cada
// função esteja "certa" isoladamente.

function lanc(
  id: string,
  tipo: "entrada" | "saida",
  valor: number,
  data: string,
  descricao = "x"
): Lancamento {
  return {
    id,
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

/** O que o card mostra: os quatro números têm que fechar como uma soma. */
function cardFecha(lancamentos: Lancamento[], mes: number, ano: number) {
  const saldoAtual = calcularSaldoAcumulado(lancamentos, mes, ano);
  const pendentes = calcularPendentes(lancamentos, mes, ano);
  const projetado = calcularSaldoProjetado(lancamentos, mes, ano);
  const somaDoCard =
    saldoAtual + pendentes.entradas.total - pendentes.saidas.total;
  return { saldoAtual, pendentes, projetado, somaDoCard };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 8, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("o mês real: mãe, pai, salário e cartão", () => {
  // 8 de setembro. O que já caiu e o que ainda vai cair.
  const mes = [
    lanc("1", "entrada", 6000, "2026-09-05", "Mãe"),
    lanc("2", "saida", 1200, "2026-09-05", "Empréstimo"),
    lanc("3", "saida", 2400, "2026-09-05", "Fatura do cartão"),
    lanc("4", "entrada", 3000, "2026-09-05", "Salário"),
    lanc("5", "entrada", 500, "2026-09-04", "Mesada do pai"),
    // ainda por vir
    lanc("6", "entrada", 500, "2026-09-11", "Mesada do pai"),
    lanc("7", "entrada", 500, "2026-09-18", "Mesada do pai"),
    lanc("8", "entrada", 500, "2026-09-25", "Mesada do pai"),
    lanc("9", "saida", 150, "2026-09-10", "Estacionamento"),
  ];

  it("renda e gastos contam só o que já caiu", () => {
    const doMes = filtrarPorMes(mes, 8, 2026);
    expect(somarPorTipo(doMes, "entrada")).toBe(9500);
    expect(somarPorTipo(doMes, "saida")).toBe(3600);
  });

  it("os quatro números do card fecham", () => {
    const { saldoAtual, pendentes, projetado, somaDoCard } = cardFecha(
      mes,
      8,
      2026
    );
    expect(saldoAtual).toBe(5900);
    expect(pendentes.entradas).toEqual({ total: 1500, quantidade: 3 });
    expect(pendentes.saidas).toEqual({ total: 150, quantidade: 1 });
    expect(projetado).toBe(7250);
    expect(somaDoCard).toBe(projetado);
  });
});

describe("olhando um mês futuro — o planejamento do mês que vem", () => {
  // É o que ele faz todo começo de mês: já deixa outubro lançado para ver o
  // saldo projetado. Setembro ainda tem coisa por cair quando isso acontece.
  const lancamentos = [
    lanc("1", "entrada", 6000, "2026-09-05", "Mãe"),
    lanc("2", "saida", 100, "2026-09-05", "Mercado"),
    // setembro, ainda por cair
    lanc("3", "saida", 150, "2026-09-20", "Estacionamento"),
    // outubro, planejado
    lanc("4", "entrada", 6000, "2026-10-05", "Mãe"),
    lanc("5", "saida", 1900, "2026-10-05", "Cartão"),
  ];

  it("o projetado de outubro engole setembro inteiro", () => {
    // 5900 (já caiu) − 150 (setembro por cair) + 6000 − 1900 (outubro)
    expect(calcularSaldoProjetado(lancamentos, 9, 2026)).toBe(9850);
  });

  it("os quatro números do card fecham também em outubro", () => {
    const { saldoAtual, pendentes, projetado, somaDoCard } = cardFecha(
      lancamentos,
      9,
      2026
    );
    expect(saldoAtual).toBe(5900);
    expect(projetado).toBe(9850);
    // Sem contar o que sobrou de setembro, o card soma 10.000 e mostra 9.850.
    expect(somaDoCard).toBe(projetado);
    expect(pendentes.saidas.total).toBe(2050);
  });
});

describe("mesmoDiaNoMes — a data que o Repetir usa", () => {
  it("encolhe o dia que não existe no mês de destino", () => {
    expect(mesmoDiaNoMes("2026-01-31", 1, 2026)).toBe("2026-02-28");
    expect(mesmoDiaNoMes("2028-01-31", 1, 2028)).toBe("2028-02-29");
    expect(mesmoDiaNoMes("2026-10-31", 10, 2026)).toBe("2026-11-30");
  });

  it("mantém o dia quando ele existe", () => {
    expect(mesmoDiaNoMes("2026-08-05", 8, 2026)).toBe("2026-09-05");
  });

  it("a competência do destino combina com a data gerada", () => {
    // O Repetir grava mes/ano por fora; se a data discordar, o lançamento some
    // da lista do mês em que foi gravado.
    for (const dia of ["01", "15", "28", "31"]) {
      const data = mesmoDiaNoMes(`2026-01-${dia}`, 1, 2026);
      expect(Number(data.slice(5, 7)) - 1).toBe(1);
      expect(Number(data.slice(0, 4))).toBe(2026);
    }
  });
});

describe("a invariante do card, varrida", () => {
  // Não adianta acertar dois cenários à mão: a regra é que, para qualquer
  // conjunto de lançamentos e qualquer mês visitado,
  //
  //   projetado = saldo atual + a receber − a pagar
  //
  // Se essa igualdade quebrar, o usuário vê quatro números que não somam e
  // não tem como descobrir qual está errado.
  const universo: Lancamento[] = [
    lanc("a", "entrada", 6000, "2026-07-05"),
    lanc("b", "saida", 1200, "2026-07-05"),
    lanc("c", "entrada", 3000, "2026-08-05"),
    lanc("d", "saida", 2400, "2026-08-28"),
    lanc("e", "entrada", 500, "2026-09-04"),
    lanc("f", "saida", 150, "2026-09-10"),
    lanc("g", "entrada", 500, "2026-09-25"),
    lanc("h", "entrada", 6000, "2026-10-05"),
    lanc("i", "saida", 1900, "2026-10-05"),
    lanc("j", "saida", 89.9, "2026-11-15"),
    lanc("k", "entrada", 3000, "2026-12-05"),
    // lançamento antigo, sem data, de antes da coluna existir
    { ...lanc("l", "saida", 40, "2026-07-15"), data: null },
  ];

  // Todo subconjunto contíguo do universo, visto de todo mês do ano.
  for (let corte = 1; corte <= universo.length; corte++) {
    const conjunto = universo.slice(0, corte);
    for (let mes = 6; mes <= 11; mes++) {
      it(`fecha com ${corte} lançamentos, olhando o mês ${mes}`, () => {
        const { projetado, somaDoCard } = cardFecha(conjunto, mes, 2026);
        expect(somaDoCard).toBeCloseTo(projetado, 10);
      });
    }
  }
});

describe("lançamento sem data não vira pendente", () => {
  it("conta como já caído, que é como o resto do app o trata", () => {
    const antigo: Lancamento = {
      ...lanc("1", "saida", 40, "2026-09-15"),
      data: null,
    };
    const p = calcularPendentes([antigo], 8, 2026);
    expect(p.saidas.quantidade).toBe(0);
    expect(calcularSaldoAcumulado([antigo], 8, 2026)).toBe(-40);
  });
});
