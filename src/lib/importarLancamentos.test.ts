import { describe, expect, it } from "vitest";
import {
  interpretarLancamentos,
  interpretarLinha,
  paraLancamento,
} from "./importarLancamentos";

const HOJE = "2026-09-08";

describe("interpretarLinha", () => {
  it("lê valor no fim e adivinha a categoria pela descrição", () => {
    const l = interpretarLinha("almoço 25", HOJE)!;
    expect(l.tipo).toBe("saida");
    expect(l.valor).toBe(25);
    expect(l.descricao).toBe("almoço");
    expect(l.categoria).toBe("Alimentação");
    expect(l.data).toBe(HOJE);
  });

  it("aceita o valor na frente, que é como se digita com pressa", () => {
    const l = interpretarLinha("25 almoço", HOJE)!;
    expect(l.valor).toBe(25);
    expect(l.descricao).toBe("almoço");
    expect(l.categoria).toBe("Alimentação");
  });

  it("o + na frente manda: vira entrada", () => {
    const l = interpretarLinha("+ mesada 500", HOJE)!;
    expect(l.tipo).toBe("entrada");
    expect(l.categoria).toBe("Mesada");
    expect(l.tipoExplicito).toBe(true);
  });

  it("o - na frente é saída, e não faz parte da descrição", () => {
    const l = interpretarLinha("- estacionamento 150", HOJE)!;
    expect(l.tipo).toBe("saida");
    expect(l.descricao).toBe("estacionamento");
    expect(l.categoria).toBe("Transporte");
  });

  it("sem sinal, a descrição inequívoca desempata para entrada", () => {
    const l = interpretarLinha("salário 3000", HOJE)!;
    expect(l.tipo).toBe("entrada");
    expect(l.categoria).toBe("Salário");
    expect(l.tipoExplicito).toBe(false);
  });

  it("na dúvida é saída — 'bolsa 200' é compra, não bolsa de estudo", () => {
    const l = interpretarLinha("bolsa 200", HOJE)!;
    expect(l.tipo).toBe("saida");
  });

  it("entende número brasileiro", () => {
    expect(interpretarLinha("cartão de crédito 1.900", HOJE)!.valor).toBe(1900);
    expect(interpretarLinha("pão 10,50", HOJE)!.valor).toBe(10.5);
  });

  it("a data no começo da linha vale mais que a data padrão", () => {
    const l = interpretarLinha("12/10 internet 120", HOJE)!;
    expect(l.data).toBe("2026-10-12");
    expect(l.dataExplicita).toBe(true);
    expect(l.descricao).toBe("internet");
    expect(l.categoria).toBe("Casa");
  });

  it("data impossível continua sendo descrição", () => {
    // "12/24 parcelas" tem mês 24 — vira texto, não vencimento.
    expect(interpretarLinha("12/24 parcelas 300", HOJE)!.data).toBe(HOJE);
  });

  it("hífen dentro da descrição não confunde o corte do valor", () => {
    const l = interpretarLinha("Salário de bom filho - 500", HOJE)!;
    expect(l.descricao).toBe("Salário de bom filho");
    expect(l.valor).toBe(500);
  });

  it("prefere a palavra reconhecida mais longa", () => {
    // "plano" sozinho é Assinaturas; "plano de saúde" tem que ganhar.
    expect(interpretarLinha("plano de saúde 300", HOJE)!.categoria).toBe("Saúde");
  });

  it("marca o que não reconheceu, para a prévia poder avisar", () => {
    const l = interpretarLinha("xyzabc 40", HOJE)!;
    expect(l.categoria).toBe("Outros");
    expect(l.categoriaReconhecida).toBe(false);
  });

  it("devolve null quando não há valor", () => {
    expect(interpretarLinha("almoço", HOJE)).toBeNull();
    expect(interpretarLinha("", HOJE)).toBeNull();
  });
});

describe("interpretarLancamentos", () => {
  const bloco = `Contas de outubro 05/10:
Cartão de crédito 1.900
Empréstimo 800
+ Mãe 6.000
Estacionamento 150
Total = 8.850`;

  it("lê a lista inteira e herda a data do cabeçalho", () => {
    const lida = interpretarLancamentos(bloco, HOJE);
    expect(lida.itens).toHaveLength(4);
    expect(lida.itens.map((i) => i.data)).toEqual([
      "2026-10-05",
      "2026-10-05",
      "2026-10-05",
      "2026-10-05",
    ]);
    expect(lida.itens.map((i) => i.tipo)).toEqual([
      "saida",
      "saida",
      "entrada",
      "saida",
    ]);
    expect(lida.itens.map((i) => i.categoria)).toEqual([
      "Cartão de Crédito / Contas",
      "Cartão de Crédito / Contas",
      "Mesada",
      "Transporte",
    ]);
  });

  it("guarda o total como conferência, nunca como lançamento", () => {
    const lida = interpretarLancamentos(bloco, HOJE);
    expect(lida.totalInformado).toBe(8850);
    expect(lida.itens.some((i) => /total/i.test(i.descricao))).toBe(false);
  });

  it("a data da linha vence a do cabeçalho", () => {
    const lida = interpretarLancamentos(
      `Outubro 05/10:\ncartão 1.900\n20/10 internet 120`,
      HOJE
    );
    expect(lida.itens[0].data).toBe("2026-10-05");
    expect(lida.itens[1].data).toBe("2026-10-20");
  });

  it("sem data nenhuma, tudo cai na data padrão", () => {
    const lida = interpretarLancamentos("uber 18\nifood 42", HOJE);
    expect(lida.itens.map((i) => i.data)).toEqual([HOJE, HOJE]);
    expect(lida.itens.map((i) => i.dataExplicita)).toEqual([false, false]);
  });

  it("separa o que não deu para interpretar", () => {
    const lida = interpretarLancamentos("uber 18\nbla bla bla\nifood 42", HOJE);
    expect(lida.itens).toHaveLength(2);
    expect(lida.ignoradas).toEqual(["bla bla bla"]);
  });

  it("ignora marcadores de lista e negrito do WhatsApp", () => {
    const lida = interpretarLancamentos("• uber 18\n* ifood 42", HOJE);
    expect(lida.itens.map((i) => i.descricao)).toEqual(["uber", "ifood"]);
  });

  it("cabeçalho sem dois-pontos não vira lançamento fantasma", () => {
    // "Contas de outubro 05/10" terminava com "10", e o "10" virava valor:
    // nascia um lançamento de R$ 10 chamado "Contas de outubro 05/", e a data
    // do bloco se perdia — a leva de outubro inteira caía em setembro.
    const lida = interpretarLancamentos(
      "Contas de outubro 05/10\ncartão 1.900\nalmoço 25",
      HOJE
    );
    expect(lida.itens.map((i) => i.descricao)).toEqual(["cartão", "almoço"]);
    expect(lida.itens.map((i) => i.data)).toEqual([
      "2026-10-05",
      "2026-10-05",
    ]);
  });

  it("valor com ponto decimal não é confundido com data", () => {
    // O contrário do caso acima: "25.10" é vinte e cinco e dez, não 25 de
    // outubro. Confundir os dois faria o lançamento sumir sem aviso.
    const lida = interpretarLancamentos("almoço 25.10", HOJE);
    expect(lida.itens).toHaveLength(1);
    expect(lida.itens[0].valor).toBe(25.1);
    expect(lida.itens[0].data).toBe(HOJE);
  });

  it("acha a data do cabeçalho mesmo com número parecido antes", () => {
    // "1.90" casa com o padrão de data antes de "05/10" aparecer, e mês 90 não
    // existe: a busca precisa continuar em vez de desistir na primeira.
    const lida = interpretarLancamentos(
      "Contas 1.900 de outubro 05/10:\ncartão 1.900",
      HOJE
    );
    expect(lida.itens).toHaveLength(1);
    expect(lida.itens[0].data).toBe("2026-10-05");
  });

  it("linhas em branco não viram nada", () => {
    const lida = interpretarLancamentos("\n\nuber 18\n\n", HOJE);
    expect(lida.itens).toHaveLength(1);
    expect(lida.ignoradas).toEqual([]);
  });
});

describe("paraLancamento", () => {
  it("tira a competência da data, e não do mês que a tela mostra", () => {
    const linha = interpretarLinha("12/10 internet 120", HOJE)!;
    expect(paraLancamento(linha)).toEqual({
      tipo: "saida",
      valor: 120,
      descricao: "internet",
      categoria: "Casa",
      mes: 9,
      ano: 2026,
      data: "2026-10-12",
    });
  });
});
