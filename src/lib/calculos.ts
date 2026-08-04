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
    .filter(isContabilizado)
    .filter((l) => l.tipo === tipo)
    .reduce((s, l) => s + l.valor, 0);
}

function isContabilizado(lancamento: Lancamento): boolean {
  if (!lancamento.data) return true;
  return lancamento.data <= hojeLocal();
}

export interface Competencia {
  mes: number; // 0-11
  ano: number;
}

// Ordena competências: negativo se `a` vem antes de `b`, 0 se são a mesma,
// positivo se `a` vem depois. Existe para que a comparação mês/ano viva em um
// lugar só — repeti-la à mão em cada chamador foi o que deixou passar a
// geração de recorrências em meses já fechados.
export function compararCompetencia(a: Competencia, b: Competencia): number {
  return a.ano - b.ano || a.mes - b.mes;
}

// Competência de hoje, derivada de hojeLocal() para herdar o tratamento de
// fuso em vez de repetir new Date().getMonth().
export function competenciaAtual(): Competencia {
  const hoje = hojeLocal();
  return { ano: Number(hoje.slice(0, 4)), mes: Number(hoje.slice(5, 7)) - 1 };
}

export function calcularSaldoAcumulado(
  lancamentos: Lancamento[],
  mes: number,
  ano: number
): number {
  return lancamentos
    .filter((l) => compararCompetencia(l, { mes, ano }) <= 0)
    .filter(isContabilizado)
    .reduce((s, l) => s + (l.tipo === "entrada" ? l.valor : -l.valor), 0);
}

export interface ResumoPendentes {
  entradas: { total: number; quantidade: number };
  saidas: { total: number; quantidade: number };
}

export function calcularPendentes(
  lancamentos: Lancamento[],
  mes: number,
  ano: number
): ResumoPendentes {
  const futuros = filtrarPorMes(lancamentos, mes, ano).filter(
    (l) => !isContabilizado(l)
  );
  const entradas = futuros.filter((l) => l.tipo === "entrada");
  const saidas = futuros.filter((l) => l.tipo === "saida");
  return {
    entradas: {
      total: entradas.reduce((s, l) => s + l.valor, 0),
      quantidade: entradas.length,
    },
    saidas: {
      total: saidas.reduce((s, l) => s + l.valor, 0),
      quantidade: saidas.length,
    },
  };
}

// Saldo previsto para o fim do mês: soma tudo que está lançado até a
// competência, tenha sido contabilizado ou não.
//
// A versão anterior somava `saldoAtual + pendentes do mês`, e esses dois
// recortes não são complementares — o saldo corta por tempo (data <= hoje) e
// os pendentes cortam por mês. Os meses entre hoje e a competência visitada
// caíam no vão dos dois, e o projetado de setembro repetia o de agosto.
export function calcularSaldoProjetado(
  lancamentos: Lancamento[],
  mes: number,
  ano: number
): number {
  return lancamentos
    .filter((l) => compararCompetencia(l, { mes, ano }) <= 0)
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
    if (!isContabilizado(l)) continue;
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
    const ls = lancamentos.filter(
      (l) => l.mes === i && l.ano === ano && isContabilizado(l)
    );
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
