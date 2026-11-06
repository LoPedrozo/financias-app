import { describe, expect, it } from "vitest";
import { formatarEixo } from "./format";

describe("formatarEixo", () => {
  it("abrevia milhares e milhões, com vírgula e uma casa no máximo", () => {
    expect(formatarEixo(9000)).toBe("9 mil");
    expect(formatarEixo(-4500)).toBe("-4,5 mil");
    expect(formatarEixo(1250)).toBe("1,3 mil");
    expect(formatarEixo(1_200_000)).toBe("1,2 mi");
    expect(formatarEixo(-2_000_000)).toBe("-2 mi");
  });

  it("abaixo de mil fica o número inteiro", () => {
    expect(formatarEixo(0)).toBe("0");
    expect(formatarEixo(500)).toBe("500");
    expect(formatarEixo(-750.4)).toBe("-750");
    expect(formatarEixo(-0.3)).toBe("0");
  });
});
