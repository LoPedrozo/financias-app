import { afterEach, describe, expect, it, vi } from "vitest";
import { porCategoria, resumoDoMes, situacaoDoMes } from "./resumoMes";
import { filtrarPorMes, somarPorTipo } from "./calculos";
import type { Lancamento } from "../types";

// O resumo e o "por categoria" mostram dinheiro e comparações: um centavo
// errado aqui é exatamente o tipo de erro que não se percebe e se repete todo
// mês. Por isso, além dos casos escritos à mão, um sorteio de milhares de
// situações confere tudo contra um gabarito escrito de outro jeito (com datas
// de verdade e laços simples, sem reaproveitar nada do código testado).

afterEach(() => vi.useRealTimers());

let n = 0;
const l = (tipo: "entrada" | "saida", valor: number, mes: number, ano: number, data: string | null, categoria = "Outros"): Lancamento => ({
  id: `l${n++}`, user_id: "u", tipo, valor, descricao: "", categoria, mes, ano, data, created_at: "2026-01-01T00:00:00Z",
});
const c = (v: number) => Math.round(v * 100); // compara em centavos

describe("situação do mês", () => {
  it("passado, atual e futuro, inclusive na virada do ano", () => {
    expect(situacaoDoMes(9, 2026, "2026-11-06")).toBe("passado");
    expect(situacaoDoMes(10, 2026, "2026-11-06")).toBe("atual");
    expect(situacaoDoMes(11, 2026, "2026-11-06")).toBe("futuro");
    expect(situacaoDoMes(11, 2025, "2026-01-02")).toBe("passado");
    expect(situacaoDoMes(0, 2027, "2026-12-31")).toBe("futuro");
  });
});

describe("resumo do mês — casos escritos à mão", () => {
  it("mês atual: conta só até hoje e compara com o mesmo período do mês anterior", () => {
    const hoje = "2026-11-06";
    const ls = [
      l("entrada", 8000, 10, 2026, "2026-11-01"),
      l("saida", 152.4, 10, 2026, "2026-11-03", "Alimentação"),
      l("saida", 4715.47, 10, 2026, "2026-11-10", "Cartão de Crédito / Contas"), // agendado: não conta
      l("entrada", 7550, 9, 2026, "2026-10-01"),
      l("saida", 100, 9, 2026, "2026-10-05", "Alimentação"),
      l("saida", 5000, 9, 2026, "2026-10-20", "Cartão de Crédito / Contas"), // depois do dia 6: fora da comparação
    ];
    const r = resumoDoMes(ls, 10, 2026, hoje);
    expect(r.situacao).toBe("atual");
    expect(r.ateDia).toBe(6);
    expect(r.totais).toEqual({ entrou: 8000, saiu: 152.4, sobra: 7847.6 });
    expect(r.comparacao!.ateDia).toBe(6);
    expect(r.comparacao!.anterior).toEqual({ entrou: 7550, saiu: 100, sobra: 7450 });
    expect(r.comparacao!.difEntrou).toBe(450);
    expect(r.comparacao!.difSaiu).toBe(52.4);
    expect(r.comparacao!.difSobra).toBe(397.6);
    expect(r.comparacao!.maisSubiu).toEqual({ categoria: "Alimentação", diferenca: 52.4 });
  });

  it("mês que já passou: inteiro contra o anterior inteiro", () => {
    const ls = [
      l("saida", 5000, 9, 2026, "2026-10-20"),
      l("saida", 300, 8, 2026, "2026-09-29"),
    ];
    const r = resumoDoMes(ls, 9, 2026, "2026-11-06");
    expect(r.situacao).toBe("passado");
    expect(r.comparacao!.ateDia).toBeNull();
    expect(r.comparacao!.difSaiu).toBe(4700);
  });

  it("dia 31: o mês anterior de 30 dias entra inteiro; fevereiro também", () => {
    const ls = [l("saida", 10, 10, 2026, "2026-11-30"), l("saida", 1, 11, 2026, "2026-12-31")];
    expect(resumoDoMes(ls, 11, 2026, "2026-12-31").comparacao!.anterior.saiu).toBe(10);
    const fev = [l("saida", 7, 1, 2027, "2027-02-28"), l("saida", 1, 2, 2027, "2027-03-31")];
    expect(resumoDoMes(fev, 2, 2027, "2027-03-31").comparacao!.ateDia).toBe(28);
    expect(resumoDoMes(fev, 2, 2027, "2027-03-31").comparacao!.anterior.saiu).toBe(7);
  });

  it("janeiro compara com dezembro do ano anterior", () => {
    const ls = [l("saida", 40, 11, 2026, "2026-12-02"), l("saida", 10, 0, 2027, "2027-01-02")];
    const r = resumoDoMes(ls, 0, 2027, "2027-01-05");
    expect(r.comparacao!.difSaiu).toBe(-30);
    expect(r.historico.map((h) => `${h.mes}/${h.ano}`)).toEqual(["7/2026", "8/2026", "9/2026", "10/2026", "11/2026", "0/2027"]);
  });

  it("sem nada no mês anterior não há comparação; mês futuro também não", () => {
    const ls = [l("saida", 10, 10, 2026, "2026-11-02")];
    expect(resumoDoMes(ls, 10, 2026, "2026-11-06").comparacao).toBeNull();
    const fut = [l("saida", 10, 11, 2026, "2026-12-02"), l("saida", 5, 10, 2026, "2026-11-02")];
    const r = resumoDoMes(fut, 11, 2026, "2026-11-06");
    expect(r.situacao).toBe("futuro");
    expect(r.comparacao).toBeNull();
    expect(r.totais).toEqual({ entrou: 0, saiu: 0, sobra: 0 });
  });

  it("centavos exatos: 0,10 + 0,20 − 0,30 dá zero", () => {
    const ls = [l("entrada", 0.1, 10, 2026, "2026-11-01"), l("entrada", 0.2, 10, 2026, "2026-11-01"), l("saida", 0.3, 10, 2026, "2026-11-01")];
    expect(resumoDoMes(ls, 10, 2026, "2026-11-06").totais.sobra).toBe(0);
  });

  // Somando em reais, 0,01 + 0,06 dá 0,07 com um resto de 1e-16 — e a tela
  // diria "Gastou R$ 0,00 a mais" em vez de "o mesmo". Diferença que é zero
  // tem que ser zero exato.
  it("diferença de valores iguais é zero exato, sem resto de ponto flutuante", () => {
    for (const [a, b, soma] of [[0.01, 0.06, 0.07], [0.01, 0.13, 0.14], [0.01, 0.14, 0.15]]) {
      const ls = [
        l("saida", a, 10, 2026, "2026-11-02"), l("saida", b, 10, 2026, "2026-11-02"),
        l("saida", soma, 9, 2026, "2026-10-02"),
      ];
      const r = resumoDoMes(ls, 10, 2026, "2026-11-06");
      expect(r.comparacao!.difSaiu).toBe(0);
      expect(r.comparacao!.difSobra).toBe(0);
      expect(porCategoria(ls, 10, 2026, "saida", "2026-11-06").diferenca).toBe(0);
    }
  });

  it("nenhuma categoria subiu: não inventa uma", () => {
    const ls = [l("saida", 10, 10, 2026, "2026-11-02", "Lazer"), l("saida", 50, 9, 2026, "2026-10-02", "Lazer")];
    expect(resumoDoMes(ls, 10, 2026, "2026-11-06").comparacao!.maisSubiu).toBeNull();
  });
});

describe("por categoria — casos escritos à mão", () => {
  it("ordena do maior para o menor, com fração e diferença", () => {
    const ls = [
      l("saida", 300, 10, 2026, "2026-11-02", "Alimentação"),
      l("saida", 100, 10, 2026, "2026-11-03", "Transporte"),
      l("saida", 120, 9, 2026, "2026-10-02", "Transporte"),
    ];
    const p = porCategoria(ls, 10, 2026, "saida", "2026-11-06");
    expect(p.total).toBe(400);
    expect(p.linhas.map((x) => [x.nome, x.valor, x.fracao, x.diferenca])).toEqual([
      ["Alimentação", 300, 0.75, 300],
      ["Transporte", 100, 0.25, -20],
    ]);
    expect(p.diferenca).toBe(280);
  });

  it("categoria desconhecida entra em cinza, para a soma bater com o total", () => {
    const ls = [l("saida", 50, 10, 2026, "2026-11-02", "Moradia (antiga)"), l("saida", 25, 10, 2026, "2026-11-02", "Lazer")];
    const p = porCategoria(ls, 10, 2026, "saida", "2026-11-06");
    expect(p.linhas.find((x) => x.nome === "Moradia (antiga)")!.cor).toBe("#9aa3b0");
    expect(p.linhas.reduce((s, x) => s + c(x.valor), 0)).toBe(c(p.total));
  });
});

// ------------------------------- sorteio -----------------------------------

// Gabarito: datas de verdade (Date) e laços simples.
function gabarito(ls: Lancamento[], mes: number, ano: number, hoje: string) {
  const hojeD = new Date(+hoje.slice(0, 4), +hoje.slice(5, 7) - 1, +hoje.slice(8, 10));
  const conta = (x: Lancamento, ate: Date) => x.data === null || new Date(+x.data.slice(0, 4), +x.data.slice(5, 7) - 1, +x.data.slice(8, 10)) <= ate;
  const soma = (xs: Lancamento[], tipo: string, ate: Date) => xs.filter((x) => x.tipo === tipo && conta(x, ate)).reduce((s, x) => s + c(x.valor), 0);
  const deste = ls.filter((x) => x.mes === mes && x.ano === ano);
  const antMes = mes === 0 ? 11 : mes - 1, antAno = mes === 0 ? ano - 1 : ano;
  const doAnt = ls.filter((x) => x.mes === antMes && x.ano === antAno);
  const atual = mes === hojeD.getMonth() && ano === hojeD.getFullYear();
  const futuro = ano > hojeD.getFullYear() || (ano === hojeD.getFullYear() && mes > hojeD.getMonth());
  let limiteAnt = hojeD;
  if (atual) {
    const ultimo = new Date(antAno, antMes + 1, 0).getDate();
    limiteAnt = new Date(antAno, antMes, Math.min(hojeD.getDate(), ultimo));
  }
  const cat = (xs: Lancamento[], ate: Date) => {
    const m: Record<string, number> = {};
    for (const x of xs) if (x.tipo === "saida" && conta(x, ate)) m[x.categoria] = (m[x.categoria] ?? 0) + c(x.valor);
    return m;
  };
  const ca = cat(deste, hojeD), cb = cat(doAnt, limiteAnt);
  const subidas = Object.keys(ca).map((k) => ca[k] - (cb[k] ?? 0)).filter((d) => d > 0);
  return {
    entrou: soma(deste, "entrada", hojeD), saiu: soma(deste, "saida", hojeD),
    temComparacao: !futuro && doAnt.length > 0,
    antEntrou: soma(doAnt, "entrada", limiteAnt), antSaiu: soma(doAnt, "saida", limiteAnt),
    maiorSubida: subidas.length ? Math.max(...subidas) : null,
    catAgora: ca,
  };
}

describe("milhares de situações sorteadas contra o gabarito", () => {
  it("totais, comparações, categorias e histórico batem no centavo", () => {
    let semente = 2026;
    const r = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const cats = ["Alimentação", "Transporte", "Lazer", "Saúde", "Categoria Velha"];
    for (let rodada = 0; rodada < 3000; rodada++) {
      // Hoje sorteado em 2026–2027, de 1 a 31 conforme o mês.
      const hAno = 2026 + Math.floor(r() * 2), hMes = Math.floor(r() * 12);
      const hDia = 1 + Math.floor(r() * new Date(hAno, hMes + 1, 0).getDate());
      const hoje = `${hAno}-${String(hMes + 1).padStart(2, "0")}-${String(hDia).padStart(2, "0")}`;
      // Mês da tela: perto de hoje (passado, atual ou futuro).
      const desloc = Math.floor(r() * 5) - 3;
      const tela = new Date(hAno, hMes + desloc, 1);
      const mes = tela.getMonth(), ano = tela.getFullYear();
      const ls: Lancamento[] = [];
      const qtd = Math.floor(r() * 30);
      for (let i = 0; i < qtd; i++) {
        const d = new Date(ano, mes - Math.floor(r() * 3), 1);
        const dia = 1 + Math.floor(r() * new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
        const data = r() < 0.08 ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
        ls.push(l(r() < 0.35 ? "entrada" : "saida", Math.round(r() * 500000) / 100, d.getMonth(), d.getFullYear(), data, cats[Math.floor(r() * cats.length)]));
      }

      const g = gabarito(ls, mes, ano, hoje);
      const res = resumoDoMes(ls, mes, ano, hoje);
      expect(c(res.totais.entrou)).toBe(g.entrou);
      expect(c(res.totais.saiu)).toBe(g.saiu);
      expect(c(res.totais.sobra)).toBe(g.entrou - g.saiu);
      expect(res.comparacao !== null).toBe(g.temComparacao);
      if (res.comparacao) {
        expect(c(res.comparacao.anterior.entrou)).toBe(g.antEntrou);
        expect(c(res.comparacao.anterior.saiu)).toBe(g.antSaiu);
        expect(c(res.comparacao.difEntrou)).toBe(g.entrou - g.antEntrou);
        expect(c(res.comparacao.difSaiu)).toBe(g.saiu - g.antSaiu);
        expect(c(res.comparacao.difSobra)).toBe(g.entrou - g.saiu - (g.antEntrou - g.antSaiu));
        expect(res.comparacao.maisSubiu === null ? null : c(res.comparacao.maisSubiu.diferenca)).toBe(g.maiorSubida);
        if (res.comparacao.maisSubiu) {
          const k = res.comparacao.maisSubiu.categoria;
          expect(g.catAgora[k]).toBeGreaterThan(0);
        }
      }
      // O último mês do histórico é o mês da tela, com a mesma sobra.
      const ult = res.historico[5];
      expect([ult.mes, ult.ano]).toEqual([mes, ano]);
      expect(c(ult.sobra)).toBe(g.entrou - g.saiu);

      // Por categoria: as linhas somam o total, e o total é o "saiu"/"entrou".
      for (const tipo of ["saida", "entrada"] as const) {
        const p = porCategoria(ls, mes, ano, tipo, hoje);
        expect(c(p.total)).toBe(tipo === "saida" ? g.saiu : g.entrou);
        expect(p.linhas.reduce((s, x) => s + c(x.valor), 0)).toBe(c(p.total));
        if (p.linhas.length) expect(p.linhas.reduce((s, x) => s + x.fracao, 0)).toBeCloseTo(1, 9);
        if (p.diferenca !== null) expect(c(p.diferenca)).toBe(c(p.total) - (tipo === "saida" ? g.antSaiu : g.antEntrou));
        for (let i = 1; i < p.linhas.length; i++) expect(p.linhas[i - 1].valor).toBeGreaterThanOrEqual(p.linhas[i].valor);
      }
    }
  });

  // A mesma regra dos cards de Renda e Gastos: o "entrou" e o "saiu" do
  // resumo têm que ser exatamente os números que aparecem nos cards.
  it("entrou e saiu batem com os cards de Renda e Gastos", () => {
    let semente = 7;
    const r = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    vi.useFakeTimers();
    for (let rodada = 0; rodada < 500; rodada++) {
      const dia = 1 + Math.floor(r() * 30);
      vi.setSystemTime(new Date(2026, 10, dia, 12));
      const hoje = `2026-11-${String(dia).padStart(2, "0")}`;
      const ls: Lancamento[] = [];
      for (let i = 0; i < 20; i++) {
        const d = 1 + Math.floor(r() * 30);
        ls.push(l(r() < 0.4 ? "entrada" : "saida", Math.round(r() * 100000) / 100, 10, 2026, r() < 0.1 ? null : `2026-11-${String(d).padStart(2, "0")}`));
      }
      const res = resumoDoMes(ls, 10, 2026, hoje);
      const doMes = filtrarPorMes(ls, 10, 2026);
      expect(c(res.totais.entrou)).toBe(c(somarPorTipo(doMes, "entrada")));
      expect(c(res.totais.saiu)).toBe(c(somarPorTipo(doMes, "saida")));
    }
  });
});
