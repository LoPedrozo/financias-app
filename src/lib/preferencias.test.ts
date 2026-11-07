// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  CHAVE_PREFERENCIAS,
  PADRAO,
  aplicarNoDocumento,
  lerPreferencias,
  salvarPreferencias,
  temaEfetivo,
} from "./preferencias";

function armazem(inicial: Record<string, string> = {}) {
  const dados = { ...inicial };
  return {
    dados,
    getItem: (k: string) => dados[k] ?? null,
    setItem: (k: string, v: string) => {
      dados[k] = v;
    },
  };
}

describe("lerPreferencias", () => {
  it("sem nada salvo, devolve o padrão", () => {
    expect(lerPreferencias(armazem())).toEqual(PADRAO);
  });

  it("devolve o que foi salvo", () => {
    const a = armazem();
    const minhas = {
      tema: "escuro" as const,
      destaque: "roxo" as const,
      ocultarValores: true,
      listaCompacta: true,
      preto: true,
      vidro: true,
    };
    salvarPreferencias(minhas, a);
    expect(lerPreferencias(a)).toEqual(minhas);
  });

  // Dado velho ou mexido à mão não pode impedir o app de abrir.
  it("JSON quebrado volta tudo ao padrão", () => {
    expect(
      lerPreferencias(armazem({ [CHAVE_PREFERENCIAS]: "{isso não é json" }))
    ).toEqual(PADRAO);
  });

  it("campo inválido volta ao padrão sem levar os válidos junto", () => {
    const a = armazem({
      [CHAVE_PREFERENCIAS]: JSON.stringify({
        tema: "neon",
        destaque: "verde", // não existe mais: verde é a cor de entrada
        ocultarValores: true,
        listaCompacta: "sim",
        preto: 1,
        vidro: true,
      }),
    });
    expect(lerPreferencias(a)).toEqual({
      tema: "auto",
      destaque: "dourado",
      ocultarValores: true,
      listaCompacta: false,
      preto: false,
      vidro: true,
    });
  });

  it("armazenamento que lança na leitura não derruba nada", () => {
    const quebrado = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(lerPreferencias(quebrado)).toEqual(PADRAO);
    expect(() => salvarPreferencias(PADRAO, quebrado)).not.toThrow();
  });
});

describe("temaEfetivo", () => {
  it("automático segue o sistema", () => {
    expect(temaEfetivo("auto", true)).toBe("escuro");
    expect(temaEfetivo("auto", false)).toBe("claro");
  });

  it("escolha manual ignora o sistema", () => {
    expect(temaEfetivo("claro", true)).toBe("claro");
    expect(temaEfetivo("escuro", false)).toBe("escuro");
  });
});

describe("aplicarNoDocumento", () => {
  it("padrão deixa o html só com o tema", () => {
    const raiz = document.createElement("html");
    aplicarNoDocumento(PADRAO, false, raiz);
    expect(raiz.getAttribute("data-tema")).toBe("claro");
    expect(raiz.hasAttribute("data-destaque")).toBe(false);
    expect(raiz.hasAttribute("data-lista")).toBe(false);
  });

  it("aplica e depois remove quando volta ao padrão", () => {
    const raiz = document.createElement("html");
    aplicarNoDocumento(
      { ...PADRAO, tema: "escuro", destaque: "azul", listaCompacta: true },
      false,
      raiz
    );
    expect(raiz.getAttribute("data-tema")).toBe("escuro");
    expect(raiz.getAttribute("data-destaque")).toBe("azul");
    expect(raiz.getAttribute("data-lista")).toBe("compacta");

    aplicarNoDocumento(PADRAO, false, raiz);
    expect(raiz.hasAttribute("data-destaque")).toBe(false);
    expect(raiz.hasAttribute("data-lista")).toBe(false);
  });

  it("preto e vidro: liga e desliga os atributos", () => {
    const raiz = document.createElement("html");
    aplicarNoDocumento({ ...PADRAO, tema: "escuro", preto: true, vidro: true }, false, raiz);
    expect(raiz.hasAttribute("data-preto")).toBe(true);
    expect(raiz.hasAttribute("data-vidro")).toBe(true);
    aplicarNoDocumento(PADRAO, false, raiz);
    expect(raiz.hasAttribute("data-preto")).toBe(false);
    expect(raiz.hasAttribute("data-vidro")).toBe(false);
  });

  // O preto fica gravado mesmo no claro: quem decide se vale é o CSS, junto
  // com o tema efetivo — e o "Automático" à noite já sai preto.
  it("preto com o automático: grava o atributo e o tema segue o sistema", () => {
    const raiz = document.createElement("html");
    aplicarNoDocumento({ ...PADRAO, preto: true }, true, raiz);
    expect(raiz.getAttribute("data-tema")).toBe("escuro");
    expect(raiz.hasAttribute("data-preto")).toBe(true);
  });
});
