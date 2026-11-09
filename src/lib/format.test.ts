import { describe, expect, it } from "vitest";
import { erroDoValor } from "./format";

// O campo de valor dos formulários lê como o resto do app (lerValor).
describe("erroDoValor", () => {
  it("aceita o que se escreve no Brasil, com e sem milhar", () => {
    for (const v of ["10", "10,5", "10,50", "10.50", "1.234,56", "1.900", "1234,56", " 35,90 "]) {
      expect(erroDoValor(v), v).toBeNull();
    }
  });

  it("recusa vazio, zero, texto e mais de dois dígitos depois da vírgula", () => {
    expect(erroDoValor("")).toBe("Informe um valor numérico maior que zero.");
    expect(erroDoValor("0")).toBe("Informe um valor numérico maior que zero.");
    expect(erroDoValor("0,00")).toBe("Informe um valor numérico maior que zero.");
    expect(erroDoValor("10,505")).toBe("Formato inválido. Use ex: 10,50 ou 1.234,50");
    expect(erroDoValor("1,2,3")).toBe("Formato inválido. Use ex: 10,50 ou 1.234,50");
    expect(erroDoValor("dez")).toBe("Formato inválido. Use ex: 10,50 ou 1.234,50");
  });

  it("barra o valor absurdo", () => {
    expect(erroDoValor("2000000000")).toBe("Valor muito alto. Verifique se digitou corretamente.");
    expect(erroDoValor("1000000000")).toBeNull();
  });
});
