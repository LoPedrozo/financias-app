// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { podeAnimar, vibrar } from "./movimento";

afterEach(() => {
  // @ts-expect-error — limpa os mocks; o jsdom não tem nenhum dos dois.
  delete navigator.vibrate;
  // @ts-expect-error — idem.
  delete window.matchMedia;
});

describe("vibrar", () => {
  it("dá um toque curto onde o navegador sabe vibrar", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    vibrar();
    expect(vibrate).toHaveBeenCalledWith(8);
  });

  it("no iPhone (sem vibrate) não faz nada e não quebra", () => {
    expect(() => vibrar()).not.toThrow();
  });

  it("navegador que lança erro não derruba o toque", () => {
    Object.defineProperty(navigator, "vibrate", {
      value: () => {
        throw new Error("sem permissão");
      },
      configurable: true,
    });
    expect(() => vibrar()).not.toThrow();
  });
});

describe("podeAnimar", () => {
  it("sem matchMedia, não anima", () => {
    expect(podeAnimar()).toBe(false);
  });

  it("respeita o 'reduzir movimento' do sistema", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    expect(podeAnimar()).toBe(false);
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    expect(podeAnimar()).toBe(true);
  });
});
