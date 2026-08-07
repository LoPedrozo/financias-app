// Interpreta a lista de contas como ela chega no WhatsApp:
//
//   Contas a Pagar 05/08:
//   Cartão crédito - 1.900
//   Salário de bom filho - 500
//   Estacionamento - 150
//   Total = 6.200
//
// A linha de total NÃO vira conta — ela vira conferência. Somar o total junto
// com os itens era o que dobrava o valor da pilha quando o usuário lançava um
// card "Total de Tudo" à mão.

export interface ContaLida {
  descricao: string;
  valor: number;
}

export interface ListaLida {
  itens: ContaLida[];
  /** Valor da linha "Total = X", se houver. Serve para conferir, não para somar. */
  totalInformado: number | null;
  /** Data encontrada no texto (ISO), normalmente no cabeçalho. */
  vencimentoDetectado: string | null;
  /** Linhas que não deram para interpretar, para o usuário ver o que ficou de fora. */
  ignoradas: string[];
}

const LINHA_TOTAL = /^\s*(total|soma|somat[óo]rio)\b/i;

// Descrição + valor no fim da linha, com separador opcional (- – : =) e um
// "R$" opcional. O valor é capturado ancorado no fim para que hífens dentro da
// descrição ("Salário de bom filho - 500") não confundam a divisão.
const LINHA_ITEM = /^(.*?)[\s\-–—:=]*R?\$?\s*([\d][\d.,]*)\s*$/;

const DATA_CURTA = /\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/;

// Converte número no formato brasileiro. A vírgula, quando existe, é sempre o
// decimal. Só com pontos, decide pelo tamanho do último grupo: "1.900" são mil
// e novecentos, "10.50" são dez e cinquenta.
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

function lerData(texto: string, anoPadrao: number): string | null {
  const achou = texto.match(DATA_CURTA);
  if (!achou) return null;

  const dia = Number(achou[1]);
  const mes = Number(achou[2]);
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;

  let ano = anoPadrao;
  if (achou[3]) {
    const bruto = Number(achou[3]);
    ano = bruto < 100 ? 2000 + bruto : bruto;
  }

  const mm = String(mes).padStart(2, "0");
  const dd = String(dia).padStart(2, "0");
  return `${ano}-${mm}-${dd}`;
}

export function interpretarLista(texto: string, anoPadrao: number): ListaLida {
  const itens: ContaLida[] = [];
  const ignoradas: string[] = [];
  let totalInformado: number | null = null;
  let vencimentoDetectado: string | null = null;

  for (const linhaBruta of texto.split(/\r?\n/)) {
    const linha = linhaBruta.trim();
    if (!linha) continue;

    // O cabeçalho costuma trazer a data da leva; guardamos e seguimos.
    if (!vencimentoDetectado) {
      const data = lerData(linha, anoPadrao);
      // Só aceita como data do cabeçalho se a linha não for um item — senão
      // "Cartão 12/24 parcelas" viraria vencimento.
      if (data && !LINHA_ITEM.test(linha.replace(DATA_CURTA, ""))) {
        vencimentoDetectado = data;
      }
    }

    const casou = linha.match(LINHA_ITEM);
    const valor = casou ? lerValor(casou[2]) : null;

    if (LINHA_TOTAL.test(linha)) {
      if (valor !== null) totalInformado = valor;
      continue;
    }

    const descricao = casou ? casou[1].trim().replace(/[\s\-–—:=]+$/, "") : "";
    if (valor === null || descricao.length < 2) {
      // Cabeçalhos e linhas soltas caem aqui; o usuário vê o que ficou fora.
      if (!vencimentoDetectado || lerData(linha, anoPadrao) === null) {
        ignoradas.push(linha);
      }
      continue;
    }

    itens.push({ descricao: descricao.slice(0, 120), valor });
  }

  return { itens, totalInformado, vencimentoDetectado, ignoradas };
}

export function somar(itens: ContaLida[]): number {
  return Math.round(itens.reduce((s, i) => s + i.valor, 0) * 100) / 100;
}
