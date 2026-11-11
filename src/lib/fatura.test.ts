import { describe, expect, it } from "vitest";
import type { Cartao, CompraCartao, FaturaCartao, PrevistoCartao } from "../types";
import {
  cicloDaData,
  cicloSeguinte,
  datasDoPrevisto,
  ehEssencial,
  faturaDoCiclo,
  faturasComoLancamentos,
  metasDaFatura,
  parcelasDaCompra,
  primeiroCiclo,
  somarDias,
} from "./fatura";
import { calcularSaldoProjetado } from "./calculos";

// O cartão do Lorenzo: fecha dia 3, vence dia 10 (Nubank).
const nubank: Cartao = {
  id: "c1", user_id: "u1", nome: "Cartão de crédito", dia_fechamento: 3, dia_vencimento: 10,
  meta_total: 1000, meta_essenciais: 500, inicio: "2026-12-10", created_at: "",
};
let seq = 0;
const compra = (data: string, valor: number, extra: Partial<CompraCartao> = {}): CompraCartao => ({
  id: `k${++seq}`, user_id: "u1", cartao_id: "c1", descricao: "x", valor, categoria: "Alimentação",
  data, parcelas: 1, essencial: null, como: null, created_at: `${data}T12:00:${String(seq % 60).padStart(2, "0")}Z`, ...extra,
});
const previsto = (extra: Partial<PrevistoCartao>): PrevistoCartao => ({
  id: `p${++seq}`, user_id: "u1", cartao_id: "c1", descricao: "Lanche de sexta", valor: 70, categoria: "Lazer",
  frequencia: "semanal", dia_semana: 5, dia_mes: null, essencial: null, ativo: true, created_at: "", ...extra,
});

describe("ciclo da fatura", () => {
  it("fecha 3, vence 10: compra até o dia 2 fica na fatura do mês; no dia 3 já vai para a seguinte", () => {
    expect(cicloDaData("2026-11-02", nubank)).toEqual({ abre: "2026-10-03", fechamento: "2026-11-03", vencimento: "2026-11-10" });
    expect(cicloDaData("2026-11-03", nubank)).toEqual({ abre: "2026-11-03", fechamento: "2026-12-03", vencimento: "2026-12-10" });
    expect(cicloDaData("2026-11-10", nubank)).toEqual({ abre: "2026-11-03", fechamento: "2026-12-03", vencimento: "2026-12-10" });
    expect(cicloDaData("2026-12-31", nubank)).toEqual({ abre: "2026-12-03", fechamento: "2027-01-03", vencimento: "2027-01-10" });
  });

  it("fecha 28, vence 5: o vencimento cai no mês seguinte, e o ano vira", () => {
    const c = { dia_fechamento: 28, dia_vencimento: 5 };
    expect(cicloDaData("2026-11-10", c)).toEqual({ abre: "2026-10-28", fechamento: "2026-11-28", vencimento: "2026-12-05" });
    expect(cicloDaData("2026-12-28", c)).toEqual({ abre: "2026-12-28", fechamento: "2027-01-28", vencimento: "2027-02-05" });
  });

  it("dia que o mês não tem vira o último dia — fevereiro, bissexto e 31", () => {
    const c = { dia_fechamento: 31, dia_vencimento: 8 };
    expect(cicloDaData("2027-02-15", c)).toEqual({ abre: "2027-01-31", fechamento: "2027-02-28", vencimento: "2027-03-08" });
    expect(cicloDaData("2027-02-28", c)).toEqual({ abre: "2027-02-28", fechamento: "2027-03-31", vencimento: "2027-04-08" });
    expect(cicloDaData("2028-02-29", c).fechamento).toBe("2028-03-31");
    expect(cicloDaData("2028-02-28", c).fechamento).toBe("2028-02-29");
    // Vence 31 com fechamento 25: em fevereiro vence no dia 28.
    expect(cicloDaData("2027-02-10", { dia_fechamento: 25, dia_vencimento: 31 }).vencimento).toBe("2027-02-28");
  });

  // Gabarito independente: anda dia a dia e confere que os ciclos cobrem o
  // calendário sem buraco nem sobreposição, para todo par de dias.
  it("todo dia cai em exatamente um ciclo, e os ciclos se emendam (todos os pares de dias, 3 anos)", () => {
    const erros: string[] = [];
    const igual = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);
    for (let f = 1; f <= 31; f++) {
      for (const v of [1, 5, 10, 15, 20, 28, 31]) {
        const cartao = { dia_fechamento: f, dia_vencimento: v };
        let d = "2026-01-01";
        let anterior = cicloDaData(d, cartao);
        for (let i = 0; i < 365 * 3; i++, d = somarDias(d, 1)) {
          const c = cicloDaData(d, cartao);
          const onde = `${d} fecha ${f} vence ${v}`;
          if (!(c.abre <= d && d < c.fechamento)) erros.push(`${onde}: fora do próprio ciclo`);
          if (!(c.vencimento > c.fechamento && c.vencimento <= somarDias(c.fechamento, 31))) erros.push(`${onde}: vencimento ${c.vencimento}`);
          if (c.fechamento !== anterior.fechamento) {
            if (c.abre !== anterior.fechamento) erros.push(`${onde}: buraco entre ciclos`);
            if (!igual(cicloSeguinte(anterior, cartao), c) || !igual(cicloSeguinte(c, cartao, -1), anterior)) erros.push(`${onde}: seguinte/anterior`);
          }
          anterior = c;
        }
      }
    }
    expect(erros.slice(0, 5)).toEqual([]);
  }, 30_000);

  it("a primeira fatura acompanhada é a que vence no início (ou logo depois)", () => {
    expect(primeiroCiclo(nubank).vencimento).toBe("2026-12-10");
    expect(primeiroCiclo({ ...nubank, inicio: "2026-12-05" }).vencimento).toBe("2026-12-10");
    expect(primeiroCiclo({ ...nubank, inicio: "2026-12-11" }).vencimento).toBe("2027-01-10");
  });
});

describe("parcelas", () => {
  it("R$ 100 em 3x: 33,34 + 33,33 + 33,33, uma por fatura a partir da do dia da compra", () => {
    const p = parcelasDaCompra(compra("2026-11-20", 100, { parcelas: 3 }), nubank);
    expect(p.map((x) => [x.fechamento, x.centavos, x.numero, x.de])).toEqual([
      ["2026-12-03", 3334, 1, 3],
      ["2027-01-03", 3333, 2, 3],
      ["2027-02-03", 3333, 3, 3],
    ]);
  });

  it("sorteio: a soma das parcelas é sempre o valor da compra, centavo por centavo", () => {
    let semente = 7;
    const aleatorio = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let i = 0; i < 2000; i++) {
      const valor = Math.round(aleatorio() * 500000) / 100 + 0.01;
      const parcelas = 1 + Math.floor(aleatorio() * 24);
      const p = parcelasDaCompra(compra("2026-11-15", valor, { parcelas }), nubank);
      expect(p.reduce((s, x) => s + x.centavos, 0)).toBe(Math.round(valor * 100));
      expect(new Set(p.map((x) => x.fechamento)).size).toBe(parcelas);
      expect(Math.max(...p.map((x) => x.centavos)) - Math.min(...p.map((x) => x.centavos))).toBeLessThan(parcelas);
    }
  });
});

describe("previstos", () => {
  it("toda sexta, de amanhã até o fechamento (sem incluir o fechamento)", () => {
    // Terça, 10 nov; fecha quinta, 3 dez.
    expect(datasDoPrevisto(previsto({}), "2026-11-11", "2026-12-03")).toEqual(["2026-11-13", "2026-11-20", "2026-11-27"]);
    // Se fechasse numa sexta, a sexta do fechamento já é da próxima fatura.
    expect(datasDoPrevisto(previsto({}), "2026-11-11", "2026-11-27")).toEqual(["2026-11-13", "2026-11-20"]);
  });

  it("todo mês no dia 31 vira o último dia em mês curto", () => {
    const p = previsto({ frequencia: "mensal", dia_semana: null, dia_mes: 31 });
    expect(datasDoPrevisto(p, "2026-11-01", "2027-03-01")).toEqual(["2026-11-30", "2026-12-31", "2027-01-31", "2027-02-28"]);
  });
});

describe("a fatura", () => {
  const hoje = "2026-11-10";
  const ciclo = cicloDaData(hoje, nubank);

  it("soma o comprado, a previsão e separa essenciais e livre", () => {
    const compras = [
      compra("2026-11-08", 230.15), // Alimentação: essencial pela categoria
      compra("2026-11-09", 42.9, { essencial: false }), // delivery marcado como livre
      compra("2026-11-07", 89.9, { categoria: "Tecnologia" }), // livre pela categoria
      compra("2026-11-02", 500), // fatura anterior: fica fora
      compra("2026-11-03", 18.4, { categoria: "Transporte" }), // dia do fechamento: entra nesta
      compra("2026-11-05", 70, { cartao_id: "outro" }), // outro cartão
    ];
    const f = faturaDoCiclo(ciclo, nubank, compras, [previsto({})], hoje);
    expect(f.estado).toBe("aberta");
    expect(f.gasto).toBe(381.35);
    expect(f.previsto).toBe(210);
    expect(f.total).toBe(591.35);
    expect(f.essenciais).toEqual({ gasto: 248.55, previsto: 0 });
    expect(f.livre).toEqual({ gasto: 132.8, previsto: 210 });
    expect(f.itens.map((i) => i.compra.data)).toEqual(["2026-11-09", "2026-11-08", "2026-11-07", "2026-11-03"]);
    expect(f.previstos[0].datas).toEqual(["2026-11-13", "2026-11-20", "2026-11-27"]);
  });

  it("previsto de hoje não conta (já aconteceu ou não); fatura fechada não tem previsto; a futura tem o ciclo inteiro", () => {
    const sexta = "2026-11-13";
    const f = faturaDoCiclo(ciclo, nubank, [], [previsto({})], sexta);
    expect(f.previstos[0].datas).toEqual(["2026-11-20", "2026-11-27"]);
    const fechada = faturaDoCiclo(ciclo, nubank, [], [previsto({})], "2026-12-05");
    expect(fechada.estado).toBe("fechada");
    expect(fechada.previsto).toBe(0);
    const futura = faturaDoCiclo(cicloSeguinte(ciclo, nubank), nubank, [], [previsto({})], hoje);
    expect(futura.estado).toBe("futura");
    expect(futura.previstos[0].datas).toEqual(["2026-12-04", "2026-12-11", "2026-12-18", "2026-12-25", "2027-01-01"]);
  });

  it("previsto pausado não conta", () => {
    expect(faturaDoCiclo(ciclo, nubank, [], [previsto({ ativo: false })], hoje).previsto).toBe(0);
  });

  it("essencial: a escolha da compra vence a categoria", () => {
    expect(ehEssencial({ essencial: null, categoria: "Alimentação" })).toBe(true);
    expect(ehEssencial({ essencial: null, categoria: "Lazer" })).toBe(false);
    expect(ehEssencial({ essencial: true, categoria: "Lazer" })).toBe(true);
    expect(ehEssencial({ essencial: false, categoria: "Saúde" })).toBe(false);
  });
});

describe("a parte que outra pessoa paga", () => {
  const hoje = "2026-11-10";
  const ciclo = cicloDaData(hoje, nubank);
  const parte = (fechamento: string, inicial: number): FaturaCartao => ({
    id: `f${fechamento}`, user_id: "u1", cartao_id: "c1", fechamento, inicial, created_at: "",
  });

  it("a fatura começou com 1.800 da mãe: o banco cobra tudo, mas o seu total não muda", () => {
    const compras = [compra("2026-11-08", 230.15)];
    const f = faturaDoCiclo(ciclo, nubank, compras, [previsto({})], hoje, [parte(ciclo.fechamento, 1800), parte("2027-01-03", 999)]);
    expect(f.inicial).toBe(1800);
    expect(f.inicialInformado).toBe(true);
    expect(f.total).toBe(440.15);
    expect(f.banco).toBe(2240.15);
    // Outra fatura não pega o valor desta.
    const outra = faturaDoCiclo(cicloSeguinte(ciclo, nubank), nubank, [], [], hoje, [parte(ciclo.fechamento, 1800)]);
    expect([outra.inicial, outra.inicialInformado]).toEqual([0, false]);
  });

  it("não entra no saldo: a fatura nas contas é só a sua parte", () => {
    const l = faturasComoLancamentos(nubank, [compra("2026-11-08", 230.15)], [], hoje, "2026-12-31");
    expect(l.map((x) => x.valor)).toEqual([230.15]);
  });

  it("sai da meta antes de dividir: 3.000 − 1.800 = 1.200, sendo 500 essenciais e 700 livre", () => {
    expect(metasDaFatura(nubank, 0)).toEqual({ total: 1000, propria: 1000, essenciais: 500, livre: 500 });
    const tres = { meta_total: 3000, meta_essenciais: 500 };
    expect(metasDaFatura(tres, 1800)).toEqual({ total: 3000, propria: 1200, essenciais: 500, livre: 700 });
    // Sobrando menos que os essenciais, a parte livre zera; passando da meta, nada sobra.
    expect(metasDaFatura(tres, 2900)).toEqual({ total: 3000, propria: 100, essenciais: 100, livre: 0 });
    expect(metasDaFatura(tres, 3500)).toEqual({ total: 3000, propria: 0, essenciais: 0, livre: 0 });
    expect(metasDaFatura({ meta_total: 3000, meta_essenciais: null }, 1800.1)).toEqual({ total: 3000, propria: 1199.9, essenciais: null, livre: null });
    expect(metasDaFatura({ meta_total: null, meta_essenciais: null }, 1800)).toBeNull();
  });
});

describe("a fatura nas contas do app", () => {
  it("vira uma saída no vencimento, só das faturas acompanhadas, e pula a vazia", () => {
    const compras = [
      compra("2026-10-20", 999), // fatura de 10 nov: antes do início, foi lançada à mão
      compra("2026-11-10", 100),
      compra("2026-12-05", 50),
      compra("2026-10-15", 300, { parcelas: 3 }), // 10 nov, 10 dez e 10 jan
    ];
    const l = faturasComoLancamentos(nubank, compras, [], "2026-11-10", "2027-03-31");
    expect(l.map((x) => [x.data, x.valor, x.mes, x.ano])).toEqual([
      ["2026-12-10", 200, 11, 2026],
      ["2027-01-10", 150, 0, 2027],
    ]);
    expect(l[0]).toMatchObject({ tipo: "saida", descricao: "Fatura do cartão", categoria: "Cartão de Crédito / Contas", fatura: { cartao_id: "c1", fechamento: "2026-12-03" } });
    expect(new Set(l.map((x) => x.id)).size).toBe(l.length);
  });

  // Gabarito: compras sorteadas, todas depois do início. Somando as faturas
  // geradas até um horizonte que cubra todas as parcelas, tem de dar o total
  // comprado — e o saldo projetado do último mês é exatamente menos isso.
  it("sorteio: nenhum centavo some nem aparece duas vezes", () => {
    let semente = 42;
    const aleatorio = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let rodada = 0; rodada < 200; rodada++) {
      const compras: CompraCartao[] = [];
      let totalCentavos = 0;
      for (let i = 0; i < 1 + Math.floor(aleatorio() * 30); i++) {
        const data = somarDias("2026-11-03", Math.floor(aleatorio() * 200));
        const valor = Math.round(aleatorio() * 300000) / 100 + 0.01;
        compras.push(compra(data, valor, { parcelas: 1 + Math.floor(aleatorio() * 12) }));
        totalCentavos += Math.round(valor * 100);
      }
      const l = faturasComoLancamentos(nubank, compras, [], "2026-11-10", "2028-12-31");
      expect(Math.round(l.reduce((s, x) => s + x.valor, 0) * 100)).toBe(totalCentavos);
      expect(Math.round(calcularSaldoProjetado(l, 11, 2028) * 100)).toBe(-totalCentavos);
    }
  });
});
