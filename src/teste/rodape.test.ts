import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// No celular a barra de baixo (64px) fica fixa por cima da página. Se o fim
// da página não tiver pelo menos essa altura de folga, o último card some
// atrás dela e não há rolagem que o mostre — foi o que aconteceu com
// Recorrências: uma regra `.page-root` posterior, de mesma força, trocava os
// 80px da folga por 48px.
//
// O jsdom não aplica media query nem cascata, então o teste lê o CSS: a folga
// precisa estar num seletor mais forte que o `.page-root` sozinho, e ser
// maior que a barra.
const css = readFileSync("src/styles/global.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const ALTURA_DA_BARRA = 64;

describe("folga para a barra de baixo no celular", () => {
  const regra = css.match(/\.page-root\.page-com-bottom-nav\s*\{([^}]*)\}/);

  it("existe com força maior que o .page-root sozinho", () => {
    expect(regra, "regra .page-root.page-com-bottom-nav").toBeTruthy();
    expect(regra![1]).toMatch(/padding-bottom\s*:[^;]*!important/);
  });

  it("é maior que a barra", () => {
    const px = Number(regra![1].match(/padding-bottom\s*:\s*calc\((\d+)px/)?.[1] ?? regra![1].match(/padding-bottom\s*:\s*(\d+)px/)?.[1]);
    expect(px).toBeGreaterThan(ALTURA_DA_BARRA);
  });

  it("nenhuma regra mais forte zera a folga depois", () => {
    // Qualquer outro seletor com as duas classes que mexa no padding de baixo
    // tem que ser esta mesma regra.
    const outras = [...css.matchAll(/([^{}]*\.page-com-bottom-nav[^{}]*)\{([^}]*)\}/g)].filter(
      ([, sel, corpo]) => !/^\s*\.page-root\.page-com-bottom-nav\s*$/.test(sel) && /padding/.test(corpo)
    );
    expect(outras.map(([sel]) => sel.trim())).toEqual([]);
  });
});
