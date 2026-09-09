import { describe, expect, it } from "vitest";
import { adivinharCategoria, adivinharTipo, normalizar } from "./categorias";
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA } from "../types";

describe("normalizar", () => {
  it("tira acento, caixa e pontuação", () => {
    expect(normalizar("Almoço no R.U.")).toBe("almoco no r u");
    expect(normalizar("CARTÃO — fatura")).toBe("cartao fatura");
  });
});

describe("adivinharCategoria", () => {
  it("acerta os gastos do dia a dia", () => {
    expect(adivinharCategoria("ifood", "saida")).toBe("Alimentação");
    expect(adivinharCategoria("uber pro centro", "saida")).toBe("Transporte");
    expect(adivinharCategoria("balada com os amigos", "saida")).toBe("Lazer");
    expect(adivinharCategoria("fatura do nubank", "saida")).toBe(
      "Cartão de Crédito / Contas"
    );
    expect(adivinharCategoria("conta de luz", "saida")).toBe("Casa");
  });

  it("acerta as entradas", () => {
    expect(adivinharCategoria("salário do mês", "entrada")).toBe("Salário");
    expect(adivinharCategoria("mesada do pai", "entrada")).toBe("Mesada");
    expect(adivinharCategoria("freela do site", "entrada")).toBe(
      "Freelance / Bico"
    );
  });

  it("casa palavra inteira, não pedaço de outra", () => {
    // "gas" não pode sair de "gasolina", nem "ru" de "rua".
    expect(adivinharCategoria("gasolina", "saida")).toBe("Transporte");
    expect(adivinharCategoria("almoço no ru", "saida")).toBe("Alimentação");
  });

  it("devolve null quando não reconhece", () => {
    expect(adivinharCategoria("xyzabc", "saida")).toBeNull();
  });

  it("só devolve categoria que existe na lista do tipo", () => {
    const saidas = CATEGORIAS_SAIDA.map((c) => c.nome);
    const entradas = CATEGORIAS_ENTRADA.map((c) => c.nome);
    for (const texto of ["ifood", "uber", "netflix", "cartão", "aluguel"]) {
      expect(saidas).toContain(adivinharCategoria(texto, "saida"));
    }
    for (const texto of ["salário", "mesada", "venda", "bolsa"]) {
      expect(entradas).toContain(adivinharCategoria(texto, "entrada"));
    }
  });
});

describe("adivinharTipo", () => {
  it("reconhece dinheiro entrando sem precisar do +", () => {
    expect(adivinharTipo("salário")).toBe("entrada");
    expect(adivinharTipo("reembolso do plano")).toBe("entrada");
    expect(adivinharTipo("vendi o monitor")).toBe("entrada");
  });

  it("cala a boca quando a palavra é ambígua", () => {
    // Comprar uma bolsa e dar um presente são saídas; deixar passar como
    // entrada estragaria o saldo em silêncio.
    expect(adivinharTipo("bolsa")).toBeNull();
    expect(adivinharTipo("presente")).toBeNull();
    expect(adivinharTipo("almoço")).toBeNull();
  });
});
