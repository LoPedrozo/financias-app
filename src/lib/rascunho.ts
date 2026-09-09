// O que estava escrito no Adicionar, guardado no próprio aparelho.
//
// O Safari do iPhone descarrega a aba quando você troca de app — e trocar de
// app no meio é o caso normal aqui: você vai no WhatsApp copiar a lista e
// volta. Sem isto, voltar significava reescrever tudo.
//
// Fica só no aparelho, de propósito: é texto meio digitado, não é lançamento.
// Some sozinho assim que a leva entra.

const CHAVE = "financas:rascunho-adicionar";

// Em aba anônima, com dados de site bloqueados, ou em WebView restrita, o
// simples acesso a localStorage lança. Rascunho é conveniência: se não der
// para guardar, o app segue sem ele — nunca quebrando a tela.
interface ArmazemLike {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

function armazemPadrao(): ArmazemLike | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function lerRascunho(armazem = armazemPadrao()): string {
  try {
    return armazem?.getItem(CHAVE) ?? "";
  } catch {
    return "";
  }
}

export function salvarRascunho(texto: string, armazem = armazemPadrao()): void {
  try {
    if (texto.trim()) armazem?.setItem(CHAVE, texto);
    else armazem?.removeItem(CHAVE);
  } catch {
    // Cota estourada ou escrita bloqueada: sem rascunho, e sem barulho.
  }
}

export function limparRascunho(armazem = armazemPadrao()): void {
  try {
    armazem?.removeItem(CHAVE);
  } catch {
    // idem
  }
}
