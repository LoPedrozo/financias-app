import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
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

function mapa(bloco: string): Record<string, string> {
  return Object.fromEntries(
    [...bloco.matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().toLowerCase()])
  );
}

// Os tokens de uma combinação, resolvidos como o navegador resolve: a base do
// tema (e do preto), e por cima o bloco da cor. O dourado mora na base.
function tokensDaCor(id: string, variante: "claro" | "escuro", preto = false): Record<string, string> {
  const base =
    variante === "claro"
      ? mapa(claro)
      : { ...mapa(claro), ...mapa(escuro), ...(preto ? mapa(corpo(':root[data-tema="escuro"][data-preto]')) : {}) };
  if (id === "dourado") return base;
  const seletor =
    variante === "claro" ? `:root[data-destaque="${id}"]` : `:root[data-tema="escuro"][data-destaque="${id}"]`;
  return { ...base, ...mapa(corpo(seletor)) };
}

// Contraste WCAG. As cores chegam em hex ou rgba; o alfa é composto sobre o
// que estiver embaixo com `sobre`.
type Rgb = [number, number, number];
const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb;
const misturar = (a: Rgb, b: Rgb, t: number): Rgb => a.map((x, i) => t * x + (1 - t) * b[i]) as Rgb;
function sobre(rgba: string, fundo: Rgb): Rgb {
  const m = rgba.match(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/)!;
  return misturar([Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255], fundo, Number(m[4]));
}
function luminancia([r, g, b]: Rgb): number {
  const f = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contraste(a: Rgb, b: Rgb): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const combinacoes = DESTAQUES.flatMap((d) => [
  { d, variante: "claro" as const, preto: false, onde: `${d.nome} no claro` },
  { d, variante: "escuro" as const, preto: false, onde: `${d.nome} no escuro` },
  { d, variante: "escuro" as const, preto: true, onde: `${d.nome} no preto total` },
]);

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
      // Faltando um, aquele pedaço ficaria com o do dourado: a tinta escura
      // sobre uma cor funda, ou o texto dourado no meio do azul.
      const esperados = ["--accent", "--accent-soft", "--destaque-texto", "--saldo-degrade", "--sobre-destaque"];
      expect(tokensDe(noClaro)).toEqual(esperados);
      expect(tokensDe(noEscuro)).toEqual(esperados);
    });
  }

  // A tinta é a cor do texto e dos ícones em cima do destaque: o "Salvar",
  // o +, o "Editar" da lista, a faixa de versão nova. Era branco fixo, e o
  // branco sobre o dourado do escuro dava 1,9:1.
  it("a tinta sobre o destaque passa de 4,5:1, em toda cor e tema", () => {
    for (const { d, variante, preto, onde } of combinacoes) {
      const t = tokensDaCor(d.id, variante, preto);
      expect(contraste(hex(t["--sobre-destaque"]), hex(t["--accent"])), onde).toBeGreaterThanOrEqual(4.5);
    }
  });

  // O card do saldo é o destaque com um degradê por cima, um brilho branco
  // no canto de cima (12%, no CardSaldo) e, quando falta dinheiro, o valor
  // numa pílula escura (preto a 60%) com texto rosado. A tinta tem de passar
  // nas duas pontas do degradê e no meio dele, onde fica o brilho.
  it("card do saldo: a tinta e o valor negativo passam de 4,5:1 em todo o degradê", () => {
    for (const { d, variante, preto, onde } of combinacoes) {
      const t = tokensDaCor(d.id, variante, preto);
      const cor = hex(t["--accent"]);
      const paradas = t["--saldo-degrade"].match(/rgba\([^)]*\)/g)!;
      expect(paradas, `degradê de ${onde}`).toHaveLength(2);
      const [inicio, fim] = paradas.map((p) => sobre(p, cor));
      const meio = sobre("rgba(255, 255, 255, 0.12)", misturar(inicio, fim, 0.5));
      for (const [ponto, fundo] of [["começo", inicio], ["meio, sob o brilho", meio], ["fim", fim]] as const) {
        expect(contraste(hex(t["--sobre-destaque"]), fundo), `tinta · ${onde}, ${ponto}`).toBeGreaterThanOrEqual(4.5);
        const pilula = sobre("rgba(0, 0, 0, 0.6)", fundo);
        expect(contraste(hex("#ffd4d4"), pilula), `negativo · ${onde}, ${ponto}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  // O destaque como texto: links, a aba ativa, "Minhas Finanças" no topo, o
  // ano do carrossel. Fica sobre o card, o fundo e o véu do período no topo
  // (âmbar de manhã, o próprio destaque à tarde, anil à noite) — o vidro
  // tem teste próprio (vidro.test.ts). Sobre o fundo suave do destaque só
  // aparecem ícones, que pedem 3:1.
  it("o destaque como texto passa de 4,5:1 sobre o card, o fundo e o véu do topo", () => {
    for (const { d, variante, preto, onde } of combinacoes) {
      const t = tokensDaCor(d.id, variante, preto);
      const texto = hex(t["--destaque-texto"]);
      const fundo = hex(t["--bg"]);
      const forca = parseFloat(t["--tom-forca"]) / 100;
      const fundos: Array<[string, Rgb]> = [
        ["card", hex(t["--surface"])],
        ["fundo", fundo],
        ["véu da manhã", misturar(hex(t["--tom-manha"]), fundo, forca)],
        ["véu da tarde", misturar(hex(t["--accent"]), fundo, forca)],
        ["véu da noite", misturar(hex(t["--tom-noite"]), fundo, forca)],
      ];
      for (const [nome, f] of fundos) {
        expect(contraste(texto, f), `${onde}, sobre ${nome}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contraste(texto, hex(t["--accent-soft"])), `${onde}, ícone no fundo suave`).toBeGreaterThanOrEqual(3);
    }
  });

  // A tinta fica nos tokens, e os componentes a usam: um "#fff" esquecido
  // em cima do destaque volta a ser o branco sobre o dourado.
  it("nenhum componente pinta branco fixo em cima do destaque", () => {
    const pasta = "src/components";
    const arquivos = readdirSync(pasta).filter((a) => a.endsWith(".tsx") && !a.includes(".test."));
    const achados: string[] = [];
    for (const a of arquivos) {
      const fonte = readFileSync(`${pasta}/${a}`, "utf8");
      // Cada objeto de estilo (o que fica entre chaves sem chaves dentro).
      for (const m of fonte.matchAll(/\{[^{}]*\}/g)) {
        if (/var\(--accent\)/.test(m[0]) && /background/.test(m[0]) && /color:\s*"#fff/i.test(m[0])) {
          achados.push(`${a}: ${m[0].replace(/\s+/g, " ").slice(0, 80)}`);
        }
      }
    }
    expect(achados).toEqual([]);
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
