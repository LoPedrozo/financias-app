import type { Cartao, CompraCartao, Lancamento, PrevistoCartao } from "../types";

// A conta da fatura do cartão.
//
// Regras, para não enganar:
//
// 1. O ciclo vai do fechamento anterior (inclusive) até o fechamento
//    (exclusive): compra feita no dia do fechamento já cai na fatura
//    seguinte, como no Nubank ("melhor dia de compra"). Fechando dia 3, a
//    fatura de dezembro junta as compras de 3 nov a 2 dez.
// 2. O vencimento é o primeiro dia de vencimento depois do fechamento. Fecha
//    3, vence 10: mesmo mês. Fecha 28, vence 5: mês seguinte.
// 3. Dia que o mês não tem (31 em novembro, 30 em fevereiro) vira o último
//    dia do mês. Fim de semana e feriado não mudam nada aqui: o banco às
//    vezes empurra o vencimento, mas a conta do mês é a mesma.
// 4. Parcelada, a compra entra uma parcela por fatura, a partir da fatura do
//    dia da compra. Os centavos que sobram da divisão vão na primeira.
// 5. O previsto (o lanche de toda sexta) só conta nos dias que ainda vão
//    chegar — de amanhã até o fechamento. O de hoje já aconteceu ou não; se
//    aconteceu, a compra está lançada.
// 6. Tudo em centavos inteiros; reais só na saída.
//
// Datas são sempre "AAAA-MM-DD" e as contas de calendário são feitas em UTC,
// para nenhum fuso ou horário de verão mover um dia.

export interface Ciclo {
  /** Primeiro dia do ciclo (o fechamento anterior). */
  abre: string;
  /** Dia do fechamento — já não pertence a este ciclo. */
  fechamento: string;
  vencimento: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function partes(iso: string): { ano: number; mes: number; dia: number } {
  return { ano: Number(iso.slice(0, 4)), mes: Number(iso.slice(5, 7)) - 1, dia: Number(iso.slice(8, 10)) };
}

/** A data do dia `dia` no mês (0-11, pode passar de 11 ou ficar negativo),
 *  com o dia limitado ao último do mês. */
export function dataNoMes(ano: number, mes: number, dia: number): string {
  const primeiro = new Date(Date.UTC(ano, mes, 1));
  const a = primeiro.getUTCFullYear();
  const m = primeiro.getUTCMonth();
  const ultimo = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  return `${a}-${pad(m + 1)}-${pad(Math.min(dia, ultimo))}`;
}

export function somarDias(iso: string, dias: number): string {
  const { ano, mes, dia } = partes(iso);
  const d = new Date(Date.UTC(ano, mes, dia + dias));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(iso: string): number {
  const { ano, mes, dia } = partes(iso);
  return new Date(Date.UTC(ano, mes, dia)).getUTCDay();
}

function fechamentoNoMes(ano: number, mes: number, cartao: Pick<Cartao, "dia_fechamento">): string {
  return dataNoMes(ano, mes, cartao.dia_fechamento);
}

function vencimentoDepois(fechamento: string, diaVencimento: number): string {
  const { ano, mes } = partes(fechamento);
  const mesmoMes = dataNoMes(ano, mes, diaVencimento);
  return mesmoMes > fechamento ? mesmoMes : dataNoMes(ano, mes + 1, diaVencimento);
}

type Dias = Pick<Cartao, "dia_fechamento" | "dia_vencimento">;

function cicloQueFechaEm(ano: number, mes: number, cartao: Dias): Ciclo {
  const fechamento = fechamentoNoMes(ano, mes, cartao);
  return {
    abre: fechamentoNoMes(ano, mes - 1, cartao),
    fechamento,
    vencimento: vencimentoDepois(fechamento, cartao.dia_vencimento),
  };
}

/** O ciclo (a fatura) em que cai uma compra feita em `data`. */
export function cicloDaData(data: string, cartao: Dias): Ciclo {
  const { ano, mes } = partes(data);
  return data < fechamentoNoMes(ano, mes, cartao)
    ? cicloQueFechaEm(ano, mes, cartao)
    : cicloQueFechaEm(ano, mes + 1, cartao);
}

/** O ciclo `n` faturas depois (ou antes, com n negativo). */
export function cicloSeguinte(ciclo: Ciclo, cartao: Dias, n = 1): Ciclo {
  const { ano, mes } = partes(ciclo.fechamento);
  return cicloQueFechaEm(ano, mes + n, cartao);
}

/** A primeira fatura acompanhada: a primeira que vence em `inicio` ou depois. */
export function primeiroCiclo(cartao: Dias & Pick<Cartao, "inicio">): Ciclo {
  let c = cicloDaData(cartao.inicio, cartao);
  while (cicloSeguinte(c, cartao, -1).vencimento >= cartao.inicio) c = cicloSeguinte(c, cartao, -1);
  while (c.vencimento < cartao.inicio) c = cicloSeguinte(c, cartao);
  return c;
}

// ——— Essencial ou livre ———

// Pela categoria, a não ser que a compra diga outra coisa. Comida entra como
// essencial: o delivery de domingo é que vira "livre", tocando nele.
export const CATEGORIAS_ESSENCIAIS: ReadonlySet<string> = new Set([
  "Alimentação",
  "Transporte",
  "Saúde",
  "Casa",
  "Educação",
  "Assinaturas",
  "Cartão de Crédito / Contas",
]);

export function ehEssencial(item: { essencial: boolean | null; categoria: string }): boolean {
  return item.essencial ?? CATEGORIAS_ESSENCIAIS.has(item.categoria);
}

// ——— Parcelas ———

export interface Parcela {
  fechamento: string;
  centavos: number;
  numero: number;
  de: number;
}

export function parcelasDaCompra(compra: Pick<CompraCartao, "valor" | "data" | "parcelas">, cartao: Dias): Parcela[] {
  const total = Math.round(compra.valor * 100);
  const de = Math.max(1, Math.floor(compra.parcelas || 1));
  const base = Math.floor(total / de);
  const sobra = total - base * de;
  const primeiro = cicloDaData(compra.data, cartao);
  return Array.from({ length: de }, (_, i) => ({
    fechamento: cicloSeguinte(primeiro, cartao, i).fechamento,
    centavos: base + (i === 0 ? sobra : 0),
    numero: i + 1,
    de,
  }));
}

// ——— Previstos ———

/** Os dias do previsto em [de, ate). */
export function datasDoPrevisto(
  p: Pick<PrevistoCartao, "frequencia" | "dia_semana" | "dia_mes">,
  de: string,
  ate: string
): string[] {
  const datas: string[] = [];
  if (de >= ate) return datas;
  if (p.frequencia === "semanal") {
    if (p.dia_semana == null) return datas;
    let d = somarDias(de, (p.dia_semana - diaDaSemana(de) + 7) % 7);
    for (; d < ate; d = somarDias(d, 7)) datas.push(d);
    return datas;
  }
  if (p.dia_mes == null) return datas;
  const { ano, mes } = partes(de);
  for (let i = 0; ; i++) {
    const d = dataNoMes(ano, mes + i, p.dia_mes);
    if (d >= ate) break;
    if (d >= de) datas.push(d);
  }
  return datas;
}

// ——— A fatura ———

export type EstadoFatura = "futura" | "aberta" | "fechada";

export interface ItemFatura {
  compra: CompraCartao;
  centavos: number;
  numero: number;
  de: number;
  essencial: boolean;
}

export interface PrevistoNaFatura {
  previsto: PrevistoCartao;
  datas: string[];
  centavos: number;
  essencial: boolean;
}

export interface Fatura {
  ciclo: Ciclo;
  estado: EstadoFatura;
  itens: ItemFatura[];
  previstos: PrevistoNaFatura[];
  /** Já comprado (reais). */
  gasto: number;
  /** Ainda vai acontecer, pelos previstos (reais). */
  previsto: number;
  /** gasto + previsto: o que se espera pagar no vencimento. */
  total: number;
  essenciais: { gasto: number; previsto: number };
  livre: { gasto: number; previsto: number };
}

export function estadoDoCiclo(ciclo: Ciclo, hoje: string): EstadoFatura {
  if (hoje < ciclo.abre) return "futura";
  if (hoje < ciclo.fechamento) return "aberta";
  return "fechada";
}

const reais = (centavos: number) => centavos / 100;

export function faturaDoCiclo(
  ciclo: Ciclo,
  cartao: Cartao,
  compras: CompraCartao[],
  previstos: PrevistoCartao[],
  hoje: string
): Fatura {
  const estado = estadoDoCiclo(ciclo, hoje);
  const itens: ItemFatura[] = [];
  for (const compra of compras) {
    if (compra.cartao_id !== cartao.id) continue;
    for (const p of parcelasDaCompra(compra, cartao)) {
      if (p.fechamento === ciclo.fechamento) {
        itens.push({ compra, centavos: p.centavos, numero: p.numero, de: p.de, essencial: ehEssencial(compra) });
      }
    }
  }
  // Do mais novo para o mais antigo, como a lista do mês.
  itens.sort((a, b) => b.compra.data.localeCompare(a.compra.data) || b.compra.created_at.localeCompare(a.compra.created_at));

  const naFatura: PrevistoNaFatura[] = [];
  if (estado !== "fechada") {
    const amanha = somarDias(hoje, 1);
    const de = amanha > ciclo.abre ? amanha : ciclo.abre;
    for (const previsto of previstos) {
      if (previsto.cartao_id !== cartao.id || !previsto.ativo) continue;
      const datas = datasDoPrevisto(previsto, de, ciclo.fechamento);
      if (datas.length === 0) continue;
      naFatura.push({
        previsto,
        datas,
        centavos: Math.round(previsto.valor * 100) * datas.length,
        essencial: ehEssencial(previsto),
      });
    }
  }

  const soma = <T extends { centavos: number; essencial: boolean }>(lista: T[], essencial?: boolean) =>
    lista.filter((x) => essencial === undefined || x.essencial === essencial).reduce((s, x) => s + x.centavos, 0);
  const gasto = soma(itens);
  const previsto = soma(naFatura);
  return {
    ciclo,
    estado,
    itens,
    previstos: naFatura,
    gasto: reais(gasto),
    previsto: reais(previsto),
    total: reais(gasto + previsto),
    essenciais: { gasto: reais(soma(itens, true)), previsto: reais(soma(naFatura, true)) },
    livre: { gasto: reais(soma(itens, false)), previsto: reais(soma(naFatura, false)) },
  };
}

// ——— A fatura nas contas do app ———

export const DESCRICAO_FATURA = "Fatura do cartão";
export const CATEGORIA_FATURA = "Cartão de Crédito / Contas";

/**
 * Cada fatura acompanhada vira um lançamento de saída no dia do vencimento,
 * com o valor esperado (comprado + previsto). Assim saldo, pendentes,
 * projeção e gastos do mês funcionam sem nenhuma conta nova: para eles, a
 * fatura é só mais uma saída. Vai até a fatura que vence em `ate` (inclusive)
 * e pula fatura vazia.
 */
export function faturasComoLancamentos(
  cartao: Cartao,
  compras: CompraCartao[],
  previstos: PrevistoCartao[],
  hoje: string,
  ate: string
): Lancamento[] {
  const saida: Lancamento[] = [];
  for (let c = primeiroCiclo(cartao); c.vencimento <= ate; c = cicloSeguinte(c, cartao)) {
    const f = faturaDoCiclo(c, cartao, compras, previstos, hoje);
    if (f.total <= 0) continue;
    const { ano, mes } = partes(c.vencimento);
    saida.push({
      id: `fatura:${cartao.id}:${c.fechamento}`,
      user_id: cartao.user_id,
      tipo: "saida",
      valor: f.total,
      descricao: DESCRICAO_FATURA,
      categoria: CATEGORIA_FATURA,
      mes,
      ano,
      data: c.vencimento,
      created_at: `${c.fechamento}T00:00:00.000Z`,
      recorrencia_id: null,
      fatura: { cartao_id: cartao.id, fechamento: c.fechamento },
    });
  }
  return saida;
}
