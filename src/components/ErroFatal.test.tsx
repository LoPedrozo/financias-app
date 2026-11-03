// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErroFatal from "./ErroFatal";

function Explode(): JSX.Element {
  throw new Error("coluna sumiu");
}

describe("ErroFatal", () => {
  it("deixa passar o que não quebra", () => {
    render(
      <ErroFatal>
        <p>tudo certo</p>
      </ErroFatal>
    );
    expect(screen.getByText("tudo certo")).toBeInTheDocument();
  });

  // Sem isto o React desmonta a árvore inteira e sobra tela branca — no app
  // instalado, parece que o aplicativo morreu.
  it("segura a exceção de render e oferece recarregar", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErroFatal>
        <Explode />
      </ErroFatal>
    );

    expect(screen.getByText("Algo quebrou nesta tela.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Recarregar o app/ })
    ).toBeInTheDocument();
    // Tranquiliza sobre o que mais importa: o dado não se perdeu.
    expect(screen.getByText(/lançamentos estão salvos/)).toBeInTheDocument();
    expect(screen.getByText("coluna sumiu")).toBeInTheDocument();
  });
});
