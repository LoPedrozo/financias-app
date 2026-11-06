// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRemocaoComDesfazer } from "./useRemocaoComDesfazer";

// Apagar com Desfazer não pode perder nem ressuscitar lançamento: o pedido de
// exclusão vai uma vez, na hora certa, e o Desfazer devolve o mesmo objeto.

const JANELA = 7000;
type L = { id: string; descricao: string };
const a: L = { id: "a", descricao: "Mercado" };
const b: L = { id: "b", descricao: "Uber" };

function montar(remover = vi.fn(async (_: L) => {})) {
  const aoTirar = vi.fn(), aoDevolver = vi.fn(), aoFalhar = vi.fn();
  const r = renderHook(() =>
    useRemocaoComDesfazer<L>({ remover, aoTirar, aoDevolver, aoFalhar, janelaMs: JANELA })
  );
  return { ...r, remover, aoTirar, aoDevolver, aoFalhar };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("apagar com Desfazer", () => {
  it("tira da tela na hora e só apaga no servidor quando a janela fecha", () => {
    const { result, remover, aoTirar } = montar();
    act(() => result.current.apagar(a));
    expect(aoTirar).toHaveBeenCalledWith(a);
    act(() => vi.advanceTimersByTime(JANELA - 1));
    expect(remover).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(remover).toHaveBeenCalledTimes(1);
    expect(remover).toHaveBeenCalledWith(a);
  });

  it("desfazer devolve o mesmo objeto e nada é apagado, nunca", () => {
    const { result, remover, aoDevolver } = montar();
    act(() => result.current.apagar(a));
    act(() => vi.advanceTimersByTime(3000));
    let deuTempo = false;
    act(() => { deuTempo = result.current.desfazer("a"); });
    expect(deuTempo).toBe(true);
    expect(aoDevolver).toHaveBeenCalledWith(a);
    act(() => vi.advanceTimersByTime(60_000));
    expect(remover).not.toHaveBeenCalled();
  });

  it("apagar outro manda o anterior na hora; cada um é apagado uma vez só", () => {
    const { result, remover } = montar();
    act(() => result.current.apagar(a));
    act(() => result.current.apagar(b));
    expect(remover).toHaveBeenCalledTimes(1);
    expect(remover).toHaveBeenLastCalledWith(a);
    // O Desfazer do primeiro já não vale; o do segundo, sim.
    let r1 = true, r2 = false;
    act(() => { r1 = result.current.desfazer("a"); r2 = result.current.desfazer("b"); });
    expect(r1).toBe(false);
    expect(r2).toBe(true);
    act(() => vi.advanceTimersByTime(60_000));
    expect(remover).toHaveBeenCalledTimes(1);
  });

  it("desfazer depois que a exclusão foi enviada não devolve nada", () => {
    const { result, aoDevolver } = montar();
    act(() => result.current.apagar(a));
    act(() => vi.advanceTimersByTime(JANELA));
    let deuTempo = true;
    act(() => { deuTempo = result.current.desfazer("a"); });
    expect(deuTempo).toBe(false);
    expect(aoDevolver).not.toHaveBeenCalled();
  });

  it("servidor recusou: avisa com o item, para voltar à tela", async () => {
    const erro = new Error("sem rede");
    const { result, aoFalhar } = montar(vi.fn(async () => { throw erro; }));
    act(() => result.current.apagar(a));
    await act(async () => { vi.advanceTimersByTime(JANELA); });
    expect(aoFalhar).toHaveBeenCalledWith(a, erro);
  });

  it("app indo para o segundo plano manda a exclusão na hora", () => {
    const { result, remover } = montar();
    act(() => result.current.apagar(a));
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    expect(remover).toHaveBeenCalledWith(a);
    act(() => vi.advanceTimersByTime(60_000));
    expect(remover).toHaveBeenCalledTimes(1);
  });

  it("sair da tela manda a exclusão na hora", () => {
    const { result, remover, unmount } = montar();
    act(() => result.current.apagar(a));
    unmount();
    expect(remover).toHaveBeenCalledWith(a);
  });

  it("idEsperando diz qual item ainda está na janela", () => {
    const { result } = montar();
    expect(result.current.idEsperando()).toBeNull();
    act(() => result.current.apagar(a));
    expect(result.current.idEsperando()).toBe("a");
    act(() => vi.advanceTimersByTime(JANELA));
    expect(result.current.idEsperando()).toBeNull();
  });
});
