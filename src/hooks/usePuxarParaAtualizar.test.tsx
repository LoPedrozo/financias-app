// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LIMIAR_PUXAR, usePuxarParaAtualizar } from "./usePuxarParaAtualizar";

// O gesto tem de agir só quando é dele: no topo, para baixo, sem modal. Fora
// disso, o dedo pertence à rolagem da página e ao deslizar das linhas.

function Teste({ onAtualizar, ativo = true }: { onAtualizar: () => Promise<unknown>; ativo?: boolean }) {
  const { distancia, estado } = usePuxarParaAtualizar(onAtualizar, ativo);
  return <p data-testid="estado">{`${estado} ${Math.round(distancia)}`}</p>;
}
const estado = () => screen.getByTestId("estado").textContent!.split(" ")[0];

// Um gesto: começa em (100, 100) e anda dx/dy em dois passos. Devolve se o
// navegador teria podido seguir com o padrão dele (false = preventDefault).
function arrastar(dx: number, dy: number, soltar: "touchEnd" | "touchCancel" | null = "touchEnd") {
  const alvo = document.body;
  fireEvent.touchStart(alvo, { touches: [{ clientX: 100, clientY: 100 }] });
  fireEvent.touchMove(alvo, { touches: [{ clientX: 100 + dx / 2, clientY: 100 + dy / 2 }] });
  const seguiu = fireEvent.touchMove(alvo, { touches: [{ clientX: 100 + dx, clientY: 100 + dy }] });
  if (soltar) fireEvent[soltar](alvo, { touches: [] });
  return seguiu;
}
// Com o elástico de 0,5, o dedo anda o dobro do indicador.
const PASSA_DO_LIMIAR = LIMIAR_PUXAR * 2 + 20;

afterEach(() => {
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  document.querySelectorAll("[data-modal]").forEach((el) => el.remove());
});

describe("puxar para atualizar", () => {
  it("puxar além do limiar e soltar atualiza uma vez, mostra o estado e volta ao lugar", async () => {
    let terminar!: () => void;
    const onAtualizar = vi.fn(() => new Promise<void>((r) => (terminar = r)));
    render(<Teste onAtualizar={onAtualizar} />);
    arrastar(0, PASSA_DO_LIMIAR);
    expect(onAtualizar).toHaveBeenCalledTimes(1);
    expect(estado()).toBe("atualizando");
    // Puxar de novo enquanto atualiza não dispara outra.
    arrastar(0, PASSA_DO_LIMIAR);
    expect(onAtualizar).toHaveBeenCalledTimes(1);
    await act(async () => terminar());
    await waitFor(() => expect(estado()).toBe("parado"), { timeout: 2000 });
  });

  it("antes de soltar, mostra quando já vai atualizar", () => {
    render(<Teste onAtualizar={vi.fn(async () => {})} />);
    arrastar(0, 40, null);
    expect(estado()).toBe("puxando");
    fireEvent.touchMove(document.body, { touches: [{ clientX: 100, clientY: 100 + PASSA_DO_LIMIAR }] });
    expect(estado()).toBe("pronto");
  });

  it("puxão curto não atualiza e volta", async () => {
    const onAtualizar = vi.fn(async () => {});
    render(<Teste onAtualizar={onAtualizar} />);
    arrastar(0, 60);
    expect(onAtualizar).not.toHaveBeenCalled();
    // Sobe de volta (o CSS anima) e para.
    expect(estado()).toBe("voltando");
    await waitFor(() => expect(estado()).toBe("parado"));
  });

  it("segura o elástico do Safari só no puxão para baixo", () => {
    render(<Teste onAtualizar={vi.fn(async () => {})} />);
    expect(arrastar(0, PASSA_DO_LIMIAR)).toBe(false);
  });

  it("para cima é rolar: não atualiza nem segura a página", () => {
    const onAtualizar = vi.fn(async () => {});
    render(<Teste onAtualizar={onAtualizar} />);
    expect(arrastar(0, -PASSA_DO_LIMIAR)).toBe(true);
    expect(onAtualizar).not.toHaveBeenCalled();
  });

  it("para o lado é da lista (deslizar a linha): não atualiza nem segura", () => {
    const onAtualizar = vi.fn(async () => {});
    render(<Teste onAtualizar={onAtualizar} />);
    // Diagonal mais para o lado do que para baixo.
    expect(arrastar(-180, 120)).toBe(true);
    expect(onAtualizar).not.toHaveBeenCalled();
  });

  it("com a página rolada para baixo, puxar é rolar", () => {
    Object.defineProperty(window, "scrollY", { value: 300, configurable: true });
    const onAtualizar = vi.fn(async () => {});
    render(<Teste onAtualizar={onAtualizar} />);
    expect(arrastar(0, PASSA_DO_LIMIAR)).toBe(true);
    expect(onAtualizar).not.toHaveBeenCalled();
  });

  it("com um modal aberto, não faz nada", () => {
    const modal = document.createElement("div");
    modal.setAttribute("data-modal", "");
    document.body.appendChild(modal);
    const onAtualizar = vi.fn(async () => {});
    render(<Teste onAtualizar={onAtualizar} />);
    expect(arrastar(0, PASSA_DO_LIMIAR)).toBe(true);
    expect(onAtualizar).not.toHaveBeenCalled();
  });

  it("dedo interrompido pelo sistema (touchcancel) não atualiza", async () => {
    const onAtualizar = vi.fn(async () => {});
    render(<Teste onAtualizar={onAtualizar} />);
    arrastar(0, PASSA_DO_LIMIAR, "touchCancel");
    expect(onAtualizar).not.toHaveBeenCalled();
    await waitFor(() => expect(estado()).toBe("parado"));
  });

  it("desligado (computador, mouse), não escuta nada", () => {
    const onAtualizar = vi.fn(async () => {});
    render(<Teste onAtualizar={onAtualizar} ativo={false} />);
    expect(arrastar(0, PASSA_DO_LIMIAR)).toBe(true);
    expect(onAtualizar).not.toHaveBeenCalled();
  });

  it("uma atualização que falha também devolve o indicador ao lugar", async () => {
    render(<Teste onAtualizar={vi.fn(async () => Promise.reject(new Error("sem rede")))} />);
    arrastar(0, PASSA_DO_LIMIAR);
    await waitFor(() => expect(estado()).toBe("parado"), { timeout: 2000 });
  });
});
