export const brl = (v: number): string =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Lê um valor escrito à mão, no formato brasileiro.
//
// A vírgula, quando existe, é sempre o decimal. Só com pontos, decide pelo
// tamanho do último grupo: "1.900" são mil e novecentos, "10.50" são dez e
// cinquenta. Devolve null para o que não é valor utilizável — vazio, texto,
// zero ou negativo.
//
// Mora aqui, e não no parser da lista colada onde nasceu, porque hoje três
// telas leem número digitado e nenhuma delas deve ter a sua própria regra.
export function lerValor(bruto: string): number | null {
  const limpo = bruto.trim().replace(/\s/g, "");
  if (!/^[\d.,]+$/.test(limpo) || !/\d/.test(limpo)) return null;

  let normalizado: string;
  if (limpo.includes(",")) {
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else {
    const partes = limpo.split(".");
    const ultima = partes[partes.length - 1];
    normalizado =
      partes.length > 1 && ultima.length !== 3
        ? partes.slice(0, -1).join("") + "." + ultima
        : partes.join("");
  }

  const valor = Number(normalizado);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return Math.round(valor * 100) / 100;
}

// Régua do gráfico do ano: "9 mil", "-4,5 mil", "1,2 mi". Os números crus
// ("9000", "-4500") eram difíceis de ler de relance e roubavam largura do
// gráfico. Uma casa decimal no máximo: é régua, não extrato.
export function formatarEixo(v: number): string {
  const abs = Math.abs(v);
  const curto = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (abs >= 1_000_000) return `${curto(v / 1_000_000)} mi`;
  if (abs >= 1_000) return `${curto(v / 1_000)} mil`;
  // "|| 0" troca o -0 (de -0,3 arredondado) por 0: "-0" na régua parece erro.
  return curto(Math.round(v) || 0);
}
