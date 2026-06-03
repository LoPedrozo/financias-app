import { describe, it, expect } from "vitest";
import {
  filtrarPorMes,
  somarPorTipo,
  calcularSaldoAcumulado,
  calcularPendentes,
  calcularSaldoProjetado,
  agruparPorCategoria,
  calcularBalancoAnual,
  hojeLocal,
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

describe("filtro de futuros nas demais funções de soma", () => {
  const amanha = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const ontem = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();

  it("somarPorTipo ignora lançamentos futuros", () => {
    const dados = [
      l({ tipo: "entrada", valor: 100, mes: mesAtual, ano: anoAtual, data: ontem }),
      l({ tipo: "entrada", valor: 9999, mes: mesAtual, ano: anoAtual, data: amanha }),
      l({ tipo: "saida", valor: 50, mes: mesAtual, ano: anoAtual, data: ontem }),
      l({ tipo: "saida", valor: 8888, mes: mesAtual, ano: anoAtual, data: amanha }),
    ];
    expect(somarPorTipo(dados, "entrada")).toBe(100);
    expect(somarPorTipo(dados, "saida")).toBe(50);
  });

  it("agruparPorCategoria ignora lançamentos futuros", () => {
    const dados = [
      l({
        tipo: "saida", valor: 30, mes: mesAtual, ano: anoAtual,
        data: ontem, categoria: "Alimentação",
      }),
      l({
        tipo: "saida", valor: 9999, mes: mesAtual, ano: anoAtual,
        data: amanha, categoria: "Alimentação",
      }),
    ];
    const r = agruparPorCategoria(dados, "saida", categoriasSaida);
    expect(r).toHaveLength(1);
    expect(r[0].value).toBe(30);
  });

  it("calcularBalancoAnual ignora lançamentos futuros do mês atual", () => {
    const dados = [
      l({ tipo: "entrada", valor: 200, mes: mesAtual, ano: anoAtual, data: ontem }),
      l({ tipo: "entrada", valor: 9999, mes: mesAtual, ano: anoAtual, data: amanha }),
    ];
    const r = calcularBalancoAnual(dados, anoAtual, MESES);
    expect(r[mesAtual].sobra).toBe(200);
  });
});

describe("calcularSaldoAcumulado — lançamentos futuros (com data)", () => {
  const hoje = hojeLocal();
  const ontem = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const amanha = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();

  it("contabiliza lançamento com data de hoje", () => {
    const dados = [
      l({ tipo: "entrada", valor: 100, mes: mesAtual, ano: anoAtual, data: hoje }),
    ];
    expect(calcularSaldoAcumulado(dados, mesAtual, anoAtual)).toBe(100);
  });

  it("contabiliza lançamento com data de ontem", () => {
    const dados = [
      l({ tipo: "entrada", valor: 100, mes: mesAtual, ano: anoAtual, data: ontem }),
    ];
    expect(calcularSaldoAcumulado(dados, mesAtual, anoAtual)).toBe(100);
  });

  it("não contabiliza lançamento com data de amanhã", () => {
    const dados = [
      l({ tipo: "entrada", valor: 100, mes: mesAtual, ano: anoAtual, data: amanha }),
    ];
    expect(calcularSaldoAcumulado(dados, mesAtual, anoAtual)).toBe(0);
  });

  it("contabiliza lançamento legado sem data", () => {
    const dados = [
      l({ tipo: "entrada", valor: 100, mes: mesAtual, ano: anoAtual, data: null }),
    ];
    expect(calcularSaldoAcumulado(dados, mesAtual, anoAtual)).toBe(100);
  });
});

describe("calcularPendentes", () => {
  const amanha = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const ontem = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();

  it("separa entradas e saídas futuras do mês", () => {
    const dados = [
      l({ tipo: "entrada", valor: 500, mes: mesAtual, ano: anoAtual, data: amanha }),
      l({ tipo: "entrada", valor: 300, mes: mesAtual, ano: anoAtual, data: amanha }),
      l({ tipo: "saida", valor: 100, mes: mesAtual, ano: anoAtual, data: amanha }),
      l({ tipo: "entrada", valor: 999, mes: mesAtual, ano: anoAtual, data: ontem }),
    ];
    const r = calcularPendentes(dados, mesAtual, anoAtual);
    expect(r.entradas).toEqual({ total: 800, quantidade: 2 });
    expect(r.saidas).toEqual({ total: 100, quantidade: 1 });
  });

  it("considera apenas entradas futuras quando não há saídas", () => {
    const dados = [
      l({ tipo: "entrada", valor: 500, mes: mesAtual, ano: anoAtual, data: amanha }),
    ];
    const r = calcularPendentes(dados, mesAtual, anoAtual);
    expect(r.entradas).toEqual({ total: 500, quantidade: 1 });
    expect(r.saidas).toEqual({ total: 0, quantidade: 0 });
  });

  it("considera apenas saídas futuras quando não há entradas", () => {
    const dados = [
      l({ tipo: "saida", valor: 250, mes: mesAtual, ano: anoAtual, data: amanha }),
    ];
    const r = calcularPendentes(dados, mesAtual, anoAtual);
    expect(r.entradas).toEqual({ total: 0, quantidade: 0 });
    expect(r.saidas).toEqual({ total: 250, quantidade: 1 });
  });

  it("retorna zero quando não há futuros", () => {
    const dados = [
      l({ tipo: "entrada", valor: 100, mes: mesAtual, ano: anoAtual, data: ontem }),
      l({ tipo: "entrada", valor: 200, mes: mesAtual, ano: anoAtual, data: null }),
    ];
    expect(calcularPendentes(dados, mesAtual, anoAtual)).toEqual({
      entradas: { total: 0, quantidade: 0 },
      saidas: { total: 0, quantidade: 0 },
    });
  });

  it("ignora futuros de outro mês", () => {
    const outroMes = mesAtual === 0 ? 11 : mesAtual - 1;
    const outroAno = mesAtual === 0 ? anoAtual - 1 : anoAtual;
    const dados = [
      l({ tipo: "entrada", valor: 500, mes: outroMes, ano: outroAno, data: amanha }),
    ];
    const r = calcularPendentes(dados, mesAtual, anoAtual);
    expect(r.entradas.quantidade).toBe(0);
    expect(r.saidas.quantidade).toBe(0);
  });
});

describe("calcularSaldoProjetado", () => {
  it("soma entradas pendentes e subtrai saídas pendentes do saldo atual", () => {
    const r = calcularSaldoProjetado(685, {
      entradas: { total: 4440 },
      saidas: { total: 3650 },
    });
    expect(r).toBe(1475);
  });

  it("retorna o próprio saldo quando não há pendentes", () => {
    const r = calcularSaldoProjetado(1000, {
      entradas: { total: 0 },
      saidas: { total: 0 },
    });
    expect(r).toBe(1000);
  });

  it("retorna saldo projetado negativo quando saídas pendentes superam saldo + entradas", () => {
    const r = calcularSaldoProjetado(100, {
      entradas: { total: 50 },
      saidas: { total: 500 },
    });
    expect(r).toBe(-350);
  });
});

describe("hojeLocal", () => {
  it("retorna a data local mesmo quando UTC já virou o dia (Brasil UTC-3 às 23:30)", () => {
    // Cenário: usuário no Brasil (UTC-3) lança às 23:30 do dia 15/05/2026.
    // Em UTC, esse mesmo instante é 16/05/2026 02:30 — toISOString() retorna "2026-05-16".
    // hojeLocal() deve retornar "2026-05-15".
    const DateOriginal = globalThis.Date;
    class DateMock extends DateOriginal {
      constructor() {
        super(DateOriginal.UTC(2026, 4, 16, 2, 30, 0));
      }
      getFullYear() {
        return 2026;
      }
      getMonth() {
        return 4;
      }
      getDate() {
        return 15;
      }
    }
    globalThis.Date = DateMock as DateConstructor;

    try {
      // Sanity check: a abordagem antiga retornaria o dia errado.
      expect(new Date().toISOString().slice(0, 10)).toBe("2026-05-16");
      // hojeLocal retorna o dia local correto.
      expect(hojeLocal()).toBe("2026-05-15");
    } finally {
      globalThis.Date = DateOriginal;
    }
  });
});
