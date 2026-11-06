// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useValorAnimado } from "./useValorAnimado";

// O número do topo pode passar por valores intermediários, mas tem que
// terminar no valor exato — é o mesmo número que decide se dá para pagar uma
// conta. Estes testes ligam a animação (o jsdom não tem matchMedia, e sem ele
// o hook não anima) e conferem o fim por todos os caminhos.

function ligarAnimacao(reduzir = false) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduzir }) as never;
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance"],
  });
  ligarAnimacao();
});

afterEach(() => {
  vi.useRealTimers();
  // @ts-expect-error — some com o mock; o jsdom não tem matchMedia.
  delete window.matchMedia;
});

describe("useValorAnimado", () => {
  it("no primeiro render mostra o valor pronto", () => {
    const { result } = renderHook(() => useValorAnimado(8550));
    expect(result.current).toBe(8550);
  });

  it("passa por valores intermediários e termina no valor exato", () => {
    const { result, rerender } = renderHook(({ v }) => useValorAnimado(v), {
      initialProps: { v: 8550 },
    });
    rerender({ v: 7200.37 });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBeGreaterThan(7200.37);
    expect(result.current).toBeLessThan(8550);
    act(() => vi.advanceTimersByTime(400));
    expect(result.current).toBe(7200.37);
  });

  it("valor trocado no meio da animação termina no último", () => {
    const { result, rerender } = renderHook(({ v }) => useValorAnimado(v), {
      initialProps: { v: 100 },
    });
    rerender({ v: 900 });
    act(() => vi.advanceTimersByTime(150));
    rerender({ v: -42.1 });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(-42.1);
  });

  it("termina no valor exato mesmo se os quadros pararem", () => {
    const { result, rerender } = renderHook(({ v }) => useValorAnimado(v), {
      initialProps: { v: 10 },
    });
    // Simula a aba em segundo plano: nenhum quadro é desenhado.
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    rerender({ v: 2419.73 });
    act(() => vi.advanceTimersByTime(700));
    expect(result.current).toBe(2419.73);
    raf.mockRestore();
  });

  it("com 'reduzir movimento' ligado, salta direto", () => {
    ligarAnimacao(true);
    const { result, rerender } = renderHook(({ v }) => useValorAnimado(v), {
      initialProps: { v: 1 },
    });
    rerender({ v: 357.67 });
    expect(result.current).toBe(357.67);
  });

  it("sem matchMedia (navegador antigo, jsdom), salta direto", () => {
    // @ts-expect-error — simula a ausência.
    delete window.matchMedia;
    const { result, rerender } = renderHook(({ v }) => useValorAnimado(v), {
      initialProps: { v: 1 },
    });
    rerender({ v: 357.67 });
    expect(result.current).toBe(357.67);
  });
});
