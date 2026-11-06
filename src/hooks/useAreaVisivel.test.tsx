// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import ModalNovo from "../components/ModalNovo";

// O jsdom não tem visualViewport. Aqui ela é de mentira, para simular o
// teclado do iPhone abrindo: a área visível encolhe, a janela não.
class ViewportFalsa extends EventTarget {
  height = 844;
  offsetTop = 0;
  mudar(height: number, offsetTop = 0) {
    this.height = height;
    this.offsetTop = offsetTop;
    this.dispatchEvent(new Event("resize"));
  }
}

function instalar() {
  const vv = new ViewportFalsa();
  Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
  return vv;
}

afterEach(() => {
  Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });
});

const overlay = () => screen.getByRole("dialog").parentElement!;

describe("formulário com o teclado do iPhone", () => {
  it("sem teclado, a folha ocupa a tela toda", () => {
    instalar();
    render(<ModalNovo onFechar={() => {}} onSalvar={() => {}} />);
    expect(overlay().style.top).toBe("0px");
    expect(overlay().style.height).toBe("844px");
    expect(overlay()).not.toHaveAttribute("data-teclado");
  });

  it("com o teclado aberto, a folha termina logo acima dele", () => {
    const vv = instalar();
    render(<ModalNovo onFechar={() => {}} onSalvar={() => {}} />);
    // Teclado de 336px; o Safari ainda rolou a página 120px para cima.
    act(() => vv.mudar(508, 120));
    expect(overlay().style.top).toBe("120px");
    expect(overlay().style.height).toBe("508px");
    expect(overlay()).toHaveAttribute("data-teclado");
    // O Salvar é filho da folha, que cabe nessa área: fica acima do teclado.
    expect(screen.getByRole("button", { name: "Salvar entrada" })).toBeInTheDocument();

    act(() => vv.mudar(844, 0));
    expect(overlay().style.height).toBe("844px");
    expect(overlay()).not.toHaveAttribute("data-teclado");
  });

  it("sem visualViewport (navegador antigo), ocupa a tela toda como antes", () => {
    render(<ModalNovo onFechar={() => {}} onSalvar={() => {}} />);
    expect(overlay().style.top).toBe("0px");
    expect(overlay().style.height).toBe("100%");
  });
});
