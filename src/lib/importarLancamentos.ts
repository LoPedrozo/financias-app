import type { NovoLancamento, Tipo } from "../types";
import { lerValor } from "./format";
import {
  CATEGORIA_PADRAO,
  adivinharCategoria,
  adivinharTipo,
} from "./categorias";

// Lê lançamentos escritos como texto corrido — uma linha por lançamento:
//
//   Contas de outubro 05/10:
//   cartão de crédito 1.900
//   almoço 25
//   + mesada 500
//   12/10 internet 120
//   Total = 2.545
//
// A gramática de cada linha é:
//
//   [+|-]  [DD/MM[/AA]]  descrição  valor
//
// Nada é obrigatório além da descrição e do valor, e o valor tanto pode vir no
// fim ("almoço 25") quanto no começo ("25 almoço") — a segunda forma é a que
// sai mais rápido digitando no celular.
//
// Regras de quem manda no quê:
// - "+" na frente é entrada, "-" é saída, e sem sinal o padrão é saída. Só
//   quando não há sinal a descrição pode desempatar (ver adivinharTipo).
// - a data da linha vence a data do cabeçalho, que vence a data padrão.
// - a linha "Total = X" nunca vira lançamento: serve de conferência.
// - a linha terminada em ":" é cabeçalho, nunca lançamento — é dela que sai a
//   data do bloco.

export interface LinhaLida {
  tipo: Tipo;
  valor: number;
  descricao: string;
  categoria: string;
  data: string; // ISO YYYY-MM-DD
  /** O "+" ou "-" veio escrito, em vez de deduzido da descrição. */
  tipoExplicito: boolean;
  /** A data saiu da linha ou do cabeçalho, em vez da data padrão. */
  dataExplicita: boolean;
  /** A categoria veio de uma palavra reconhecida, e não do "Outros". */
  categoriaReconhecida: boolean;
}

export interface LeituraLancamentos {
  itens: LinhaLida[];
  /** Valor da linha "Total = X", se houver. Para conferir, não para somar. */
  totalInformado: number | null;
  /** Linhas que não deram para interpretar, para o usuário ver o que ficou de fora. */
  ignoradas: string[];
}

const LINHA_TOTAL = /^(total|soma|somat[óo]rio)\b/i;
const MARCADOR = /^[•‣▪●*]+\s*/;
const SINAL = /^([+-])\s*/;
const DATA_NA_FRENTE = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?=\s|$)/;
const DATA_SOLTA = /(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?/g;

// Descrição que termina em "05/" ou "05." denuncia que o valor encontrado
// logo depois é, na verdade, a segunda metade de uma data.
//
// Sem isto, "Contas de outubro 05/10" virava um lançamento de R$ 10 chamado
// "Contas de outubro 05/", e a data do bloco se perdia junto — a leva de
// outubro inteira caía no mês que estava na tela, sem nada em `ignoradas`.
//
// O teste é na descrição, e não na linha toda, porque "almoço 25.10" é vinte
// e cinco e dez: ali o valor casa inteiro ("25.10") e a descrição termina em
// letra, não em separador de data.
const RESTO_DE_DATA = /\d{1,2}[/.]$/;

// Valor ancorado no fim, com separador e "R$" opcionais. A descrição é preguiçosa
// para que hífens no meio ("Salário de bom filho - 500") não confundam o corte.
const VALOR_NO_FIM = /^(.*?)[\s\-–—:=]*R?\$?\s*([\d][\d.,]*)\s*$/;
// Valor na frente. Exige separador depois do número para que "1.900" sozinho
// não vire um lançamento sem descrição.
const VALOR_NA_FRENTE = /^R?\$?\s*([\d][\d.,]*)[\s\-–—:=]+(.+)$/;

function anoDe(bruto: string | undefined, padrao: number): number {
  if (!bruto) return padrao;
  const n = Number(bruto);
  return n < 100 ? 2000 + n : n;
}

// Devolve null para data que não existe: "12/24 parcelas" tem mês 24 e precisa
// continuar sendo descrição, não virar vencimento.
function montarData(dia: number, mes: number, ano: number): string | null {
  if (!Number.isFinite(ano) || mes < 1 || mes > 12) return null;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  if (dia < 1 || dia > ultimoDia) return null;
  const mm = String(mes).padStart(2, "0");
  const dd = String(dia).padStart(2, "0");
  return `${ano}-${mm}-${dd}`;
}

// A primeira data que existe de verdade. Varre todas as ocorrências porque a
// primeira que casa pode ser lixo: em "Contas 1.900 de outubro 05/10" o
// padrão casa "1.90" antes, e mês 90 não existe.
function primeiraDataValida(texto: string, anoPadrao: number): string | null {
  DATA_SOLTA.lastIndex = 0;
  let achado: RegExpExecArray | null;
  while ((achado = DATA_SOLTA.exec(texto)) !== null) {
    const data = montarData(
      Number(achado[1]),
      Number(achado[2]),
      anoDe(achado[3], anoPadrao)
    );
    if (data) {
      DATA_SOLTA.lastIndex = 0;
      return data;
    }
  }
  return null;
}

function limparDescricao(bruta: string): string {
  return bruta
    .replace(/^[\s\-–—:=*]+/, "")
    .replace(/[\s\-–—:=*]+$/, "")
    .trim();
}

interface ValorEDescricao {
  valor: number;
  descricao: string;
}

function extrairValor(linha: string): ValorEDescricao | null {
  const fim = linha.match(VALOR_NO_FIM);
  if (fim && !RESTO_DE_DATA.test(fim[1])) {
    const valor = lerValor(fim[2]);
    const descricao = limparDescricao(fim[1]);
    if (valor !== null && descricao.length >= 2) return { valor, descricao };
  }
  const frente = linha.match(VALOR_NA_FRENTE);
  if (frente) {
    const valor = lerValor(frente[1]);
    const descricao = limparDescricao(frente[2]);
    if (valor !== null && descricao.length >= 2) return { valor, descricao };
  }
  return null;
}

export function interpretarLancamentos(
  texto: string,
  dataPadrao: string
): LeituraLancamentos {
  const itens: LinhaLida[] = [];
  const ignoradas: string[] = [];
  let totalInformado: number | null = null;
  let dataDoBloco: string | null = null;

  const anoPadrao = Number(dataPadrao.slice(0, 4)) || new Date().getFullYear();

  for (const bruta of texto.split(/\r?\n/)) {
    const original = bruta.trim();
    if (!original) continue;

    let linha = original.replace(MARCADOR, "").trim();

    const sinal = linha.match(SINAL);
    if (sinal) linha = linha.slice(sinal[0].length).trim();

    if (LINHA_TOTAL.test(linha)) {
      const conferencia = extrairValor(linha);
      if (conferencia) totalInformado = conferencia.valor;
      continue;
    }

    let dataDaLinha: string | null = null;
    const naFrente = linha.match(DATA_NA_FRENTE);
    if (naFrente) {
      dataDaLinha = montarData(
        Number(naFrente[1]),
        Number(naFrente[2]),
        anoDe(naFrente[3], anoPadrao)
      );
      if (dataDaLinha) linha = linha.slice(naFrente[0].length).trim();
    }

    const ehCabecalho = linha.endsWith(":");
    const lido = ehCabecalho ? null : extrairValor(linha);

    if (!lido) {
      // Sem valor, a linha só interessa pela data que carrega — é o cabeçalho
      // "Contas a Pagar 05/08:" mandando na leva inteira que vem abaixo.
      const doCabecalho = primeiraDataValida(linha, anoPadrao);
      if (dataDaLinha || doCabecalho) {
        dataDoBloco = dataDaLinha ?? doCabecalho;
      } else {
        ignoradas.push(original);
      }
      continue;
    }

    const tipo: Tipo = sinal
      ? sinal[1] === "+"
        ? "entrada"
        : "saida"
      : (adivinharTipo(lido.descricao) ?? "saida");

    const categoria = adivinharCategoria(lido.descricao, tipo);
    const data = dataDaLinha ?? dataDoBloco ?? dataPadrao;

    itens.push({
      tipo,
      valor: lido.valor,
      descricao: lido.descricao.slice(0, 120),
      categoria: categoria ?? CATEGORIA_PADRAO,
      data,
      tipoExplicito: !!sinal,
      dataExplicita: dataDaLinha !== null || dataDoBloco !== null,
      categoriaReconhecida: categoria !== null,
    });
  }

  return { itens, totalInformado, ignoradas };
}

/** Atalho para o caso de uma linha só — o lançamento rápido. */
export function interpretarLinha(
  linha: string,
  dataPadrao: string
): LinhaLida | null {
  return interpretarLancamentos(linha, dataPadrao).itens[0] ?? null;
}

// A competência sai da data, e não do mês que a tela está mostrando: colar
// "12/10 internet 120" enquanto se olha setembro tem que gravar em outubro.
export function paraLancamento(linha: LinhaLida): NovoLancamento {
  return {
    tipo: linha.tipo,
    valor: linha.valor,
    descricao: linha.descricao,
    categoria: linha.categoria,
    mes: Number(linha.data.slice(5, 7)) - 1,
    ano: Number(linha.data.slice(0, 4)),
    data: linha.data,
  };
}

export function somarLinhas(linhas: LinhaLida[]): number {
  const total = linhas.reduce(
    (s, l) => s + (l.tipo === "entrada" ? l.valor : -l.valor),
    0
  );
  return Math.round(total * 100) / 100;
}
