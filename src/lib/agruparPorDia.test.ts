import { describe, expect, it } from "vitest";
import { agruparPorDia, rotuloCurto } from "./agruparPorDia";
import type { Lancamento } from "../types";

const l = (id: string, tipo: "entrada" | "saida", valor: number, data: string | null, created = "2026-11-01T10:00:00Z"): Lancamento => ({
  id, user_id: "u", tipo, valor, descricao: id, categoria: "Outros", mes: 10, ano: 2026, data, created_at: created,
});
const HOJE = "2026-11-06";

describe("agruparPorDia", () => {
  it("agendados no topo (do mais próximo), depois Hoje, Ontem e os dias por extenso", () => {
    const grupos = agruparPorDia([
      l("cartao", "saida", 4715.47, "2026-11-10"),
      l("mesada", "entrada", 6750, "2026-11-08"),
      l("uber", "saida", 23.9, "2026-11-06"),
      l("mercado", "saida", 152.4, "2026-11-06"),
      l("farmacia", "saida", 48.7, "2026-11-05"),
      l("netflix", "saida", 55.9, "2026-11-04"),
    ], HOJE);
    expect(grupos.map((g) => g.rotulo)).toEqual(["Agendados", "Hoje", "Ontem", "Qua, 4 nov"]);
    expect(grupos[0].itens.map((i) => i.id)).toEqual(["mesada", "cartao"]);
    expect(grupos[0].futuro).toBe(true);
  });

  it("total do dia: entradas somam, saídas subtraem, em centavos exatos", () => {
    const [hoje] = agruparPorDia([
      l("a", "entrada", 0.1, HOJE), l("b", "entrada", 0.2, HOJE), l("c", "saida", 0.3, HOJE),
    ], HOJE);
    expect(hoje.total).toBe(0); // 0,1 + 0,2 − 0,3 em ponto flutuante dá 5,5e-17
    const [g] = agruparPorDia([l("x", "entrada", 130, HOJE), l("y", "saida", 48.7, HOJE)], HOJE);
    expect(g.total).toBe(81.3);
  });

  it("sem data, vale o dia em que foi criado — nunca é agendado", () => {
    const grupos = agruparPorDia([l("antigo", "saida", 10, null, "2026-11-02T15:00:00Z")], HOJE);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].rotulo).toBe("Seg, 2 nov");
    expect(grupos[0].futuro).toBe(false);
  });

  it("virada de mês e de ano no Ontem", () => {
    expect(agruparPorDia([l("a", "saida", 1, "2026-10-31")], "2026-11-01")[0].rotulo).toBe("Ontem");
    expect(agruparPorDia([l("a", "saida", 1, "2025-12-31")], "2026-01-01")[0].rotulo).toBe("Ontem");
  });

  it("rótulo curto", () => {
    expect(rotuloCurto("2026-11-08")).toBe("Dom, 8 nov");
    expect(rotuloCurto("2026-03-14")).toBe("Sáb, 14 mar");
  });

  // Nenhum lançamento pode sumir, se repetir ou cair no dia errado, e a soma
  // dos totais dos grupos tem que ser a soma do mês.
  it("milhares de listas sorteadas: cada lançamento aparece uma vez, no dia certo", () => {
    let semente = 42;
    const sortear = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let rodada = 0; rodada < 2000; rodada++) {
      const n = Math.floor(sortear() * 25);
      const lista: Lancamento[] = [];
      for (let i = 0; i < n; i++) {
        const dia = 1 + Math.floor(sortear() * 30);
        const semData = sortear() < 0.1;
        const data = `2026-11-${String(dia).padStart(2, "0")}`;
        lista.push(l(`id${i}`, sortear() < 0.4 ? "entrada" : "saida", Math.round(sortear() * 100000) / 100,
          semData ? null : data, `${data}T${String(Math.floor(sortear() * 24)).padStart(2, "0")}:00:00Z`));
      }
      const grupos = agruparPorDia(lista, HOJE);
      const ids = grupos.flatMap((g) => g.itens.map((i) => i.id));
      expect(ids.slice().sort()).toEqual(lista.map((i) => i.id).sort());
      for (const g of grupos) {
        for (const item of g.itens) {
          const dia = item.data ?? item.created_at.slice(0, 10);
          if (g.futuro) expect(item.data! > HOJE).toBe(true);
          else expect(dia).toBe(g.chave);
        }
      }
      const somaGrupos = Math.round(grupos.reduce((s, g) => s + g.total, 0) * 100);
      const somaLista = lista.reduce((s, i) => s + Math.round(i.valor * 100) * (i.tipo === "entrada" ? 1 : -1), 0);
      expect(somaGrupos).toBe(somaLista);
      expect(new Set(grupos.map((g) => g.chave)).size).toBe(grupos.length);
    }
  });
});
