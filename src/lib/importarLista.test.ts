import { describe, expect, it } from "vitest";
import { interpretarLista, lerValor, somar } from "./importarLista";

describe("lerValor", () => {
  it("trata ponto como milhar quando o último grupo tem 3 dígitos", () => {
    expect(lerValor("1.900")).toBe(1900);
    expect(lerValor("2.800")).toBe(2800);
  });

  it("trata ponto como decimal quando o último grupo não tem 3 dígitos", () => {
    expect(lerValor("10.50")).toBe(10.5);
    expect(lerValor("0.5")).toBe(0.5);
  });

  it("a vírgula sempre manda como decimal", () => {
    expect(lerValor("1.900,50")).toBe(1900.5);
    expect(lerValor("35,90")).toBe(35.9);
  });

  it("recusa o que não é valor", () => {
    expect(lerValor("")).toBeNull();
    expect(lerValor("abc")).toBeNull();
    expect(lerValor("0")).toBeNull();
  });
});

describe("interpretarLista", () => {
  const whatsapp = `Contas a Pagar 05/08:
Cartão crédito - 1.900
Salário de bom filho - 500
Estacionamento - 150
Empréstimo - 2800
Cartão Renner - 800
Total = 6.200`;

  it("lê a lista do WhatsApp item a item", () => {
    const lida = interpretarLista(whatsapp, 2026);
    expect(lida.itens).toEqual([
      { descricao: "Cartão crédito", valor: 1900 },
      { descricao: "Salário de bom filho", valor: 500 },
      { descricao: "Estacionamento", valor: 150 },
      { descricao: "Empréstimo", valor: 2800 },
      { descricao: "Cartão Renner", valor: 800 },
    ]);
  });

  it("não transforma a linha de total em conta", () => {
    const lida = interpretarLista(whatsapp, 2026);
    expect(lida.itens.some((i) => /total/i.test(i.descricao))).toBe(false);
    expect(lida.totalInformado).toBe(6200);
  });

  it("expõe a divergência entre o total informado e a soma dos itens", () => {
    const lida = interpretarLista(whatsapp, 2026);
    // O caso real do usuário: o total do WhatsApp estava R$ 50 acima.
    expect(somar(lida.itens)).toBe(6150);
    expect(lida.totalInformado).toBe(6200);
  });

  it("pega a data do cabeçalho como vencimento sugerido", () => {
    expect(interpretarLista(whatsapp, 2026).vencimentoDetectado).toBe(
      "2026-08-05"
    );
  });

  it("mantém hífens que fazem parte da descrição", () => {
    const lida = interpretarLista("Conta de luz - agosto - 200", 2026);
    expect(lida.itens).toEqual([
      { descricao: "Conta de luz - agosto", valor: 200 },
    ]);
  });

  it("aceita R$ e valor sem separador", () => {
    const lida = interpretarLista("Internet R$ 129,90\nÁgua 80", 2026);
    expect(lida.itens).toEqual([
      { descricao: "Internet", valor: 129.9 },
      { descricao: "Água", valor: 80 },
    ]);
  });

  it("relata as linhas que não deram para interpretar", () => {
    const lida = interpretarLista("Cartão 100\nlembrar de ligar pro banco", 2026);
    expect(lida.itens).toHaveLength(1);
    expect(lida.ignoradas).toEqual(["lembrar de ligar pro banco"]);
  });

  it("devolve vazio para texto sem contas", () => {
    const lida = interpretarLista("bom dia\n\n", 2026);
    expect(lida.itens).toHaveLength(0);
    expect(lida.totalInformado).toBeNull();
  });
});
