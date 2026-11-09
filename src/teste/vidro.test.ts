import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DESTAQUES } from "../lib/preferencias";

// Vidro e Preto total são redefinições de tokens, como o tema escuro. O risco
// do vidro é silencioso: texto em cima de uma superfície translúcida, que
// fica em cima de uma mancha de cor. Com a cor de destaque errada (escura no
// claro, por exemplo), o texto cinza vira cinza sobre cinza — e ninguém nota
// até abrir o app num dia em que não dá para ler.
//
// O teste lê os valores do próprio global.css e compõe o pior ponto: o centro
// da mancha mais forte (com 20% de folga, pelas bordas das manchas que se
// sobrepõem), com o vidro por cima. O desfoque só mistura vizinhos — nunca
// deixa o fundo mais forte que o centro da mancha —, então esse é o caso mais
// desfavorável.

const css = readFileSync("src/styles/global.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function bloco(seletor: string): Record<string, string> {
  const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const achado = css.match(new RegExp(`^${escapado}\\s*\\{([\\s\\S]*?)\\}`, "m"));
  expect(achado, `bloco não encontrado: ${seletor}`).toBeTruthy();
  return Object.fromEntries([...achado![1].matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const claro = bloco(":root");
const escuro = { ...claro, ...bloco(':root[data-tema="escuro"]') };
const soPreto = bloco(':root[data-tema="escuro"][data-preto]');
const preto = { ...escuro, ...soPreto };
const vidroNoClaro = bloco(':root[data-vidro]:not([data-tema="escuro"])');

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb;
function rgba(valor: string): { cor: Rgb; alfa: number } {
  const m = valor.match(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/);
  expect(m, `não é rgba: ${valor}`).toBeTruthy();
  return { cor: [Number(m![1]) / 255, Number(m![2]) / 255, Number(m![3]) / 255], alfa: Number(m![4]) };
}
const misturar = (a: Rgb, b: Rgb, t: number): Rgb => a.map((x, i) => t * x + (1 - t) * b[i]) as Rgb;
function luminancia([r, g, b]: Rgb) {
  const f = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contraste(a: Rgb, b: Rgb) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const temas = [
  { nome: "claro", t: { ...claro, ...vidroNoClaro }, variante: "claro" as const },
  { nome: "escuro", t: escuro, variante: "escuro" as const },
  { nome: "preto", t: preto, variante: "escuro" as const },
];

describe("vidro: o texto continua legível no pior ponto do fundo", () => {
  for (const { nome, t, variante } of temas) {
    it(`${nome}, com todas as cores de destaque e os tons do período`, () => {
      const fundo = hex(t["--bg"]);
      const vidro = rgba(t["--vidro"]);
      const forca = Math.min(1, (parseFloat(t["--vidro-mancha"]) / 100) * 1.2);
      // A primeira mancha segue o tom do período; as outras, o destaque.
      const manchas = [
        ...DESTAQUES.map((d) => [d.nome, d[variante]] as const),
        ["tom da manhã", t["--tom-manha"]] as const,
        ["tom da noite", t["--tom-noite"]] as const,
      ];
      const solido = hex(t["--surface"]);
      for (const [mancha, cor] of manchas) {
        const sob = misturar(hex(cor), fundo, forca);
        const superficie = misturar(vidro.cor, sob, vidro.alfa);
        const onde = `${nome}, mancha ${mancha}`;
        expect(contraste(hex(t["--text"]), superficie), `texto · ${onde}`).toBeGreaterThanOrEqual(7);
        expect(contraste(hex(t["--text-soft"]), superficie), `texto secundário · ${onde}`).toBeGreaterThanOrEqual(4.5);
        // Os menores (rótulos, valores em verde/vermelho) não podem perder
        // mais de 10% do contraste que têm no card sólido — ou ficar abaixo
        // de 3:1, o que for menor.
        for (const token of ["--text-faint", "--green", "--red"]) {
          const minimo = Math.min(3, 0.9 * contraste(hex(t[token]), solido));
          expect(contraste(hex(t[token]), superficie), `${token} · ${onde}`).toBeGreaterThanOrEqual(minimo - 0.001);
        }
      }
    });
  }
});

// O destaque como texto (links, a aba ativa da barra de baixo) também fica
// em cima do vidro, e o vidro em cima de uma mancha — às vezes da própria
// cor de destaque. No topo, "Minhas Finanças", o ano do carrossel e o olho
// ficam direto sobre a mancha mais forte, sem vidro: lá, que são negrito e
// ícone, o mínimo é 3:1. A mancha é o efeito; o que não pode é sumir.
describe("vidro: o destaque como texto continua legível", () => {
  for (const { nome, t, variante } of temas) {
    it(`${nome}, em cada cor de destaque`, () => {
      const fundo = hex(t["--bg"]);
      const vidro = rgba(t["--vidro"]);
      const forca = Math.min(1, (parseFloat(t["--vidro-mancha"]) / 100) * 1.2);
      for (const d of DESTAQUES) {
        const daCor =
          d.id === "dourado"
            ? t
            : { ...t, ...bloco(variante === "claro" ? `:root[data-destaque="${d.id}"]` : `:root[data-tema="escuro"][data-destaque="${d.id}"]`) };
        const texto = hex(daCor["--destaque-texto"]);
        const manchas = [
          ["tom da manhã", t["--tom-manha"]],
          ["tom da noite", t["--tom-noite"]],
          ["a própria cor", daCor["--accent"]],
        ] as const;
        for (const [mancha, cor] of manchas) {
          const sob = misturar(hex(cor), fundo, forca);
          const superficie = misturar(vidro.cor, sob, vidro.alfa);
          const onde = `${d.nome} no ${nome}, mancha ${mancha}`;
          expect(contraste(texto, superficie), `no card · ${onde}`).toBeGreaterThanOrEqual(4.5);
          expect(contraste(texto, sob), `no topo · ${onde}`).toBeGreaterThanOrEqual(3);
        }
      }
    });
  }
});

describe("preto total", () => {
  it("o fundo é preto de verdade", () => {
    expect(preto["--bg"].toLowerCase()).toBe("#000000");
  });

  it("só mexe no fundo e nas superfícies: texto, verde, vermelho e destaque ficam os do escuro", () => {
    const podeMudar = ["--bg", "--surface", "--border", "--shadow", "--barra-rolagem", "--brilho-topo", "--tom-forca", "--vidro", "--vidro-mancha"];
    expect(Object.keys(soPreto).filter((k) => !podeMudar.includes(k))).toEqual([]);
    for (const k of Object.keys(soPreto)) expect(escuro[k], `${k} não existe no escuro`).toBeDefined();
  });

  it("o texto fica pelo menos tão legível quanto no escuro", () => {
    for (const k of ["--text", "--text-soft", "--text-faint", "--green", "--red"]) {
      expect(contraste(hex(preto[k]), hex(preto["--surface"]))).toBeGreaterThanOrEqual(
        contraste(hex(escuro[k]), hex(escuro["--surface"]))
      );
    }
  });
});
