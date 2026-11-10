// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "./Dashboard";
import { criarLancamento, listarLancamentos } from "../lib/lancamentos";
import { MESES } from "../types";

// O Dashboard conversa com o servidor por estes quatro módulos. Mockados, a
// tela inteira roda em memória e dá para provocar a falha de rede que é
// impossível de reproduzir à mão.
vi.mock("../lib/supabase", () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));
// Sem cartão configurado: o Dashboard busca o cartão a cada atualização.
vi.mock("../lib/cartao", () => ({
  obterCartao: vi.fn(async () => null),
  listarCompras: vi.fn(async () => []),
  listarPrevistos: vi.fn(async () => []),
}));

vi.mock("../lib/lancamentos", () => ({
  listarLancamentos: vi.fn(async () => []),
  criarLancamento: vi.fn(async (item) => ({
    ...item,
    id: "novo-1",
    user_id: "u1",
    created_at: new Date().toISOString(),
  })),
  atualizarLancamento: vi.fn(async (id, item) => ({ ...item, id, user_id: "u1" })),
  removerLancamento: vi.fn(async () => {}),
  criarLancamentosEmLote: vi.fn(async () => []),
  removerLancamentosEmLote: vi.fn(async () => {}),
}));

vi.mock("../lib/recorrencias", () => ({
  listarRecorrencias: vi.fn(async () => []),
  gerarLancamentosRecorrentes: vi.fn(async () => []),
}));

const sessao = {
  user: { id: "u1", email: "eu@exemplo.com" },
} as unknown as Session;

async function abrirFormulario() {
  await userEvent.click(screen.getByRole("button", { name: "Novo lançamento" }));
  await screen.findByText("Novo lançamento", { selector: "h3" });
}

async function preencher(valor: string, descricao: string) {
  await userEvent.type(screen.getByLabelText("Valor"), valor);
  await userEvent.type(screen.getByLabelText("Descrição"), descricao);
  await userEvent.click(
    screen.getByRole("button", { name: "Salvar entrada" })
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listarLancamentos).mockResolvedValue([]);
  });

  it("o + abre o formulário completo, não o campo de colar", async () => {
    render(<Dashboard session={sessao} />);
    await abrirFormulario();
    expect(screen.getByLabelText("Categoria")).toBeInTheDocument();
  });

  it("salvando com sucesso, fecha o formulário", async () => {
    render(<Dashboard session={sessao} />);
    await abrirFormulario();
    await preencher("200", "mesada pai");

    await waitFor(() =>
      expect(
        screen.queryByText("Novo lançamento", { selector: "h3" })
      ).not.toBeInTheDocument()
    );
    expect(criarLancamento).toHaveBeenCalledTimes(1);
  });

  // A regressão que motivou a correção: a conexão cai, o toast de erro
  // aparece — e o formulário sumia levando junto o que tinha sido digitado.
  it("falhando ao salvar, mantém o formulário aberto com o que foi digitado", async () => {
    vi.mocked(criarLancamento).mockRejectedValueOnce(new Error("sem rede"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Dashboard session={sessao} />);
    await abrirFormulario();
    await preencher("200", "mesada pai");

    expect(
      await screen.findByText(/Não foi possível salvar/)
    ).toBeInTheDocument();
    expect(
      screen.getByText("Novo lançamento", { selector: "h3" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Valor")).toHaveValue("200");
    expect(screen.getByLabelText("Descrição")).toHaveValue("mesada pai");
  });

  it("exporta tudo em CSV, com BOM e separador de planilha brasileira", async () => {
    vi.mocked(listarLancamentos).mockResolvedValue([
      {
        id: "l1", user_id: "u1", tipo: "saida", valor: 40,
        descricao: "almoço; café", categoria: "Alimentação",
        mes: 10, ano: 2026, data: "2026-11-01", created_at: "",
      },
    ]);

    // jsdom não implementa nem o Blob URL nem o download de verdade: o que dá
    // para provar aqui é o conteúdo gerado e o nome do arquivo.
    const urls: string[] = [];
    let conteudo = "";
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: (b: Blob) => {
        conteudo = (b as unknown as { __texto?: string }).__texto ?? "";
        urls.push("blob:x");
        return "blob:x";
      },
      revokeObjectURL: vi.fn(),
    });
    const BlobOriginal = globalThis.Blob;
    vi.stubGlobal(
      "Blob",
      class extends BlobOriginal {
        __texto: string;
        constructor(partes: string[], opcoes?: BlobPropertyBag) {
          super(partes, opcoes);
          this.__texto = partes.join("");
        }
      }
    );

    render(<Dashboard session={sessao} />);
    await screen.findByText(/almoço; café/);
    await userEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    await userEvent.click(await screen.findByRole("button", { name: /^Tudo/ }));

    expect(urls).toHaveLength(1);
    expect(conteudo).toMatch(/^\ufeffData;Tipo;Descrição;Categoria;Valor/);
    expect(conteudo).toContain('"almoço; café"');
    expect(conteudo).toContain(";40,00;-40,00");
    expect(await screen.findByText(/1 lançamento exportado/)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  // No iPhone o <a download> dentro do app instalado abre o CSV como texto em
  // vez de salvar. Onde existe compartilhamento nativo, é por ele que o
  // arquivo sai — é dali que se manda para o Arquivos ou para alguém.
  it("usa o compartilhamento nativo quando o aparelho tem", async () => {
    vi.mocked(listarLancamentos).mockResolvedValue([
      {
        id: "l1", user_id: "u1", tipo: "entrada", valor: 130,
        descricao: "mesada", categoria: "Mesada",
        mes: 10, ano: 2026, data: "2026-11-01", created_at: "",
      },
    ]);

    // Tipado com o parâmetro para o `mock.calls[0][0]` lá embaixo existir.
    const share = vi.fn(async (_dados: ShareData) => {});
    vi.stubGlobal("navigator", {
      ...navigator,
      canShare: () => true,
      share,
    });

    render(<Dashboard session={sessao} />);
    await screen.findByText("mesada");
    await userEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    await userEvent.click(await screen.findByRole("button", { name: /^Tudo/ }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const enviado = share.mock.calls[0][0];
    expect(enviado.files![0].name).toMatch(/^financas-tudo-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(await enviado.files![0].text()).toContain("mesada");

    vi.unstubAllGlobals();
  });

  it("desistir do compartilhamento não vira erro na tela", async () => {
    vi.mocked(listarLancamentos).mockResolvedValue([
      {
        id: "l1", user_id: "u1", tipo: "entrada", valor: 130,
        descricao: "mesada", categoria: "Mesada",
        mes: 10, ano: 2026, data: "2026-11-01", created_at: "",
      },
    ]);

    const abortar = Object.assign(new Error("cancelou"), { name: "AbortError" });
    vi.stubGlobal("navigator", {
      ...navigator,
      canShare: () => true,
      share: vi.fn(async () => {
        throw abortar;
      }),
    });

    render(<Dashboard session={sessao} />);
    await screen.findByText("mesada");
    await userEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    await userEvent.click(await screen.findByRole("button", { name: /^Tudo/ }));

    await waitFor(() =>
      expect(screen.queryByText(/Não foi possível exportar/)).not.toBeInTheDocument()
    );
    expect(screen.queryByText(/exportado/)).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  // Antes, trocar de mês refazia o fetch de todos os lançamentos de todos os
  // meses — a cada toque na seta.
  it("navegar entre meses não rebaixa a base inteira", async () => {
    render(<Dashboard session={sessao} />);
    await waitFor(() => expect(listarLancamentos).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    await userEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    await userEvent.click(screen.getByRole("button", { name: "Mês anterior" }));

    expect(listarLancamentos).toHaveBeenCalledTimes(1);
  });
});

// A cor da etiqueta é concatenada com a transparência (`cor + "1f"`), então
// uma categoria fora da lista não pode cair num var(--...): o resultado seria
// CSS inválido e a etiqueta perderia o fundo.
describe("etiqueta de categoria", () => {
  it("categoria desconhecida ainda pinta o fundo da etiqueta", async () => {
    vi.mocked(listarLancamentos).mockResolvedValue([
      {
        id: "l1", user_id: "u1", tipo: "entrada", valor: 100,
        descricao: "bico antigo", categoria: "Categoria que não existe mais",
        mes: new Date().getMonth(), ano: new Date().getFullYear(),
        data: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`,
        created_at: "",
      },
    ]);

    render(<Dashboard session={sessao} />);
    await screen.findByText("Categoria que não existe mais");
    // A cor da categoria mora no círculo do ícone, ao lado da descrição.
    const linha = screen.getByText("bico antigo").closest(".item-lancamento")!;
    const circulo = linha.querySelector<HTMLElement>(".icone-categoria")!;

    expect(circulo.style.background).not.toContain("var(");
    expect(circulo.style.background).toBeTruthy();
  });
});

// Recorte por período. O Dashboard abre no mês corrente, então os dados são
// montados a partir de hoje — com data fixa, o teste quebraria no mês que vem.
describe("exportar por período", () => {
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();
  const anterior =
    mesAtual === 0
      ? { mes: 11, ano: anoAtual - 1 }
      : { mes: mesAtual - 1, ano: anoAtual };
  const iso = (mes: number, ano: number) =>
    `${ano}-${String(mes + 1).padStart(2, "0")}-01`;

  function lanc(id: string, descricao: string, mes: number, ano: number) {
    return {
      id, user_id: "u1", tipo: "saida" as const, valor: 10, descricao,
      categoria: "Outros", mes, ano, data: iso(mes, ano), created_at: "",
    };
  }

  function capturarDownload() {
    const capturado = { conteudo: "", nome: "" };
    const BlobOriginal = globalThis.Blob;
    vi.stubGlobal(
      "Blob",
      class extends BlobOriginal {
        constructor(partes: string[], opcoes?: BlobPropertyBag) {
          super(partes, opcoes);
          capturado.conteudo = partes.join("");
        }
      }
    );
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: () => "blob:x",
      revokeObjectURL: vi.fn(),
    });
    // O nome sai no atributo download do link criado na hora do clique.
    const clicarOriginal = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      capturado.nome = this.download;
    };
    return {
      capturado,
      restaurar: () => {
        HTMLAnchorElement.prototype.click = clicarOriginal;
        vi.unstubAllGlobals();
      },
    };
  }

  it("o mês na tela exporta só aquele mês", async () => {
    vi.mocked(listarLancamentos).mockResolvedValue([
      lanc("a", "deste mês", mesAtual, anoAtual),
      lanc("b", "do mês passado", anterior.mes, anterior.ano),
    ]);
    const { capturado, restaurar } = capturarDownload();

    render(<Dashboard session={sessao} />);
    await screen.findByText("deste mês");
    await userEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    await userEvent.click(
      await screen.findByRole("button", {
        name: new RegExp(`^${MESES[mesAtual]} de ${anoAtual}`),
      })
    );

    expect(capturado.conteudo).toContain("deste mês");
    expect(capturado.conteudo).not.toContain("do mês passado");
    expect(capturado.nome).toBe(
      `financas-${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}.csv`
    );
    restaurar();
  });

  it("o ano exporta os meses daquele ano", async () => {
    vi.mocked(listarLancamentos).mockResolvedValue([
      lanc("a", "deste ano", mesAtual, anoAtual),
      lanc("b", "do ano passado", mesAtual, anoAtual - 1),
    ]);
    const { capturado, restaurar } = capturarDownload();

    render(<Dashboard session={sessao} />);
    await screen.findByText("deste ano");
    await userEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    await userEvent.click(
      await screen.findByRole("button", { name: new RegExp(`^Ano de ${anoAtual}`) })
    );

    expect(capturado.conteudo).toContain("deste ano");
    expect(capturado.conteudo).not.toContain("do ano passado");
    expect(capturado.nome).toBe(`financas-${anoAtual}.csv`);
    restaurar();
  });

  // Sem isso daria para baixar um CSV só com o cabeçalho e achar que os
  // dados sumiram.
  it("período sem lançamento fica desligado e diz por quê", async () => {
    vi.mocked(listarLancamentos).mockResolvedValue([
      lanc("b", "do ano passado", mesAtual, anoAtual - 1),
    ]);

    render(<Dashboard session={sessao} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Exportar CSV" })
    );

    // Dado só do ano passado: o mês e o ano da tela ficam os dois vazios.
    const doMes = await screen.findByRole("button", {
      name: new RegExp(`^${MESES[mesAtual]} de ${anoAtual}.*nenhum lançamento`),
    });
    expect(doMes).toBeDisabled();
    expect(
      screen.getByRole("button", { name: new RegExp(`^Ano de ${anoAtual}`) })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /^Tudo.*1 lançamento/ })
    ).toBeEnabled();
  });
});
