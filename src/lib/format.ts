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

/** Acima disto é quase certo um dedo a mais. */
const VALOR_MAXIMO = 1_000_000_000;

// O erro do campo de valor de um formulário, ou null se o valor serve. Lê
// com o lerValor, como a lista colada e a correção na lista: antes o
// formulário tinha regra própria e recusava "1.234,56", que o resto do app
// aceita. Mais de dois dígitos depois da vírgula continua recusado — não é
// dinheiro, é engano.
export function erroDoValor(bruto: string): string | null {
  const limpo = bruto.trim();
  if (!limpo) return "Informe um valor numérico maior que zero.";
  const valor = lerValor(limpo);
  const naoENumero = !/^[\d.,\s]+$/.test(limpo) || /,\d{3,}$/.test(limpo);
  if (naoENumero || (valor === null && /[1-9]/.test(limpo))) {
    return "Formato inválido. Use ex: 10,50 ou 1.234,50";
  }
  if (valor === null) return "Informe um valor numérico maior que zero.";
  if (valor > VALOR_MAXIMO) return "Valor muito alto. Verifique se digitou corretamente.";
  return null;
}
