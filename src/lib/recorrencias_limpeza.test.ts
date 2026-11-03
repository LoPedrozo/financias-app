import { beforeEach, describe, expect, it, vi } from "vitest";

// Espiona a cadeia do PostgREST sem subir banco nenhum. O que importa aqui é
// uma coisa só: o corte de data usado ao apagar as ocorrências já geradas.
const chamadas: Array<{ tabela: string; operacao: string; corte?: string }> = [];
let atual: { tabela: string; operacao: string };

function cadeia(): Record<string, unknown> {
  const alvo: Record<string, unknown> = {
    eq: () => cadeia(),
    in: () => cadeia(),
    select: () => cadeia(),
    single: async () => ({ data: { id: "r1" }, error: null }),
    gt: async (_coluna: string, valor: string) => {
      chamadas.push({ ...atual, corte: `> ${valor}` });
      return { data: null, error: null };
    },
    gte: async (_coluna: string, valor: string) => {
      chamadas.push({ ...atual, corte: `>= ${valor}` });
      return { data: null, error: null };
    },
    then: undefined,
  };
  return alvo;
}

vi.mock("./supabase", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (tabela: string) => ({
      delete: () => {
        atual = { tabela, operacao: "delete" };
        return cadeia();
      },
      update: () => {
        atual = { tabela, operacao: "update" };
        return cadeia();
      },
      select: () => cadeia(),
    }),
  },
}));

const { atualizarRecorrencia, deletarRecorrencia, toggleRecorrencia } =
  await import("./recorrencias");
const { hojeLocal } = await import("./calculos");

describe("limpeza das ocorrências já geradas", () => {
  beforeEach(() => {
    chamadas.length = 0;
  });

  // Antes, o corte era sempre "> hoje": corrigir o valor do aluguel no
  // próprio dia 3 não mexia no lançamento do dia 3, e a geração seguinte
  // esbarrava no índice único e deixava o valor velho na tela, em silêncio.
  it("editar a regra apaga a partir de hoje, inclusive", async () => {
    await atualizarRecorrencia("r1", { valor: 1500 });
    expect(chamadas).toEqual([
      { tabela: "lancamentos", operacao: "delete", corte: `>= ${hojeLocal()}` },
    ]);
  });

  // Aqui não há recriação depois, e o lançamento de hoje já entrou no saldo:
  // apagá-lo seria sumir com dinheiro que a pessoa já deu por gasto.
  it("apagar a regra preserva a ocorrência de hoje", async () => {
    await deletarRecorrencia("r1");
    expect(chamadas[0]).toEqual({
      tabela: "lancamentos",
      operacao: "delete",
      corte: `> ${hojeLocal()}`,
    });
  });

  it("pausar a regra preserva a ocorrência de hoje", async () => {
    await toggleRecorrencia("r1", false);
    expect(chamadas[0]).toEqual({
      tabela: "lancamentos",
      operacao: "delete",
      corte: `> ${hojeLocal()}`,
    });
  });

  it("reativar não apaga nada — a geração recria o que faltar", async () => {
    await toggleRecorrencia("r1", true);
    expect(chamadas).toEqual([]);
  });
});
