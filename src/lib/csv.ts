import type { Lancamento } from "../types";

// Exportação dos lançamentos para planilha.
//
// Decisões que parecem detalhe e decidem se o arquivo abre bonito ou vira
// sopa de letras no Excel brasileiro:
//
// - separador é ponto e vírgula, não vírgula. No Brasil o Excel usa a vírgula
//   como decimal, então um CSV separado por vírgula cai todo numa coluna só.
// - valor sai com vírgula decimal, para a planilha reconhecer como número e
//   somar. Com ponto, vira texto.
// - o arquivo começa com BOM. Sem ele, o Excel lê UTF-8 como Latin-1 e
//   "Alimentação" aparece como "AlimentaÃ§Ã£o".
//
// A data vai em ISO (2026-11-03), que ordena certo como texto e é entendida
// tanto pelo Excel quanto pelo Google Planilhas.

const SEPARADOR = ";";
const BOM = "﻿";

const COLUNAS = [
  "Data",
  "Tipo",
  "Descrição",
  "Categoria",
  "Valor",
  "Valor com sinal",
] as const;

// Campo que contém o separador, aspas ou quebra de linha precisa vir entre
// aspas, e as aspas de dentro dobram. É o que impede uma descrição como
// `almoço; cerveja` de virar duas colunas.
function escapar(valor: string): string {
  if (!/[";\r\n]/.test(valor)) return valor;
  return `"${valor.replace(/"/g, '""')}"`;
}

function decimalBr(valor: number): string {
  return valor.toFixed(2).replace(".", ",");
}

export function gerarCsv(lancamentos: Lancamento[]): string {
  // Mais antigo primeiro: é como se lê um extrato, e é a ordem que a planilha
  // vai querer para somar acumulado. Empate de data cai para a descrição, só
  // para a saída ser estável entre exportações.
  const ordenados = [...lancamentos].sort((a, b) => {
    const dataA = a.data ?? `${a.ano}-${String(a.mes + 1).padStart(2, "0")}-01`;
    const dataB = b.data ?? `${b.ano}-${String(b.mes + 1).padStart(2, "0")}-01`;
    return dataA.localeCompare(dataB) || a.descricao.localeCompare(b.descricao);
  });

  const linhas = ordenados.map((l) => {
    const data =
      l.data ?? `${l.ano}-${String(l.mes + 1).padStart(2, "0")}-01`;
    // Duas colunas de valor de propósito: a positiva para somar por
    // categoria, e a com sinal para somar a coluna inteira e achar o saldo
    // sem escrever fórmula com condição.
    const comSinal = l.tipo === "entrada" ? l.valor : -l.valor;
    return [
      data,
      l.tipo === "entrada" ? "Entrada" : "Saída",
      escapar(l.descricao),
      escapar(l.categoria),
      decimalBr(l.valor),
      decimalBr(comSinal),
    ].join(SEPARADOR);
  });

  return BOM + [COLUNAS.join(SEPARADOR), ...linhas].join("\r\n") + "\r\n";
}

export function nomeDoArquivo(hoje: string): string {
  return `financas-${hoje}.csv`;
}
