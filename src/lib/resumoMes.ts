import type { Lancamento, Tipo } from "../types";
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA } from "../types";
import { competenciaAnterior, compararCompetencia, diasNoMes } from "./calculos";

// As contas dos dois cards que substituíram os gráficos: "Por categoria" e
// "Resumo do mês".
//
// Regras, para não enganar:
//
// 1. Conta só o que já aconteceu — a mesma regra dos cards de Renda e Gastos
//    (lançamento sem data conta; com data, só se a data já chegou). Assim o
//    "entrou" do resumo é exatamente a Renda do card, e o "saiu", os Gastos.
//    Há teste comparando os dois.
//
// 2. A comparação com o mês anterior é justa:
//    - mês que já passou: o mês inteiro contra o anterior inteiro;
//    - mês atual: o MESMO PERÍODO dos dois. No dia 6, novembro (1 a 6) contra
//      outubro de 1 a 6. Comparar seis dias com um mês inteiro diria sempre
//      "gastou menos", o que não é verdade nenhuma.
//    - mês que ainda não começou: não há o que comparar.
//
// 3. Tudo em centavos inteiros, e só no fim volta a reais: 0,1 + 0,2 − 0,3
//    tem que dar zero, e não 5,5e-17.

export type Situacao = "passado" | "atual" | "futuro";

export interface Totais {
  entrou: number;
  saiu: number;
  /** entrou − saiu. Negativo é "faltou". */
  sobra: number;
}

export interface Comparacao {
  /** Até que dia do mês anterior se comparou (mês atual), ou null (mês inteiro). */
  ateDia: number | null;
  anterior: Totais;
  difEntrou: number;
  difSaiu: number;
  difSobra: number;
  /** A categoria de gasto que mais subiu, se alguma subiu. */
  maisSubiu: { categoria: string; diferenca: number } | null;
}

export interface MesDoHistorico {
  mes: number;
  ano: number;
  sobra: number;
  /** Nenhum lançamento contado: o mês aparece sem barra. */
  vazio: boolean;
}

export interface ResumoDoMes {
  situacao: Situacao;
  /** Mês atual: o dia de hoje; os outros: null. */
  ateDia: number | null;
  totais: Totais;
  /** null quando o mês anterior não tem nenhum lançamento, ou o mês ainda não começou. */
  comparacao: Comparacao | null;
  /** Seis meses terminando no mês da tela, do mais antigo para ele. */
  historico: MesDoHistorico[];
}

export interface LinhaCategoria {
  nome: string;
  cor: string;
  valor: number;
  /** Fração do total do tipo (0 a 1). */
  fracao: number;
  /** Valor no período de comparação do mês anterior; null sem comparação. */
  anterior: number | null;
  diferenca: number | null;
}

export interface PorCategoria {
  total: number;
  totalAnterior: number | null;
  diferenca: number | null;
  /** Só as categorias com valor no mês, da maior para a menor. */
  linhas: LinhaCategoria[];
}

// ---------------------------------------------------------------------------

const centavos = (v: number) => Math.round(v * 100);
const reais = (c: number) => c / 100;

// Conta até `limite` ("AAAA-MM-DD"): sem data conta sempre; com data, se ela
// não passou do limite. Com limite = hoje é a regra de calculos.ts
// (isContabilizado), que o card de Renda/Gastos usa.
function contaAte(l: Lancamento, limite: string): boolean {
  return !l.data || l.data <= limite;
}

const doMes = (ls: Lancamento[], mes: number, ano: number) =>
  ls.filter((l) => l.mes === mes && l.ano === ano);

function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function competenciaDe(hoje: string) {
  return { ano: Number(hoje.slice(0, 4)), mes: Number(hoje.slice(5, 7)) - 1 };
}

export function situacaoDoMes(mes: number, ano: number, hoje: string): Situacao {
  const c = compararCompetencia({ mes, ano }, competenciaDe(hoje));
  return c < 0 ? "passado" : c === 0 ? "atual" : "futuro";
}

function totaisEmCentavos(ls: Lancamento[], limite: string) {
  let entrou = 0;
  let saiu = 0;
  for (const l of ls) {
    if (!contaAte(l, limite)) continue;
    if (l.tipo === "entrada") entrou += centavos(l.valor);
    else saiu += centavos(l.valor);
  }
  return { entrou, saiu };
}

const paraTotais = (c: { entrou: number; saiu: number }): Totais => ({
  entrou: reais(c.entrou),
  saiu: reais(c.saiu),
  sobra: reais(c.entrou - c.saiu),
});

// O recorte do mês anterior que entra na comparação: o mês inteiro, ou até o
// mesmo dia do mês atual (encolhendo para o último dia que o mês anterior
// tem — no dia 31 de março, fevereiro vai inteiro).
function limiteDoAnterior(mes: number, ano: number, hoje: string, situacao: Situacao) {
  const ant = competenciaAnterior({ mes, ano });
  if (situacao === "atual") {
    const dia = Math.min(Number(hoje.slice(8, 10)), diasNoMes(ant.mes, ant.ano));
    return { ant, limite: iso(ant.ano, ant.mes, dia), ateDia: dia };
  }
  return { ant, limite: hoje, ateDia: null };
}

function somaPorCategoria(ls: Lancamento[], tipo: Tipo, limite: string): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const l of ls) {
    if (l.tipo !== tipo || !contaAte(l, limite)) continue;
    mapa.set(l.categoria, (mapa.get(l.categoria) ?? 0) + centavos(l.valor));
  }
  return mapa;
}

// ---------------------------------------------------------------------------

export function resumoDoMes(
  lancamentos: Lancamento[],
  mes: number,
  ano: number,
  hoje: string
): ResumoDoMes {
  const situacao = situacaoDoMes(mes, ano, hoje);
  const doMesAtual = doMes(lancamentos, mes, ano);
  const atual = totaisEmCentavos(doMesAtual, hoje);

  let comparacao: Comparacao | null = null;
  const { ant, limite, ateDia } = limiteDoAnterior(mes, ano, hoje, situacao);
  const doAnterior = doMes(lancamentos, ant.mes, ant.ano);
  if (situacao !== "futuro" && doAnterior.length > 0) {
    const anterior = totaisEmCentavos(doAnterior, limite);
    const agora = somaPorCategoria(doMesAtual, "saida", hoje);
    const antes = somaPorCategoria(doAnterior, "saida", limite);
    let maisSubiu: Comparacao["maisSubiu"] = null;
    for (const [categoria, valor] of agora) {
      const dif = valor - (antes.get(categoria) ?? 0);
      if (dif > 0 && (!maisSubiu || dif > centavos(maisSubiu.diferenca))) {
        maisSubiu = { categoria, diferenca: reais(dif) };
      }
    }
    comparacao = {
      ateDia,
      anterior: paraTotais(anterior),
      difEntrou: reais(atual.entrou - anterior.entrou),
      difSaiu: reais(atual.saiu - anterior.saiu),
      difSobra: reais(atual.entrou - atual.saiu - (anterior.entrou - anterior.saiu)),
      maisSubiu,
    };
  }

  const historico: MesDoHistorico[] = [];
  let c = { mes, ano };
  for (let i = 0; i < 6; i++) {
    const ls = doMes(lancamentos, c.mes, c.ano).filter((l) => contaAte(l, hoje));
    const t = totaisEmCentavos(ls, hoje);
    historico.unshift({ mes: c.mes, ano: c.ano, sobra: reais(t.entrou - t.saiu), vazio: ls.length === 0 });
    c = competenciaAnterior(c);
  }

  return {
    situacao,
    ateDia: situacao === "atual" ? Number(hoje.slice(8, 10)) : null,
    totais: paraTotais(atual),
    comparacao,
    historico,
  };
}

const COR_PADRAO = "#9aa3b0";

export function porCategoria(
  lancamentos: Lancamento[],
  mes: number,
  ano: number,
  tipo: Tipo,
  hoje: string
): PorCategoria {
  const situacao = situacaoDoMes(mes, ano, hoje);
  const agora = somaPorCategoria(doMes(lancamentos, mes, ano), tipo, hoje);
  const total = [...agora.values()].reduce((s, v) => s + v, 0);

  const { ant, limite } = limiteDoAnterior(mes, ano, hoje, situacao);
  const doAnterior = doMes(lancamentos, ant.mes, ant.ano);
  const comparar = situacao !== "futuro" && doAnterior.length > 0;
  const antes = comparar ? somaPorCategoria(doAnterior, tipo, limite) : null;
  const totalAnterior = antes ? [...antes.values()].reduce((s, v) => s + v, 0) : null;

  const lista = tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
  // Categoria fora da lista (renomeada, de versão antiga) também entra, em
  // cinza: sem ela, a soma das linhas não daria o total.
  const linhas: LinhaCategoria[] = [...agora.entries()]
    .filter(([, v]) => v > 0)
    .map(([nome, v]) => {
      const a = antes ? antes.get(nome) ?? 0 : null;
      return {
        nome,
        cor: lista.find((c) => c.nome === nome)?.cor ?? COR_PADRAO,
        valor: reais(v),
        fracao: total > 0 ? v / total : 0,
        anterior: a === null ? null : reais(a),
        diferenca: a === null ? null : reais(v - a),
      };
    })
    .sort((x, y) => y.valor - x.valor || x.nome.localeCompare(y.nome));

  return {
    total: reais(total),
    totalAnterior: totalAnterior === null ? null : reais(totalAnterior),
    diferenca: totalAnterior === null ? null : reais(total - totalAnterior),
    linhas,
  };
}
