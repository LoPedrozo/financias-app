// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Folha from "./Folha";

// No computador, as folhas abrem por um botão (a engrenagem, o Exportar) e o
// foco ficava nele, atrás da folha: o Esc ia para o botão e a folha não
// fechava. Fechando, o foco tem de voltar para quem abriu, senão quem usa o
// teclado recomeça do topo da página.

function Teste({ comCampo = false }: { comCampo?: boolean }) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberta(true)}>
        Abrir
      </button>
      {aberta && (
        <Folha titulo="Preferências" onFechar={() => setAberta(false)}>
          {comCampo ? <input aria-label="Valor" autoFocus /> : <p>conteúdo</p>}
        </Folha>
      )}
    </>
  );
}

describe("Folha", () => {
  it("Esc fecha logo depois de abrir pelo botão, e o foco volta para ele", async () => {
    render(<Teste />);
    const abrir = screen.getByRole("button", { name: "Abrir" });
    await userEvent.click(abrir);
    expect(screen.getByRole("dialog")).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(abrir).toHaveFocus();
  });

  it("não tira o foco de um campo que já se focou sozinho", async () => {
    render(<Teste comCampo />);
    const abrir = screen.getByRole("button", { name: "Abrir" });
    await userEvent.click(abrir);
    expect(screen.getByLabelText("Valor")).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(abrir).toHaveFocus();
  });
});
