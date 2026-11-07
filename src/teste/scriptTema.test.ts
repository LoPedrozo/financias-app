// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  CHAVE_PREFERENCIAS,
  PADRAO,
  aplicarNoDocumento,
} from "../lib/preferencias";
import type { Preferencias } from "../lib/preferencias";

// O index.html carrega um script que aplica tema, cor e lista antes do React
// existir — senão quem escolheu o escuro veria um flash claro a cada abertura.
// Ele é uma cópia em JS puro da regra de src/lib/preferencias.ts, e cópia é
// exatamente o que diverge sem ninguém ver. Aqui o script de verdade roda e o
// resultado é comparado com o da biblioteca, caso a caso.
const html = readFileSync("index.html", "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];

function rodarScript(sistemaEscuro: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("dark") ? sistemaEscuro : false,
  }));
  window.matchMedia = globalThis.matchMedia;
  new Function(script)();
}

function atributos(raiz: HTMLElement) {
  return {
    tema: raiz.getAttribute("data-tema"),
    destaque: raiz.getAttribute("data-destaque"),
    lista: raiz.getAttribute("data-lista"),
    preto: raiz.getAttribute("data-preto"),
    vidro: raiz.getAttribute("data-vidro"),
  };
}

function limpar() {
  const raiz = document.documentElement;
  ["data-tema", "data-destaque", "data-lista", "data-preto", "data-vidro"].forEach((a) =>
    raiz.removeAttribute(a)
  );
  localStorage.clear();
}

afterEach(() => {
  limpar();
  vi.unstubAllGlobals();
});

const casos: Array<[string, Partial<Preferencias> | null, boolean]> = [
  ["nada salvo, sistema claro", null, false],
  ["nada salvo, sistema escuro", null, true],
  ["automático segue o sistema escuro", { tema: "auto" }, true],
  ["escuro manual com sistema claro", { tema: "escuro" }, false],
  ["claro manual com sistema escuro", { tema: "claro" }, true],
  ["destaque roxo", { destaque: "roxo" }, false],
  ["dourado não grava atributo", { destaque: "dourado" }, false],
  ["lista compacta", { listaCompacta: true }, false],
  ["preto total no escuro", { tema: "escuro", preto: true }, false],
  ["preto total com o automático (sistema escuro)", { tema: "auto", preto: true }, true],
  ["preto total gravado com o tema claro", { tema: "claro", preto: true }, false],
  ["vidro no claro", { vidro: true }, false],
  ["vidro e preto juntos", { tema: "escuro", vidro: true, preto: true }, false],
  [
    "tudo junto",
    { tema: "escuro", destaque: "azul", listaCompacta: true, ocultarValores: true },
    false,
  ],
];

describe("script anti-flash do index.html", () => {
  it("usa a mesma chave da biblioteca", () => {
    expect(script).toContain(`"${CHAVE_PREFERENCIAS}"`);
  });

  for (const [nome, salvo, sistemaEscuro] of casos) {
    it(`concorda com a biblioteca: ${nome}`, () => {
      const preferencias = { ...PADRAO, ...(salvo ?? {}) };

      if (salvo) localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(preferencias));
      rodarScript(sistemaEscuro);
      const doScript = atributos(document.documentElement);

      limpar();
      const referencia = document.createElement("html");
      aplicarNoDocumento(preferencias, sistemaEscuro, referencia);

      expect(doScript).toEqual(atributos(referencia));
    });
  }

  it("JSON quebrado não impede o app de abrir — cai no padrão", () => {
    localStorage.setItem(CHAVE_PREFERENCIAS, "{quebrado");
    expect(() => rodarScript(false)).not.toThrow();
    expect(document.documentElement.getAttribute("data-tema")).toBe("claro");
  });

  it("localStorage bloqueado também não", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(() => rodarScript(true)).not.toThrow();
    expect(document.documentElement.getAttribute("data-tema")).toBe("escuro");
  });
});
