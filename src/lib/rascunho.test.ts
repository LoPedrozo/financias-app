import { describe, expect, it } from "vitest";
import { lerRascunho, limparRascunho, salvarRascunho } from "./rascunho";

function armazemFalso() {
  const dados = new Map<string, string>();
  return {
    dados,
    getItem: (c: string) => dados.get(c) ?? null,
    setItem: (c: string, v: string) => void dados.set(c, v),
    removeItem: (c: string) => void dados.delete(c),
  };
}

const armazemQueExplode = {
  getItem() {
    throw new Error("acesso bloqueado");
  },
  setItem() {
    throw new Error("cota estourada");
  },
  removeItem() {
    throw new Error("acesso bloqueado");
  },
};

describe("rascunho", () => {
  it("guarda e devolve o texto", () => {
    const a = armazemFalso();
    salvarRascunho("almoço 25", a);
    expect(lerRascunho(a)).toBe("almoço 25");
  });

  it("texto vazio apaga em vez de guardar vazio", () => {
    const a = armazemFalso();
    salvarRascunho("almoço 25", a);
    salvarRascunho("   ", a);
    expect(lerRascunho(a)).toBe("");
    expect(a.dados.size).toBe(0);
  });

  it("limpar apaga", () => {
    const a = armazemFalso();
    salvarRascunho("almoço 25", a);
    limparRascunho(a);
    expect(lerRascunho(a)).toBe("");
  });

  it("armazenamento indisponível não derruba nada", () => {
    // Aba anônima e dados de site bloqueados fazem o próprio acesso lançar.
    expect(() => salvarRascunho("x", armazemQueExplode)).not.toThrow();
    expect(() => limparRascunho(armazemQueExplode)).not.toThrow();
    expect(lerRascunho(armazemQueExplode)).toBe("");
  });

  it("sem armazém nenhum, segue em silêncio", () => {
    expect(() => salvarRascunho("x", null)).not.toThrow();
    expect(lerRascunho(null)).toBe("");
  });
});
