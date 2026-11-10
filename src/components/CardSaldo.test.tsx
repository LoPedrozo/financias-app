// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import CardSaldo from "./CardSaldo";
import Dashboard from "./Dashboard";
import { brl } from "../lib/format";
import {
  calcularPendentes,
  calcularSaldoAcumulado,
  calcularSaldoProjetado,
} from "../lib/calculos";
import { listarLancamentos } from "../lib/lancamentos";
import type { Lancamento } from "../types";

vi.mock("../lib/supabase", () => ({ supabase: { auth: { signOut: vi.fn() } } }));
// Sem cartão configurado: o Dashboard busca o cartão a cada atualização.
vi.mock("../lib/cartao", () => ({
  obterCartao: vi.fn(async () => null),
  listarCompras: vi.fn(async () => []),
  listarPrevistos: vi.fn(async () => []),
}));
vi.mock("../lib/lancamentos", () => ({
  listarLancamentos: vi.fn(async () => []),
  criarLancamento: vi.fn(), atualizarLancamento: vi.fn(), removerLancamento: vi.fn(),
  criarLancamentosEmLote: vi.fn(), removerLancamentosEmLote: vi.fn(),
}));
vi.mock("../lib/recorrencias", () => ({
  listarRecorrencias: vi.fn(async () => []),
  gerarLancamentosRecorrentes: vi.fn(async () => []),
}));

afterEach(() => vi.useRealTimers());

const pendente = (entra: number, nEntra: number, sai: number, nSai: number) => ({
  entradas: { total: entra, quantidade: nEntra },
  saidas: { total: sai, quantidade: nSai },
});

// Os números do print: 295 + 9.225 − 6.450 = 3.070.
const doPrint = () =>
  render(
    <CardSaldo valor={295} pendente={pendente(9225, 12, 6450, 3)} saldoProjetado={3070} />
  );

describe("CardSaldo", () => {
  it("mostra a conta inteira, sem precisar tocar", () => {
    doPrint();
    expect(screen.getByText("Saldo atual").nextElementSibling).toHaveTextContent("R$ 295,00");
    expect(screen.getByText("≈ Fim do mês").nextElementSibling).toHaveTextContent("R$ 3.070,00");
    expect(screen.getByText(/entra \(12\)/)).toHaveTextContent("R$ 9.225,00");
    expect(screen.getByText(/sai \(3\)/)).toHaveTextContent("R$ 6.450,00");
  });

  // A legenda mostra centavos de propósito: "R$ 9.225" num número que é
  // 9.225,50 seria um arredondamento escondido no card que não pode errar.
  it("não arredonda nada: centavos aparecem como são", () => {
    render(
      <CardSaldo valor={0.01} pendente={pendente(1234.56, 1, 0.07, 1)} saldoProjetado={1234.5} />
    );
    expect(screen.getByText(/entra/)).toHaveTextContent("R$ 1.234,56");
    expect(screen.getByText(/sai/)).toHaveTextContent("R$ 0,07");
    expect(screen.getByText("≈ Fim do mês").nextElementSibling).toHaveTextContent("R$ 1.234,50");
  });

  it("a barra divide o movimento na proporção de entra e sai", () => {
    const { container } = doPrint();
    const [parteEntra, parteSai] = container.querySelectorAll<HTMLElement>(
      "[aria-hidden='true'] > div"
    );
    // 9.225 ÷ 15.675 = 58,85%
    expect(parseFloat(parteEntra.style.width)).toBeCloseTo(58.85, 1);
    expect(parseFloat(parteSai.style.width)).toBeCloseTo(41.15, 1);
  });

  it("fim do mês negativo acende o alerta, para não passar despercebido", () => {
    render(<CardSaldo valor={100} pendente={pendente(0, 0, 900, 1)} saldoProjetado={-800} />);
    expect(screen.getByTitle("Valor negativo")).toHaveTextContent("-R$ 800,00");
  });

  it("saldo atual negativo também", () => {
    render(<CardSaldo valor={-50} pendente={pendente(200, 1, 0, 0)} saldoProjetado={150} />);
    expect(screen.getByTitle("Valor negativo")).toHaveTextContent("-R$ 50,00");
  });

  // Resto de ponto flutuante não é dívida: −0,000001 aparece "R$ 0,00" e não
  // pode vir com alerta de que vai faltar dinheiro.
  it("resto de arredondamento não vira alerta falso", () => {
    render(<CardSaldo valor={-0.000001} pendente={pendente(10, 1, 0, 0)} saldoProjetado={9.999999} />);
    expect(screen.queryByTitle("Valor negativo")).not.toBeInTheDocument();
  });

  it("sem nada pendente, mostra só o saldo e diz por quê", () => {
    render(<CardSaldo valor={295} pendente={pendente(0, 0, 0, 0)} saldoProjetado={undefined} />);
    expect(screen.queryByText("≈ Fim do mês")).not.toBeInTheDocument();
    expect(screen.getByText(/Nada a receber ou a pagar/)).toBeInTheDocument();
  });

  it("só uma das pontas pendente: mostra só ela", () => {
    render(<CardSaldo valor={295} pendente={pendente(0, 0, 100, 1)} saldoProjetado={195} />);
    expect(screen.queryByText(/entra/)).not.toBeInTheDocument();
    expect(screen.getByText(/sai \(1\)/)).toBeInTheDocument();
  });

  it("com Contas a Pagar ligada, diz quanto da saída veio de lá", () => {
    render(
      <CardSaldo
        valor={1000}
        pendente={pendente(0, 0, 500, 3)}
        contasAPagar={{ total: 200, quantidade: 1 }}
        saldoProjetado={500}
      />
    );
    expect(screen.getByText(/Inclui R\$ 200,00 em contas a pagar \(1\)/)).toBeInTheDocument();
  });
});

describe("CardSaldo no Dashboard", () => {
  const l = (id: string, tipo: "entrada" | "saida", valor: number, data: string | null, mes: number, ano: number): Lancamento => ({
    id, user_id: "u1", tipo, valor, descricao: id, categoria: "Outros", mes, ano, data, created_at: "",
  });

  // O card não calcula nada: tem que mostrar exatamente o que as funções de
  // calculos.ts devolvem, e a conta exibida tem que fechar nos centavos.
  it("mostra exatamente o que o cálculo devolve, e a conta fecha na tela", async () => {
    vi.setSystemTime(new Date(2026, 10, 6, 12));
    const dados = [
      l("antigo-sem-data", "entrada", 100.1, null, 8, 2026),
      l("outubro", "entrada", 294.9, "2026-10-20", 9, 2026),
      l("ontem", "saida", 37.33, "2026-11-05", 10, 2026),
      l("mesada", "entrada", 6750, "2026-11-08", 10, 2026),
      l("cartao", "saida", 4715.47, "2026-11-10", 10, 2026),
      l("reembolso", "entrada", 27.53, "2026-11-23", 10, 2026),
      l("dezembro", "saida", 999, "2026-12-01", 11, 2026), // fora do mês da tela
    ];
    vi.mocked(listarLancamentos).mockResolvedValue(dados);

    render(<Dashboard session={{ user: { id: "u1", email: "eu@x.com" } } as unknown as Session} />);
    await screen.findByText("mesada");

    const atual = calcularSaldoAcumulado(dados, 10, 2026);
    const pend = calcularPendentes(dados, 10, 2026);
    const fim = calcularSaldoProjetado(dados, 10, 2026);
    // brl() separa "R$" do número com espaço inquebrável, e o matcher
    // normaliza o texto da tela para espaço comum. Mesmo valor, outro espaço.
    const tela = (v: number) => brl(v).replace(/\s/g, " ");

    expect(screen.getByText("Saldo atual").nextElementSibling).toHaveTextContent(tela(atual));
    expect(screen.getByText("≈ Fim do mês").nextElementSibling).toHaveTextContent(tela(fim));
    expect(screen.getByText(/entra \(/)).toHaveTextContent(tela(pend.entradas.total));
    expect(screen.getByText(/sai \(/)).toHaveTextContent(tela(pend.saidas.total));

    // E a conta que a pessoa faz de cabeça com o que lê fecha.
    const lido = (t: string) => Number(t.replace(/[^\d,-]/g, "").replace(",", "."));
    const naTela = {
      atual: lido(screen.getByText("Saldo atual").nextElementSibling!.textContent!),
      fim: lido(screen.getByText("≈ Fim do mês").nextElementSibling!.textContent!),
      entra: lido(screen.getByText(/entra \(/).textContent!.split("entra")[0]),
      sai: lido(screen.getByText(/sai \(/).textContent!.split("sai")[0]),
    };
    expect(Math.round((naTela.atual + naTela.entra - naTela.sai) * 100)).toBe(
      Math.round(naTela.fim * 100)
    );
    // Conferência à mão: 100,10 + 294,90 − 37,33 = 357,67 hoje;
    // + 6.777,53 − 4.715,47 = 2.419,73 no fim do mês.
    expect(naTela.atual).toBe(357.67);
    expect(naTela.fim).toBe(2419.73);
  });
});

// Com a animação ligada (o jsdom não tem matchMedia, então aqui ela é
// ligada à mão), o número passa pelo meio do caminho mas para no valor
// exato — e o alerta de negativo segue o valor de verdade desde o início.
describe("CardSaldo com os números rolando", () => {
  afterEach(() => {
    // @ts-expect-error — o jsdom não tem matchMedia; tiramos o mock.
    delete window.matchMedia;
  });

  it("termina exatamente nos valores novos", async () => {
    const { act } = await import("@testing-library/react");
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance"],
    });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;

    const { rerender } = doPrint();
    const atual = () => screen.getByText("Saldo atual").nextElementSibling;
    const fim = () => screen.getByText("≈ Fim do mês").nextElementSibling;

    rerender(
      <CardSaldo valor={-12.34} pendente={pendente(2500, 1, 67.93, 2)} saldoProjetado={2419.73} />
    );
    // O alerta não espera a animação: o valor de verdade já é negativo.
    expect(atual()?.querySelector('[title="Valor negativo"]')).not.toBeNull();

    act(() => vi.advanceTimersByTime(120));
    expect(atual()).not.toHaveTextContent("-R$ 12,34");
    expect(fim()).not.toHaveTextContent("R$ 2.419,73");

    act(() => vi.advanceTimersByTime(1300));
    expect(atual()).toHaveTextContent("-R$ 12,34");
    expect(fim()).toHaveTextContent("R$ 2.419,73");
  });
});
