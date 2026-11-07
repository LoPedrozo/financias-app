import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DESTAQUES } from "../lib/preferencias";

// O tema escuro e as cores de destaque são só redefinições de tokens. As
// armadilhas são silenciosas: adicionar uma cor no claro e esquecer do escuro,
// ou mudar uma cor no CSS e esquecer da amostra no seletor. Nada quebra, nada
// avisa — aparece um retângulo errado meses depois.
//
// Os comentários saem antes de qualquer análise — explicar uma cor citando o
// hex dela não pode contar como cor fixa.
const css = readFileSync("src/styles/global.css", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  ""
);

function corpo(seletor: string): string {
  const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const achado = css.match(new RegExp(`^${escapado}\\s*\\{([\\s\\S]*?)\\}`, "m"));
  expect(achado, `bloco não encontrado: ${seletor}`).toBeTruthy();
  return achado![1];
}

function tokensDe(bloco: string): string[] {
  return [...bloco.matchAll(/(--[a-z-]+)\s*:/g)].map((m) => m[1]).sort();
}

function token(bloco: string, nome: string): string {
  const achado = bloco.match(new RegExp(`${nome}\\s*:\\s*([^;]+);`));
  expect(achado, `${nome} não definido`).toBeTruthy();
  return achado![1].trim().toLowerCase();
}

const claro = corpo(":root");
const escuro = corpo(':root[data-tema="escuro"]');

// Contraste WCAG entre o branco e uma cor. É o texto dos botões de destaque.
function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrasteComBranco = (hex: string) => 1.05 / (luminancia(hex) + 0.05);

describe("tema escuro", () => {
  it("redefine todas as cores do tema claro", () => {
    // --radius é medida, não cor: não muda com o tema.
    const cores = tokensDe(claro).filter((t) => t !== "--radius");
    expect(tokensDe(escuro)).toEqual(cores);
  });

  it("não depende mais do media query — quem decide é o atributo", () => {
    expect(css).not.toMatch(/prefers-color-scheme/);
  });

  it("declara color-scheme nos dois, para o calendário e o select nativos", () => {
    expect(claro).toContain("color-scheme: light");
    expect(escuro).toContain("color-scheme: dark");
  });

  it("não deixa cor fixa escapar fora dos tokens", () => {
    // Tira todo bloco :root (tema e destaques); o que sobra é a folha comum.
    // Branco é a exceção combinada: texto sobre botão colorido.
    const fora = css.replace(/^:root[^{]*\{[\s\S]*?\}/gm, "");
    const soltas = (fora.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).filter(
      (cor: string) => !/^#(fff|ffffff)$/i.test(cor)
    );
    expect(soltas).toEqual([]);
  });
});

describe("cores de destaque", () => {
  it("o dourado padrão do CSS é o mesmo da amostra no seletor", () => {
    const dourado = DESTAQUES.find((d) => d.id === "dourado")!;
    expect(token(claro, "--accent")).toBe(dourado.claro);
    expect(token(escuro, "--accent")).toBe(dourado.escuro);
  });

  for (const d of DESTAQUES.filter((x) => x.id !== "dourado")) {
    it(`${d.nome}: CSS e amostra combinam, nos dois temas`, () => {
      const noClaro = corpo(`:root[data-destaque="${d.id}"]`);
      const noEscuro = corpo(`:root[data-tema="escuro"][data-destaque="${d.id}"]`);
      expect(token(noClaro, "--accent")).toBe(d.claro);
      expect(token(noEscuro, "--accent")).toBe(d.escuro);
      // Sem o soft, o card do saldo e os ícones ficariam com o dourado.
      expect(tokensDe(noClaro)).toEqual(["--accent", "--accent-soft"]);
      expect(tokensDe(noEscuro)).toEqual(["--accent", "--accent-soft"]);
    });
  }

  // O texto dos botões de destaque é branco fixo. Trocar a cor não pode
  // deixar o botão de lançar mais ilegível do que o dourado já é.
  it("nenhuma cor tem contraste com o branco pior que o dourado", () => {
    const dourado = DESTAQUES.find((d) => d.id === "dourado")!;
    for (const variante of ["claro", "escuro"] as const) {
      const minimo = contrasteComBranco(dourado[variante]);
      for (const d of DESTAQUES) {
        expect(
          contrasteComBranco(d[variante]),
          `${d.nome} no ${variante}`
        ).toBeGreaterThanOrEqual(minimo - 0.001);
      }
    }
  });

  // Verde é entrada e vermelho é saída: um botão de lançar verde passaria a
  // dizer "entrada" sem querer. As faixas são as mesmas das categorias
  // (types/coresCategorias.test.ts) — o laranja fica logo depois da última
  // terracota das saídas.
  it("nenhuma cor de destaque cai no verde das entradas nem no vermelho das saídas", () => {
    const matiz = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
      if (d === 0) return null;
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    for (const d of DESTAQUES) {
      for (const variante of ["claro", "escuro"] as const) {
        const h = matiz(d[variante]);
        if (h === null) continue;
        const onde = `${d.nome} no ${variante} (matiz ${Math.round(h)})`;
        expect(h >= 85 && h <= 170, `${onde} é verde`).toBe(false);
        expect(h >= 335 || h <= 25, `${onde} é vermelho`).toBe(false);
      }
    }
  });
});
