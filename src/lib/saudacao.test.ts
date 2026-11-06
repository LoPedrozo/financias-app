import { describe, expect, it } from "vitest";
import { dataCurta, periodoDoDia, primeiroNome, saudacao } from "./saudacao";

const as = (h: number, min = 0) => new Date(2026, 10, 6, h, min);

describe("periodoDoDia", () => {
  it("vira nas fronteiras certas", () => {
    expect(periodoDoDia(as(4, 59))).toBe("noite");
    expect(periodoDoDia(as(5, 0))).toBe("manha");
    expect(periodoDoDia(as(11, 59))).toBe("manha");
    expect(periodoDoDia(as(12, 0))).toBe("tarde");
    expect(periodoDoDia(as(17, 59))).toBe("tarde");
    expect(periodoDoDia(as(18, 0))).toBe("noite");
    expect(periodoDoDia(as(0, 30))).toBe("noite");
  });

  it("cobre as 24 horas sem buraco", () => {
    for (let h = 0; h < 24; h++) {
      expect(["manha", "tarde", "noite"]).toContain(periodoDoDia(as(h)));
    }
  });
});

describe("saudacao", () => {
  it("com e sem nome", () => {
    expect(saudacao("manha", "Lorenzo")).toBe("Bom dia, Lorenzo");
    expect(saudacao("tarde", "Lorenzo")).toBe("Boa tarde, Lorenzo");
    expect(saudacao("noite", null)).toBe("Boa noite");
  });
});

describe("dataCurta", () => {
  it("dia da semana, dia, mês abreviado e ano", () => {
    expect(dataCurta(new Date(2026, 10, 6))).toBe("Sexta, 6 nov 2026");
    expect(dataCurta(new Date(2026, 1, 1))).toBe("Domingo, 1 fev 2026");
    expect(dataCurta(new Date(2027, 2, 14))).toBe("Domingo, 14 mar 2027");
  });
});

describe("primeiroNome", () => {
  it("prefere o given_name do Google", () => {
    expect(primeiroNome({ given_name: "Lorenzo", full_name: "Outro Nome" })).toBe("Lorenzo");
  });

  it("cai para o primeiro nome do full_name e do name", () => {
    expect(primeiroNome({ full_name: "  Lorenzo  Pedrozo " })).toBe("Lorenzo");
    expect(primeiroNome({ name: "Lorenzo Pedrozo" })).toBe("Lorenzo");
  });

  it("não chama ninguém pelo e-mail nem por lixo", () => {
    expect(primeiroNome({ name: "alguem@gmail.com" })).toBeNull();
    expect(primeiroNome({ full_name: "   " })).toBeNull();
    expect(primeiroNome({ full_name: 42 })).toBeNull();
    expect(primeiroNome({})).toBeNull();
    expect(primeiroNome(undefined)).toBeNull();
    expect(primeiroNome(null)).toBeNull();
  });
});
