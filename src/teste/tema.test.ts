import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// O tema escuro é só uma redefinição dos tokens. A armadilha é adicionar uma
// cor nova no claro e esquecer do escuro: nada quebra, nada avisa, e aparece
// um retângulo branco no meio da tela escura meses depois.
//
// Os comentários saem antes de qualquer análise — explicar uma cor citando o
// hex dela não pode contar como cor fixa.
const css = readFileSync("src/styles/global.css", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  ""
);

function tokensDe(bloco: string): string[] {
  return [...bloco.matchAll(/(--[a-z-]+)\s*:/g)].map((m) => m[1]).sort();
}

function bloco(regex: RegExp): string {
  const achado = css.match(regex);
  expect(achado, `bloco não encontrado: ${regex}`).toBeTruthy();
  return achado![1];
}

// O :root de fora do media query, e o de dentro dele.
const claro = bloco(/^:root\s*\{([\s\S]*?)\n\}/m);
const escuro = bloco(
  /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([\s\S]*?)\n  \}/
);

describe("tema escuro", () => {
  it("redefine todas as cores do tema claro", () => {
    // --radius é medida, não cor: não muda com o tema.
    const cores = tokensDe(claro).filter((t) => t !== "--radius");
    expect(tokensDe(escuro)).toEqual(cores);
  });

  it("não deixa cor fixa escapar fora dos tokens", () => {
    // Branco é a exceção combinada: é texto por cima de botão colorido
    // (dourado, verde, vermelho), e esses fundos são os mesmos nos dois temas.
    const fora = css.replace(claro, "").replace(escuro, "");
    const soltas = (fora.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).filter(
      (cor: string) => !/^#(fff|ffffff)$/i.test(cor)
    );
    expect(soltas).toEqual([]);
  });

  it("declara color-scheme nos dois, para o calendário e o select nativos", () => {
    expect(claro).toContain("color-scheme: light");
    expect(escuro).toContain("color-scheme: dark");
  });
});
