import { describe, expect, it } from "vitest";
import { gerarCsv, nomeDoArquivo } from "./csv";
import type { Lancamento } from "../types";

function l(parcial: Partial<Lancamento>): Lancamento {
  return {
    id: "1", user_id: "u", tipo: "saida", valor: 10, descricao: "x",
    categoria: "Outros", mes: 10, ano: 2026, data: "2026-11-03",
    created_at: "", ...parcial,
  };
}

const semBom = (csv: string) => csv.replace(/^﻿/, "");
const linhas = (csv: string) => semBom(csv).trim().split("\r\n");

describe("gerarCsv", () => {
  it("abre com BOM, senão o Excel estraga os acentos", () => {
    expect(gerarCsv([])).toMatch(/^﻿/);
  });

  it("tem cabeçalho mesmo sem lançamento nenhum", () => {
    expect(linhas(gerarCsv([]))).toEqual([
      "Data;Tipo;Descrição;Categoria;Valor;Valor com sinal",
    ]);
  });

  it("escreve valor com vírgula decimal, para a planilha somar", () => {
    const csv = linhas(gerarCsv([l({ valor: 1500.5, descricao: "mesada" })]));
    expect(csv[1]).toContain(";1500,50;");
  });

  it("dá sinal negativo para saída e positivo para entrada", () => {
    const csv = linhas(
      gerarCsv([
        l({ tipo: "saida", valor: 40, descricao: "almoço", data: "2026-11-01" }),
        l({ tipo: "entrada", valor: 130, descricao: "mesada", data: "2026-11-02" }),
      ])
    );
    expect(csv[1]).toBe("2026-11-01;Saída;almoço;Outros;40,00;-40,00");
    expect(csv[2]).toBe("2026-11-02;Entrada;mesada;Outros;130,00;130,00");
  });

  // Sem aspas, uma descrição com ponto e vírgula vira duas colunas e
  // desalinha a planilha inteira a partir dali.
  it("protege descrição com ponto e vírgula, aspas ou quebra de linha", () => {
    const csv = linhas(
      gerarCsv([
        l({ descricao: 'almoço; cerveja', data: "2026-11-01" }),
        l({ descricao: 'conta do "zé"', data: "2026-11-02" }),
      ])
    );
    expect(csv[1]).toContain('"almoço; cerveja"');
    expect(csv[2]).toContain('"conta do ""zé"""');
  });

  it("ordena do mais antigo para o mais novo", () => {
    const csv = linhas(
      gerarCsv([
        l({ descricao: "terceiro", data: "2026-11-20" }),
        l({ descricao: "primeiro", data: "2026-09-01" }),
        l({ descricao: "segundo", data: "2026-10-05" }),
      ])
    );
    expect(csv.slice(1).map((linha) => linha.split(";")[2])).toEqual([
      "primeiro",
      "segundo",
      "terceiro",
    ]);
  });

  // Lançamento antigo pode não ter data; a competência é o que sobra.
  it("usa o primeiro dia da competência quando não há data", () => {
    const csv = linhas(gerarCsv([l({ data: null, mes: 0, ano: 2026 })]));
    expect(csv[1]).toMatch(/^2026-01-01;/);
  });

  it("nomeia o arquivo com a data de hoje", () => {
    expect(nomeDoArquivo("2026-11-03")).toBe("financas-2026-11-03.csv");
  });
});
