import type { Categoria, Lancamento, Tipo } from "../types";

export function filtrarPorMes(
  lancamentos: Lancamento[],
  mes: number,
  ano: number
): Lancamento[] {
  return lancamentos.filter((l) => l.mes === mes && l.ano === ano);
}

export function somarPorTipo(lancamentos: Lancamento[], tipo: Tipo): number {
  return lancamentos
    .filter((l) => l.tipo === tipo)
    .reduce((s, l) => s + l.valor, 0);
}

export function calcularSaldoAcumulado(
  lancamentos: Lancamento[],
  mes: number,
  ano: number
): number {
  return lancamentos
    .filter((l) => l.ano < ano || (l.ano === ano && l.mes <= mes))
    .reduce((s, l) => s + (l.tipo === "entrada" ? l.valor : -l.valor), 0);
}

export interface FatiaCategoria {
  name: string;
  value: number;
  cor: string;
}

export function agruparPorCategoria(
  lancamentos: Lancamento[],
  tipo: Tipo,
  categorias: Categoria[]
): FatiaCategoria[] {
  const map: Record<string, number> = {};
  for (const l of lancamentos) {
    if (l.tipo !== tipo) continue;
    map[l.categoria] = (map[l.categoria] || 0) + l.valor;
  }
  return categorias
    .map((c) => ({ name: c.nome, value: map[c.nome] || 0, cor: c.cor }))
    .filter((c) => c.value > 0);
}

export interface BarraMes {
  mes: string;
  sobra: number;
}

export function calcularBalancoAnual(
  lancamentos: Lancamento[],
  ano: number,
  meses: string[]
): BarraMes[] {
  return meses.map((nome, i) => {
    const ls = filtrarPorMes(lancamentos, i, ano);
    const sobra = somarPorTipo(ls, "entrada") - somarPorTipo(ls, "saida");
    return { mes: nome.slice(0, 3), sobra };
  });
}

// Retorna a data local no formato YYYY-MM-DD.
// Evita o bug de fuso de `new Date().toISOString().slice(0,10)`, que devolve
// o dia em UTC e gera o dia seguinte para usuários em UTC- após ~21h.
export function hojeLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
