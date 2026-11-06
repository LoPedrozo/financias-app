import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA } from "./index";

// No app, verde é entrada e vermelho é saída. As categorias seguem isso:
// cada uma tem o seu tom, mas dentro da paleta do tipo. Antes as saídas
// tinham azul, roxo, dourado e até um verde (Lazer), que se confundia com
// entrada.

function hsl(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

function luminancia(rgb: number[]) {
  const f = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = rgb.map(f);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

// O ícone é a cor cheia sobre um círculo da mesma cor a 22% por cima da
// superfície (IconeCategoria): é esse contraste que decide se dá para ver.
function contrasteDoIcone(cor: string, superficie: string) {
  const c = rgb(cor), f = rgb(superficie);
  const circulo = c.map((v, i) => 0.22 * v + 0.78 * f[i]);
  const [a, b] = [luminancia(c), luminancia(circulo)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const css = readFileSync("src/styles/global.css", "utf8");
const superficie = (bloco: RegExp) => css.match(bloco)![1].match(/--surface:\s*(#[0-9a-f]{6})/i)![1];
const SUPERFICIE_CLARO = superficie(/:root\s*\{([^}]*)\}/);
const SUPERFICIE_ESCURO = superficie(/:root\[data-tema="escuro"\]\s*\{([^}]*)\}/);

const semOutros = <T extends { nome: string }>(l: T[]) => l.filter((c) => c.nome !== "Outros");

describe("cores das categorias", () => {
  it("saídas ficam na faixa do vermelho (de rosado a terracota)", () => {
    for (const c of semOutros(CATEGORIAS_SAIDA)) {
      const { h, s } = hsl(c.cor);
      expect(h >= 335 || h <= 25, `${c.nome} ${c.cor} matiz ${Math.round(h)}`).toBe(true);
      expect(s, `${c.nome} ${c.cor} quase cinza`).toBeGreaterThan(0.2);
    }
  });

  it("entradas ficam na faixa do verde", () => {
    for (const c of semOutros(CATEGORIAS_ENTRADA)) {
      const { h } = hsl(c.cor);
      expect(h >= 85 && h <= 170, `${c.nome} ${c.cor} matiz ${Math.round(h)}`).toBe(true);
    }
  });

  it("Outros é o mesmo cinza nas duas listas", () => {
    const cinza = CATEGORIAS_SAIDA.find((c) => c.nome === "Outros")!.cor;
    expect(CATEGORIAS_ENTRADA.find((c) => c.nome === "Outros")!.cor).toBe(cinza);
    expect(hsl(cinza).s).toBeLessThan(0.15);
  });

  it("cada categoria tem o seu tom: nenhuma cor repetida", () => {
    for (const lista of [CATEGORIAS_SAIDA, CATEGORIAS_ENTRADA]) {
      expect(new Set(lista.map((c) => c.cor.toLowerCase())).size).toBe(lista.length);
    }
  });

  it("o ícone de saída dá para ver nos dois temas", () => {
    for (const c of semOutros(CATEGORIAS_SAIDA)) {
      expect(contrasteDoIcone(c.cor, SUPERFICIE_CLARO), `${c.nome} no claro`).toBeGreaterThanOrEqual(2.1);
      expect(contrasteDoIcone(c.cor, SUPERFICIE_ESCURO), `${c.nome} no escuro`).toBeGreaterThanOrEqual(2.65);
    }
  });
});
