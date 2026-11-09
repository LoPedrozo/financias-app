// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

// Fechar desce a folha: como quem fecha é o pai (que a tira da tela na hora),
// fica uma cópia só de imagem fazendo a animação.
describe("Folha fechando", () => {
  function animarDeVerdade() {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never;
  }
  afterEach(() => {
    // @ts-expect-error — o jsdom não tem matchMedia; tira o mock.
    delete window.matchMedia;
    document.querySelectorAll(".folha-saindo").forEach((el) => el.remove());
  });

  it("deixa uma cópia que anima e some, sem contar como modal aberto", async () => {
    animarDeVerdade();
    render(<Teste />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await act(async () => {});
    const copia = document.querySelector(".folha-saindo");
    expect(copia).not.toBeNull();
    expect(copia).toHaveAttribute("aria-hidden", "true");
    expect(copia!.querySelector("[role], [id]")).toBeNull();
    // Quem pergunta "tem modal aberto?" (o deslizar de mês, o puxar) não acha.
    expect(document.querySelector("[data-modal]")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.querySelector(".folha-saindo")).toBeNull());
  });

  it("aberta no modo estrito do React, não deixa cópia nenhuma", async () => {
    animarDeVerdade();
    render(
      <StrictMode>
        <Teste />
      </StrictMode>
    );
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await act(async () => {});
    expect(document.querySelector(".folha-saindo")).toBeNull();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("com menos movimento pedido, fecha sem cópia", async () => {
    render(<Teste />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await act(async () => {});
    expect(document.querySelector(".folha-saindo")).toBeNull();
  });
});
