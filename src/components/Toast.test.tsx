// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import Toast from "./Toast";

// O jsdom não calcula layout: a posição é conferida no CSS, e no navegador de
// verdade (o aviso acima da barra de baixo, sem cobrir o +).
describe("Toast", () => {
  it("no celular fica acima da barra de baixo, não em cima do +", () => {
    render(<Toast toast={{ id: 1, tipo: "sucesso", mensagem: "Lançamento salvo!" }} onFechar={() => {}} />);
    expect(screen.getByRole("status")).toHaveClass("toast");
    const css = readFileSync("src/styles/global.css", "utf8");
    const celular = css.slice(css.indexOf("@media (max-width: 640px)"));
    const regra = celular.match(/\.toast\s*\{([^}]*)\}/);
    expect(regra?.[1]).toMatch(/bottom:\s*calc\((\d+)px/);
    expect(Number(regra![1].match(/calc\((\d+)px/)![1])).toBeGreaterThan(64);
  });

  it("a borda fina tem uma cor válida (o alfa colado no var era jogado fora)", () => {
    render(<Toast toast={{ id: 1, tipo: "erro", mensagem: "Sem rede" }} onFechar={() => {}} />);
    // O jsdom não lê color-mix; a cor em si é conferida no Chromium.
    const el = screen.getByRole("status");
    expect(el.getAttribute("style")).not.toMatch(/\)44/);
    expect(el.style.borderStyle).toBe("solid");
    expect(el.style.borderLeftWidth).toBe("4px");
  });
});
