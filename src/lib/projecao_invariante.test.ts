import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calcularPendentes,
  calcularSaldoAcumulado,
  calcularSaldoProjetado,
} from "./calculos";
import type { Lancamento } from "../types";

// O card do saldo mostra a conta armada: saldo atual, o que entra, o que sai e
// o fim do mês. Esses quatro números saem de três funções diferentes, e a
// conta só fecha se as três concordarem sobre o que já aconteceu e o que
// ainda vai acontecer. É o número com que se decide se dá para pagar uma
// conta — errar para mais é o pior erro que o app pode cometer.
//
// Em vez de alguns casos escritos à mão, este teste sorteia milhares de
// situações: datas espalhadas por três anos, valores com centavos,
// lançamentos antigos sem data, competência que não bate com a data, o dia
// de "hoje" variando, mês visitado passado, presente e futuro. O sorteio usa
// semente fixa, então uma falha se reproduz igual.

function sorteador(semente: number) {
  // mulberry32: pequeno, determinístico e bom o bastante para gerar casos.
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

function gerarCaso(r: () => number) {
  const inteiro = (min: number, max: number) => min + Math.floor(r() * (max - min + 1));
  const quantos = inteiro(0, 40);
  const lancamentos: Lancamento[] = [];
  for (let i = 0; i < quantos; i++) {
    const ano = inteiro(2025, 2027);
    const mes = inteiro(0, 11);
    const dia = inteiro(1, 28);
    const semData = r() < 0.08; // lançamento antigo, de antes da coluna data
    const competenciaTorta = r() < 0.05; // data e competência que não batem
    lancamentos.push({
      id: `l${i}`,
      user_id: "u",
      tipo: r() < 0.5 ? "entrada" : "saida",
      // Centavos de verdade: é onde soma em ponto flutuante costuma morder.
      valor: inteiro(1, 1_500_000) / 100,
      descricao: "x",
      categoria: "Outros",
      mes: competenciaTorta ? inteiro(0, 11) : mes,
      ano: competenciaTorta ? inteiro(2025, 2027) : ano,
      data: semData ? null : iso(ano, mes, dia),
      created_at: "",
    });
  }
  const visitado = { mes: inteiro(0, 11), ano: inteiro(2025, 2027) };
  const hoje = new Date(inteiro(2025, 2027), inteiro(0, 11), inteiro(1, 28), 12);
  // Contas a pagar em aberto, como o Dashboard soma (hoje a feature está
  // desligada e isto é zero, mas a conta tem que fechar com ela ligada).
  const contas = r() < 0.3 ? { total: inteiro(0, 500_000) / 100, quantidade: inteiro(1, 5) } : { total: 0, quantidade: 0 };
  return { lancamentos, visitado, hoje, contas };
}

afterEach(() => vi.useRealTimers());

describe("a conta do card do saldo sempre fecha", () => {
  it("saldo atual + a receber − a pagar = fim do mês, em 3.000 situações sorteadas", () => {
    const r = sorteador(20261106);
    for (let caso = 0; caso < 3000; caso++) {
      const { lancamentos, visitado, hoje, contas } = gerarCaso(r);
      vi.setSystemTime(hoje);
      const { mes, ano } = visitado;

      // Exatamente como o Dashboard monta o que o card recebe.
      const atual = calcularSaldoAcumulado(lancamentos, mes, ano);
      const pend = calcularPendentes(lancamentos, mes, ano);
      const entra = pend.entradas.total;
      const sai = pend.saidas.total + contas.total;
      const fimDoMes = calcularSaldoProjetado(lancamentos, mes, ano) - contas.total;

      // Meio centavo de folga: cada número é arredondado ao centavo na tela,
      // e o que interessa é a conta fechar nos centavos que a pessoa vê.
      const diferenca = Math.abs(atual + entra - sai - fimDoMes);
      expect(diferenca, `caso ${caso}: ${atual} + ${entra} − ${sai} ≠ ${fimDoMes}`).toBeLessThan(0.005);
    }
  });

  it("a conta também fecha nos centavos que aparecem na tela", () => {
    const r = sorteador(42);
    const centavos = (v: number) => Math.round(v * 100);
    for (let caso = 0; caso < 3000; caso++) {
      const { lancamentos, visitado, hoje } = gerarCaso(r);
      vi.setSystemTime(hoje);
      const { mes, ano } = visitado;
      const atual = centavos(calcularSaldoAcumulado(lancamentos, mes, ano));
      const pend = calcularPendentes(lancamentos, mes, ano);
      const fim = centavos(calcularSaldoProjetado(lancamentos, mes, ano));
      // Quem confere de cabeça soma os números já arredondados.
      expect(atual + centavos(pend.entradas.total) - centavos(pend.saidas.total), `caso ${caso}`).toBe(fim);
    }
  });

  it("cada lançamento futuro é contado uma vez só, em entra ou em sai", () => {
    const r = sorteador(7);
    for (let caso = 0; caso < 1000; caso++) {
      const { lancamentos, visitado, hoje } = gerarCaso(r);
      vi.setSystemTime(hoje);
      const { mes, ano } = visitado;
      const hojeIso = iso(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      const esperados = lancamentos.filter(
        (l) => (l.ano < ano || (l.ano === ano && l.mes <= mes)) && l.data !== null && l.data > hojeIso
      ).length;
      const pend = calcularPendentes(lancamentos, mes, ano);
      expect(pend.entradas.quantidade + pend.saidas.quantidade, `caso ${caso}`).toBe(esperados);
    }
  });
});
