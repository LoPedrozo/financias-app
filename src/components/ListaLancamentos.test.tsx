// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import ListaLancamentos from "./ListaLancamentos";
import type { Lancamento } from "../types";

const l = (id: string, tipo: "entrada" | "saida", valor: number, data: string, categoria = "Outros"): Lancamento => ({
  id, user_id: "u", tipo, valor, descricao: id, categoria, mes: 10, ano: 2026, data, created_at: `${data}T10:00:00Z`,
});
const HOJE = "2026-11-06";
const dados = [
  l("cartao", "saida", 4715.47, "2026-11-10", "Cartão de Crédito / Contas"),
  l("mercado", "saida", 152.4, "2026-11-06", "Alimentação"),
  l("uber", "saida", 23.9, "2026-11-06", "Transporte"),
  l("mesada", "entrada", 130, "2026-11-05", "Mesada"),
];

function montar(props: Partial<React.ComponentProps<typeof ListaLancamentos>> = {}) {
  const fns = { onEditar: vi.fn(), onExcluir: vi.fn(), onCorrigirValor: vi.fn() };
  const r = render(<ListaLancamentos lancamentos={dados} hoje={HOJE} {...fns} {...props} />);
  return { ...r, ...fns };
}

// Celular: o hook de toque consulta matchMedia.
function ligarToque() {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never;
}
afterEach(() => {
  // @ts-expect-error — o jsdom não tem matchMedia; tira o mock.
  delete window.matchMedia;
});

const linha = (id: string) => screen.getByText(id).closest(".item-lancamento") as HTMLElement;
const conteudo = (id: string) => linha(id).querySelector(".linha-conteudo") as HTMLElement;
function deslizar(el: HTMLElement, dx: number, dy = 0) {
  fireEvent.touchStart(el, { touches: [{ clientX: 300, clientY: 100 }] });
  fireEvent.touchMove(el, { touches: [{ clientX: 300 + dx / 2, clientY: 100 + dy / 2 }] });
  fireEvent.touchMove(el, { touches: [{ clientX: 300 + dx, clientY: 100 + dy }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: 300 + dx, clientY: 100 + dy }] });
}

describe("lista por dia", () => {
  it("agendados no topo, depois Hoje e Ontem, cada um com o total do dia", () => {
    montar();
    const grupos = screen.getAllByRole("region");
    expect(grupos.map((g) => g.getAttribute("aria-label"))).toEqual(["Agendados", "Hoje", "Ontem"]);
    const total = (g: HTMLElement) => g.querySelector(".lista-dia")!.textContent!.replace(/\s/g, " ");
    expect(total(grupos[1])).toMatch(/− R\$ 176,30$/); // 152,40 + 23,90, as duas saídas
    expect(total(grupos[2])).toMatch(/\+ R\$ 130,00$/);
    expect(total(grupos[0])).toMatch(/− R\$ 4\.715,47$/);
    // O agendado diz quando vai acontecer, escrito na linha.
    expect(within(grupos[0]).getByText(/Ter, 10 nov · Cartão de Crédito/)).toBeInTheDocument();
  });
});

describe("no computador (mouse)", () => {
  it("lápis e lixeira à vista, sem deslizar", () => {
    const { onEditar, onExcluir } = montar();
    fireEvent.click(within(linha("mercado")).getByRole("button", { name: "Editar lançamento" }));
    expect(onEditar).toHaveBeenCalledWith(dados[1]);
    fireEvent.click(within(linha("uber")).getByRole("button", { name: "Excluir lançamento" }));
    expect(onExcluir).toHaveBeenCalledWith(dados[2]);
    deslizar(conteudo("mercado"), -200);
    expect(conteudo("mercado").style.transform).toBe("translateX(0px)");
  });
});

describe("no celular (toque)", () => {
  it("deslizar para a esquerda abre Editar e Apagar", () => {
    ligarToque();
    const { onExcluir } = montar();
    deslizar(conteudo("mercado"), -200);
    expect(conteudo("mercado").style.transform).toBe("translateX(-152px)");
    fireEvent.click(within(linha("mercado")).getByRole("button", { name: "Excluir lançamento" }));
    expect(onExcluir).toHaveBeenCalledWith(dados[1]);
  });

  it("deslize curto volta ao lugar", () => {
    ligarToque();
    montar();
    deslizar(conteudo("mercado"), -50);
    expect(conteudo("mercado").style.transform).toBe("translateX(0px)");
  });

  it("gesto vertical é rolagem: não abre a linha", () => {
    ligarToque();
    montar();
    deslizar(conteudo("mercado"), -30, 200);
    expect(conteudo("mercado").style.transform).toBe("translateX(0px)");
  });

  // O deslizar da página troca de mês. O da linha não pode chegar até ela.
  it("o deslizar da linha não vaza para a página; a rolagem vertical, sim", () => {
    ligarToque();
    const naPagina = vi.fn();
    render(
      <div onTouchEnd={naPagina}>
        <ListaLancamentos lancamentos={dados} hoje={HOJE} onEditar={vi.fn()} onExcluir={vi.fn()} onCorrigirValor={vi.fn()} />
      </div>
    );
    deslizar(conteudo("mercado"), -200);
    expect(naPagina).not.toHaveBeenCalled();
    deslizar(conteudo("uber"), 0, 200);
    expect(naPagina).toHaveBeenCalledTimes(1);
  });

  it("uma linha aberta por vez; tocar na aberta só fecha", () => {
    ligarToque();
    const { onCorrigirValor } = montar();
    deslizar(conteudo("mercado"), -200);
    deslizar(conteudo("uber"), -200);
    expect(conteudo("mercado").style.transform).toBe("translateX(0px)");
    expect(conteudo("uber").style.transform).toBe("translateX(-152px)");
    // Toque no valor da linha aberta: fecha, e não abre a correção.
    fireEvent.click(within(linha("uber")).getByTitle("Tocar para corrigir o valor"));
    expect(conteudo("uber").style.transform).toBe("translateX(0px)");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(onCorrigirValor).not.toHaveBeenCalled();
  });

  it("deslizar para a direita fecha a linha aberta", () => {
    ligarToque();
    montar();
    deslizar(conteudo("mercado"), -200);
    deslizar(conteudo("mercado"), 200);
    expect(conteudo("mercado").style.transform).toBe("translateX(0px)");
  });
});

describe("correção rápida do valor", () => {
  it("Enter salva o valor novo", () => {
    const { onCorrigirValor } = montar();
    fireEvent.click(within(linha("mercado")).getByTitle("Tocar para corrigir o valor"));
    const campo = screen.getByLabelText("Valor de mercado");
    fireEvent.change(campo, { target: { value: "200,50" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    fireEvent.blur(campo);
    expect(onCorrigirValor).toHaveBeenCalledWith(dados[1], 200.5);
  });

  it("Esc desiste; valor igual ou inválido não salva", () => {
    const { onCorrigirValor } = montar();
    fireEvent.click(within(linha("mercado")).getByTitle("Tocar para corrigir o valor"));
    let campo = screen.getByLabelText("Valor de mercado");
    fireEvent.change(campo, { target: { value: "999" } });
    fireEvent.keyDown(campo, { key: "Escape" });
    fireEvent.blur(campo);

    fireEvent.click(within(linha("mercado")).getByTitle("Tocar para corrigir o valor"));
    campo = screen.getByLabelText("Valor de mercado");
    fireEvent.blur(campo); // continua 152,40

    fireEvent.click(within(linha("mercado")).getByTitle("Tocar para corrigir o valor"));
    campo = screen.getByLabelText("Valor de mercado");
    fireEvent.change(campo, { target: { value: "" } });
    fireEvent.blur(campo);
    expect(onCorrigirValor).not.toHaveBeenCalled();
  });
});
