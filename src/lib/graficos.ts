import { MESES } from "../types";

// Textos dos balões dos gráficos, fora do componente para serem testados sem
// desenhar o gráfico (o jsdom não calcula tamanho, e o recharts não desenha
// nada sem tamanho).

// "Jun" → "Junho", para o título do balão do gráfico do ano.
export function mesPorExtenso(abrev: string): string {
  return MESES.find((m) => m.startsWith(abrev)) ?? abrev;
}

// O balão do gráfico do ano diz "Sobrou R$ 1.200,00" ou "Faltou R$ 9.000,00"
// — em vez do nome do campo ("sobra") e de um valor negativo para decifrar.
// O valor vai sempre positivo: quem diz o sinal é a palavra.
export function itemDoBalaoAnual(
  sobra: number,
  dinheiro: (v: number) => string
): [string, string] {
  return [dinheiro(Math.abs(sobra)), sobra < 0 ? "Faltou" : "Sobrou"];
}
