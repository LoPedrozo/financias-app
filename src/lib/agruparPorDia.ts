import type { Lancamento } from "../types";
import { MESES } from "../types";

// Agrupa a lista do mês por dia, para a lista de lançamentos.
//
// - O que ainda vai acontecer (data depois de hoje) fica num grupo só,
//   "Agendados", no topo e do mais próximo para o mais distante: é o que
//   se confere antes de gastar.
// - O resto vai por dia, do mais recente para o mais antigo: "Hoje",
//   "Ontem", "Qua, 4 nov".
// - Cada grupo leva o total do dia: entradas somam, saídas subtraem.
//
// Função pura e sem relógio próprio — quem chama diz que dia é hoje —, para
// os testes conferirem que nenhum lançamento some, se repete ou cai no dia
// errado.

export interface GrupoDia {
  chave: string;
  rotulo: string;
  futuro: boolean;
  /** Entradas menos saídas, arredondado em centavos. */
  total: number;
  itens: Lancamento[];
}

// A mesma data que a lista sempre usou para ordenar: a do lançamento, ou o
// dia em que foi criado, para os antigos sem data.
export function dataDoLancamento(l: Lancamento): string {
  return l.data ?? l.created_at.slice(0, 10);
}

export function ehFuturo(l: Lancamento, hoje: string): boolean {
  return !!l.data && l.data > hoje;
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function paraData(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
}

function paraIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "Qua, 4 nov".
export function rotuloCurto(iso: string): string {
  const d = paraData(iso);
  return `${DIAS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3).toLowerCase()}`;
}

function rotuloDoDia(iso: string, hoje: string): string {
  if (iso === hoje) return "Hoje";
  const ontem = paraData(hoje);
  ontem.setDate(ontem.getDate() - 1);
  if (iso === paraIso(ontem)) return "Ontem";
  return rotuloCurto(iso);
}

function somar(itens: Lancamento[]): number {
  const centavos = itens.reduce(
    (s, l) => s + Math.round(l.valor * 100) * (l.tipo === "entrada" ? 1 : -1),
    0
  );
  return centavos / 100;
}

export function agruparPorDia(lista: Lancamento[], hoje: string): GrupoDia[] {
  const futuros = lista
    .filter((l) => ehFuturo(l, hoje))
    .sort((a, b) => a.data!.localeCompare(b.data!) || a.created_at.localeCompare(b.created_at));

  const passados = lista
    .filter((l) => !ehFuturo(l, hoje))
    .sort(
      (a, b) =>
        dataDoLancamento(b).localeCompare(dataDoLancamento(a)) ||
        b.created_at.localeCompare(a.created_at)
    );

  const grupos: GrupoDia[] = [];
  if (futuros.length > 0) {
    grupos.push({ chave: "agendados", rotulo: "Agendados", futuro: true, total: somar(futuros), itens: futuros });
  }
  for (const l of passados) {
    const dia = dataDoLancamento(l);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && !ultimo.futuro && ultimo.chave === dia) ultimo.itens.push(l);
    else grupos.push({ chave: dia, rotulo: rotuloDoDia(dia, hoje), futuro: false, total: 0, itens: [l] });
  }
  for (const g of grupos) if (!g.futuro) g.total = somar(g.itens);
  return grupos;
}
