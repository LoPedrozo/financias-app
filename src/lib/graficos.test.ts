import { describe, expect, it } from "vitest";
import { itemDoBalaoAnual, mesPorExtenso } from "./graficos";
import { brl } from "./format";

describe("balão do gráfico do ano", () => {
  it("diz Sobrou ou Faltou, com o valor sem sinal", () => {
    expect(itemDoBalaoAnual(1200, brl)).toEqual([brl(1200), "Sobrou"]);
    expect(itemDoBalaoAnual(-9000, brl)).toEqual([brl(9000), "Faltou"]);
    expect(itemDoBalaoAnual(0, brl)).toEqual([brl(0), "Sobrou"]);
  });

  it("com valores escondidos, o valor continua mascarado", () => {
    const oculto = () => "R$ •••••";
    expect(itemDoBalaoAnual(-9000, oculto)).toEqual(["R$ •••••", "Faltou"]);
  });

  it("escreve o mês por extenso no título", () => {
    expect(mesPorExtenso("Jan")).toBe("Janeiro");
    expect(mesPorExtenso("Jun")).toBe("Junho");
    expect(mesPorExtenso("Jul")).toBe("Julho");
    expect(mesPorExtenso("Mar")).toBe("Março");
    expect(mesPorExtenso("Mai")).toBe("Maio");
    expect(mesPorExtenso("???")).toBe("???");
  });
});
