// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "./Dashboard";
import { listarLancamentos } from "../lib/lancamentos";
import { criarCartao, criarCompra, criarPrevisto, listarCompras, listarFaturas, obterCartao, removerCompra, salvarInicial } from "../lib/cartao";
import type { Cartao, CompraCartao, Lancamento } from "../types";

// O cartão de crédito dentro do app: a compra não sai do saldo no dia; a
// fatura sai, no vencimento, somada das compras. O que não pode acontecer:
// a compra contar como gasto do mês, a fatura sumir do saldo projetado, ou
// a fatura lançada à mão contar junto sem aviso.

vi.mock("../lib/supabase", () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock("../lib/lancamentos", () => ({
  listarLancamentos: vi.fn(async () => []),
  criarLancamento: vi.fn(), atualizarLancamento: vi.fn(), removerLancamento: vi.fn(async () => {}),
  criarLancamentosEmLote: vi.fn(), removerLancamentosEmLote: vi.fn(),
}));
vi.mock("../lib/recorrencias", () => ({
  listarRecorrencias: vi.fn(async () => []),
  gerarLancamentosRecorrentes: vi.fn(async () => []),
}));
vi.mock("../lib/cartao", () => ({
  obterCartao: vi.fn(async () => null),
  listarCompras: vi.fn(async () => []),
  listarPrevistos: vi.fn(async () => []),
  listarFaturas: vi.fn(async () => []),
  salvarInicial: vi.fn(),
  apagarInicial: vi.fn(async () => {}),
  criarCartao: vi.fn(),
  atualizarCartao: vi.fn(),
  criarCompra: vi.fn(),
  atualizarCompra: vi.fn(),
  removerCompra: vi.fn(async () => {}),
  criarPrevisto: vi.fn(),
  atualizarPrevisto: vi.fn(),
  removerPrevisto: vi.fn(async () => {}),
}));

const sessao = { user: { id: "u1", email: "eu@x.com" } } as unknown as Session;
const nubank: Cartao = {
  id: "c1", user_id: "u1", nome: "Nubank", dia_fechamento: 3, dia_vencimento: 10,
  meta_total: 1000, meta_essenciais: 500, inicio: "2026-12-10", created_at: "",
};
const compra = (id: string, data: string, valor: number, extra: Partial<CompraCartao> = {}): CompraCartao => ({
  id, user_id: "u1", cartao_id: "c1", descricao: id, valor, categoria: "Alimentação", data,
  parcelas: 1, essencial: null, como: "aproximacao", created_at: `${data}T12:00:00Z`, ...extra,
});
const lanc = (id: string, tipo: "entrada" | "saida", valor: number, data: string, extra: Partial<Lancamento> = {}): Lancamento => ({
  id, user_id: "u1", tipo, valor, descricao: id, categoria: tipo === "entrada" ? "Salário" : "Outros",
  mes: Number(data.slice(5, 7)) - 1, ano: Number(data.slice(0, 4)), data, created_at: `${data}T10:00:00Z`, ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 10, 10, 12)); // terça, 10 nov 2026
  vi.mocked(listarLancamentos).mockResolvedValue([lanc("Salário", "entrada", 5000, "2026-11-05")]);
  vi.mocked(obterCartao).mockResolvedValue(nubank);
  vi.mocked(listarFaturas).mockResolvedValue([]);
  vi.mocked(listarCompras).mockResolvedValue([
    compra("Mercado", "2026-11-08", 230.15),
    compra("Uber", "2026-11-06", 18.4, { categoria: "Transporte" }),
  ]);
});
afterEach(() => vi.useRealTimers());

const proximoMes = () => fireEvent.click(screen.getAllByRole("button", { name: "Próximo mês" })[0]);

describe("cartão de crédito no Dashboard", () => {
  it("a compra não é gasto de novembro; o cartão mostra a fatura aberta", async () => {
    render(<Dashboard session={sessao} />);
    const cartao = await screen.findByRole("button", { name: /Cartão de crédito: fatura de dezembro/ });
    expect(cartao).toHaveTextContent("R$ 248,55");
    expect(cartao).toHaveTextContent("vence 10 dez");
    expect(cartao).toHaveTextContent("meta R$ 1.000,00");
    // Gastos de novembro: nada — a compra sai no vencimento, não no dia.
    expect(screen.getByRole("button", { name: /Gastos/ })).toHaveTextContent("R$ 0,00");
    expect(screen.queryByText("Fatura do cartão")).toBeNull();
  });

  it("em dezembro, a fatura aparece na lista no dia 10 e sai do saldo projetado", async () => {
    render(<Dashboard session={sessao} />);
    await screen.findByRole("button", { name: /Cartão de crédito: fatura/ });
    proximoMes();
    const linha = await screen.findByRole("button", { name: /Fatura do cartão, R\$\s248,55/ });
    expect(linha).toHaveTextContent("Qui, 10 dez");
    // 5.000 de salário − 248,55 da fatura.
    expect(document.querySelector(".card-saldo")).toHaveTextContent("R$ 4.751,45");
  });

  it("tocar na fatura da lista abre a fatura, com as compras", async () => {
    render(<Dashboard session={sessao} />);
    await screen.findByRole("button", { name: /Cartão de crédito: fatura/ });
    proximoMes();
    fireEvent.click(await screen.findByRole("button", { name: /Fatura do cartão, R\$\s248,55/ }));
    const folha = await screen.findByRole("dialog", { name: "Fatura de dezembro" });
    expect(within(folha).getByText("Mercado")).toBeInTheDocument();
    expect(within(folha).getByText("Uber")).toBeInTheDocument();
    expect(within(folha).getByText(/Fecha 3 dez · vence 10 dez/)).toBeInTheDocument();
  });

  it("fatura lançada à mão no mesmo mês: avisa que conta duas vezes e oferece apagar", async () => {
    vi.mocked(listarLancamentos).mockResolvedValue([
      lanc("Salário", "entrada", 5000, "2026-11-05"),
      lanc("Cartão crédito", "saida", 3000, "2026-12-04", { categoria: "Cartão de Crédito / Contas" }),
    ]);
    render(<Dashboard session={sessao} />);
    fireEvent.click(await screen.findByRole("button", { name: /Cartão de crédito: fatura/ }));
    const folha = await screen.findByRole("dialog", { name: "Fatura de dezembro" });
    const aviso = within(folha).getByRole("note");
    expect(aviso).toHaveTextContent("“Cartão crédito” (R$ 3.000,00, 4 dez) parece esta fatura lançada à mão");
    fireEvent.click(within(aviso).getByRole("button", { name: "Apagar" }));
    await waitFor(() => expect(within(folha).queryByRole("note")).toBeNull());
    expect(screen.getByText('"Cartão crédito" excluído.')).toBeInTheDocument();
  });

  it("nova compra pela fatura: grava no cartão e o valor do cartão sobe", async () => {
    vi.mocked(criarCompra).mockImplementation(async (d) => ({ ...d, id: "nova", user_id: "u1", created_at: "2026-11-10T15:00:00Z" }));
    render(<Dashboard session={sessao} />);
    fireEvent.click(await screen.findByRole("button", { name: /Cartão de crédito: fatura/ }));
    await screen.findByRole("dialog", { name: "Fatura de dezembro" });
    fireEvent.click(screen.getByRole("button", { name: "Compra no cartão" }));
    const form = await screen.findByRole("dialog", { name: "Compra no cartão" });
    await userEvent.type(within(form).getByLabelText("Valor"), "1.050,00");
    await userEvent.type(within(form).getByLabelText("Descrição"), "Fone");
    fireEvent.click(within(form).getByRole("radio", { name: "Tecnologia" }));
    fireEvent.click(within(form).getByRole("radio", { name: "3 parcelas" }));
    fireEvent.click(within(form).getByRole("radio", { name: /Online/ }));
    expect(form).toHaveTextContent("3x de R$ 350,00, de dezembro a fevereiro de 2027");
    fireEvent.click(within(form).getByRole("button", { name: "Salvar compra" }));
    await waitFor(() => expect(criarCompra).toHaveBeenCalledTimes(1));
    expect(criarCompra).toHaveBeenCalledWith({
      cartao_id: "c1", descricao: "Fone", valor: 1050, categoria: "Tecnologia", data: "2026-11-10",
      parcelas: 3, essencial: null, como: "online",
    });
    // 248,55 + a primeira parcela, 350.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Cartão de crédito: fatura de dezembro, R\$\s598,55/ })).toBeInTheDocument()
    );
  });

  it("apagar compra tem Desfazer, e só apaga no servidor quando a janela fecha", async () => {
    render(<Dashboard session={sessao} />);
    fireEvent.click(await screen.findByRole("button", { name: /Cartão de crédito: fatura/ }));
    const folha = await screen.findByRole("dialog", { name: "Fatura de dezembro" });
    fireEvent.click(within(folha).getByText("Uber"));
    const form = await screen.findByRole("dialog", { name: "Editar compra" });
    fireEvent.click(within(form).getByRole("button", { name: /Apagar compra/ }));
    await waitFor(() => expect(screen.queryByText("Uber")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(await screen.findByText("Uber")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(removerCompra).not.toHaveBeenCalled();
  });

  it("sem cartão: o convite abre a configuração, que começa pela fatura aberta e lança o que já estava nela", async () => {
    vi.mocked(obterCartao).mockResolvedValue(null);
    vi.mocked(criarCartao).mockImplementation(async (d) => ({ ...d, id: "c9", user_id: "u1", created_at: "" }));
    vi.mocked(criarCompra).mockImplementation(async (d) => ({ ...d, id: "ja", user_id: "u1", created_at: "" }));
    vi.mocked(salvarInicial).mockImplementation(async (cartao_id, fechamento, inicial) => ({ id: "f1", user_id: "u1", cartao_id, fechamento, inicial, created_at: "" }));
    render(<Dashboard session={sessao} />);
    fireEvent.click(await screen.findByRole("button", { name: /Configurar/ }));
    const form = await screen.findByRole("dialog", { name: "Configurar o cartão" });
    // Fecha 3 e vence 10 já vêm preenchidos (o Nubank do Lorenzo).
    expect(within(form).getByRole("radio", { name: /De dezembro \(aberta\)/ })).toHaveAttribute("aria-checked", "true");
    await userEvent.type(within(form).getByLabelText("Seus gastos nela"), "320");
    await userEvent.type(within(form).getByLabelText("Outra pessoa paga"), "1800");
    await userEvent.type(within(form).getByLabelText("Meta da fatura"), "1000");
    await userEvent.type(within(form).getByLabelText("Dela, essenciais"), "500");
    fireEvent.click(within(form).getByRole("button", { name: "Começar" }));
    await waitFor(() => expect(criarCartao).toHaveBeenCalledTimes(1));
    expect(criarCartao).toHaveBeenCalledWith({
      nome: "Cartão de crédito", dia_fechamento: 3, dia_vencimento: 10,
      meta_total: 1000, meta_essenciais: 500, inicio: "2026-12-10",
    });
    await waitFor(() => expect(criarCompra).toHaveBeenCalledTimes(1));
    // No primeiro dia do ciclo aberto, para cair na fatura de dezembro.
    expect(criarCompra).toHaveBeenCalledWith(expect.objectContaining({ cartao_id: "c9", valor: 320, data: "2026-11-03" }));
    expect(salvarInicial).toHaveBeenCalledWith("c9", "2026-12-03", 1800);
    expect(await screen.findByRole("dialog", { name: "Fatura de dezembro" })).toHaveTextContent("Já estava na fatura");
  });

  it("previsto: R$ 70 toda sexta entra na previsão da fatura (13, 20 e 27 nov)", async () => {
    vi.mocked(criarPrevisto).mockImplementation(async (d) => ({ ...d, id: "p1", user_id: "u1", created_at: "" }));
    render(<Dashboard session={sessao} />);
    fireEvent.click(await screen.findByRole("button", { name: /Cartão de crédito: fatura/ }));
    const folha = await screen.findByRole("dialog", { name: "Fatura de dezembro" });
    fireEvent.click(within(folha).getByRole("button", { name: "+ previsto" }));
    const form = await screen.findByRole("dialog", { name: "Gasto previsto" });
    await userEvent.type(within(form).getByLabelText("Valor"), "70");
    await userEvent.type(within(form).getByLabelText("Descrição"), "Lanche de sexta");
    fireEvent.click(within(form).getByRole("radio", { name: "Lazer" }));
    // Sexta já vem marcada.
    expect(within(form).getByRole("radio", { name: "Sexta" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(form).getByRole("button", { name: "Salvar previsto" }));
    await waitFor(() => expect(criarPrevisto).toHaveBeenCalledTimes(1));
    expect(criarPrevisto).toHaveBeenCalledWith({
      cartao_id: "c1", descricao: "Lanche de sexta", valor: 70, categoria: "Lazer", frequencia: "semanal",
      dia_semana: 5, dia_mes: null, essencial: null, ativo: true,
    });
    expect(await within(folha).findByText(/toda sexta · 13, 20 e 27 nov/)).toBeInTheDocument();
    // 248,55 comprado + 210 previsto.
    expect(screen.getByRole("button", { name: /Cartão de crédito: fatura/ })).toHaveTextContent("≈ R$ 458,55 previsto");
  });

  it("a fatura começou com 1.800 que a mãe paga: a meta vira 1.200 e o saldo não muda", async () => {
    vi.mocked(obterCartao).mockResolvedValue({ ...nubank, meta_total: 3000, meta_essenciais: 500 });
    vi.mocked(listarFaturas).mockResolvedValue([
      { id: "f1", user_id: "u1", cartao_id: "c1", fechamento: "2026-12-03", inicial: 1800, created_at: "" },
    ]);
    render(<Dashboard session={sessao} />);
    const cartao = await screen.findByRole("button", { name: /Cartão de crédito: fatura de dezembro/ });
    expect(cartao).toHaveTextContent("sua meta R$ 1.200,00");
    expect(cartao).toHaveTextContent("+ R$ 1.800,00 de outra pessoa");
    expect(cartao).toHaveTextContent("banco R$ 2.048,55");
    fireEvent.click(cartao);
    const folha = await screen.findByRole("dialog", { name: "Fatura de dezembro" });
    expect(folha).toHaveTextContent("Começou com R$ 1.800,00 · outra pessoa paga");
    expect(folha).toHaveTextContent("Sua meta: R$ 1.200,00 (R$ 3.000,00 − R$ 1.800,00 de outra pessoa)");
    // Essenciais 500; livre 1.200 − 500 = 700.
    expect(folha).toHaveTextContent(/Livre.*de R\$\s700,00/);
    fireEvent.click(within(folha).getByRole("button", { name: "Fechar" }));
    proximoMes();
    await screen.findByRole("button", { name: /Fatura do cartão, R\$\s248,55/ });
    // Do saldo sai só a parte dele: 5.000 − 248,55.
    expect(document.querySelector(".card-saldo")).toHaveTextContent("R$ 4.751,45");
  });

  it("informar pela fatura quanto ela começou", async () => {
    vi.mocked(salvarInicial).mockImplementation(async (cartao_id, fechamento, inicial) => ({ id: "f1", user_id: "u1", cartao_id, fechamento, inicial, created_at: "" }));
    render(<Dashboard session={sessao} />);
    fireEvent.click(await screen.findByRole("button", { name: /Cartão de crédito: fatura/ }));
    const folha = await screen.findByRole("dialog", { name: "Fatura de dezembro" });
    fireEvent.click(within(folha).getByRole("button", { name: "informar" }));
    const form = (await screen.findAllByRole("dialog", { name: "Fatura de dezembro" }))[1];
    await userEvent.type(within(form).getByLabelText("Começou com"), "1.800,00");
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(salvarInicial).toHaveBeenCalledWith("c1", "2026-12-03", 1800));
    expect(await within(folha).findByText(/outra pessoa paga/)).toBeInTheDocument();
  });

  it("um mês com só a fatura calculada não oferece Repetir", async () => {
    vi.mocked(listarLancamentos).mockResolvedValue([]);
    render(<Dashboard session={sessao} />);
    await screen.findByRole("button", { name: /Cartão de crédito: fatura/ });
    proximoMes();
    await screen.findByRole("button", { name: /Fatura do cartão/ });
    proximoMes();
    await screen.findByRole("heading", { name: "Lançamentos de Janeiro" });
    expect(screen.queryByRole("button", { name: /Repetir/ })).toBeNull();
  });
});
