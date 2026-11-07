// Preferências de aparência e de uso, guardadas no próprio aparelho.
//
// Ficam no localStorage, e não no banco, de propósito: são sobre este
// celular — o tema que combina com ele, se você costuma abrir o app em
// público. Também não precisam de migração nem de rede para valer na hora.
//
// Tudo aqui tolera dado velho ou quebrado: um campo inválido volta ao padrão
// sozinho, sem levar os outros junto. Preferência é conveniência, e nunca pode
// ser o motivo de o app não abrir.

export type Tema = "auto" | "claro" | "escuro";
export type Destaque = "dourado" | "laranja" | "azul" | "petroleo" | "roxo" | "rosa" | "grafite";

export interface Preferencias {
  tema: Tema;
  destaque: Destaque;
  ocultarValores: boolean;
  listaCompacta: boolean;
}

export const PADRAO: Preferencias = {
  tema: "auto",
  destaque: "dourado",
  ocultarValores: false,
  listaCompacta: false,
};

// O script de index.html lê esta mesma chave antes do React existir. Um teste
// garante que os dois continuam combinando.
export const CHAVE_PREFERENCIAS = "financas:preferencias";

// As cores são também declaradas no global.css — aqui servem para desenhar as
// amostras no seletor. Um teste compara as duas fontes.
//
// Sem verde nem vermelho de propósito: no app, verde é entrada e vermelho é
// saída. Um botão de lançar verde passaria a dizer "entrada" sem querer.
export const DESTAQUES: Array<{
  id: Destaque;
  nome: string;
  claro: string;
  escuro: string;
}> = [
  { id: "dourado", nome: "Dourado", claro: "#c9a86a", escuro: "#d8bb81" },
  { id: "laranja", nome: "Laranja", claro: "#df7620", escuro: "#ee9953" },
  { id: "azul", nome: "Azul", claro: "#4a7fc1", escuro: "#6f9bd6" },
  { id: "petroleo", nome: "Azul-petróleo", claro: "#266d82", escuro: "#59a8c0" },
  { id: "roxo", nome: "Roxo", claro: "#8467c4", escuro: "#a28ae0" },
  { id: "rosa", nome: "Rosa", claro: "#c2649a", escuro: "#d886b4" },
  { id: "grafite", nome: "Grafite", claro: "#5b6475", escuro: "#8a93a3" },
];

const TEMAS: Tema[] = ["auto", "claro", "escuro"];

interface ArmazemLike {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

// Em aba anônima ou com dados de site bloqueados, só tocar no localStorage já
// lança — o mesmo cuidado do rascunho.
function armazemPadrao(): ArmazemLike | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function lerPreferencias(armazem = armazemPadrao()): Preferencias {
  let bruto: unknown = null;
  try {
    bruto = JSON.parse(armazem?.getItem(CHAVE_PREFERENCIAS) ?? "null");
  } catch {
    return { ...PADRAO };
  }
  if (!bruto || typeof bruto !== "object") return { ...PADRAO };

  const p = bruto as Record<string, unknown>;
  return {
    tema: TEMAS.includes(p.tema as Tema) ? (p.tema as Tema) : PADRAO.tema,
    destaque: DESTAQUES.some((d) => d.id === p.destaque)
      ? (p.destaque as Destaque)
      : PADRAO.destaque,
    ocultarValores:
      typeof p.ocultarValores === "boolean"
        ? p.ocultarValores
        : PADRAO.ocultarValores,
    listaCompacta:
      typeof p.listaCompacta === "boolean"
        ? p.listaCompacta
        : PADRAO.listaCompacta,
  };
}

export function salvarPreferencias(
  preferencias: Preferencias,
  armazem = armazemPadrao()
): void {
  try {
    armazem?.setItem(CHAVE_PREFERENCIAS, JSON.stringify(preferencias));
  } catch {
    // Cota estourada ou escrita bloqueada: vale até fechar o app, e só.
  }
}

export function temaEfetivo(
  tema: Tema,
  sistemaEscuro: boolean
): "claro" | "escuro" {
  if (tema === "auto") return sistemaEscuro ? "escuro" : "claro";
  return tema;
}

// O CSS inteiro decide cor por estes atributos no <html>. Lista normal e
// destaque padrão tiram o atributo em vez de gravar o valor padrão, para o
// documento sem preferência nenhuma ser idêntico ao de antes desta feature.
export function aplicarNoDocumento(
  preferencias: Preferencias,
  sistemaEscuro: boolean,
  raiz: HTMLElement = document.documentElement
): void {
  raiz.setAttribute(
    "data-tema",
    temaEfetivo(preferencias.tema, sistemaEscuro)
  );

  if (preferencias.destaque === "dourado") raiz.removeAttribute("data-destaque");
  else raiz.setAttribute("data-destaque", preferencias.destaque);

  if (preferencias.listaCompacta) raiz.setAttribute("data-lista", "compacta");
  else raiz.removeAttribute("data-lista");
}

export const VALOR_OCULTO = "R$ •••••";
