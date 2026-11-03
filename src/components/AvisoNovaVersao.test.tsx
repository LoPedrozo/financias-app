// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// O módulo virtual é criado pelo plugin do PWA em tempo de build. Aqui ele
// vira um controle manual: o que importa é o que a tela faz quando o service
// worker avisa que tem versão nova esperando.
const atualizar = vi.fn();
const setPrecisaAtualizar = vi.fn();
let precisaAtualizar = false;

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [precisaAtualizar, setPrecisaAtualizar],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: atualizar,
  }),
}));

const { default: AvisoNovaVersao } = await import("./AvisoNovaVersao");

describe("AvisoNovaVersao", () => {
  it("não aparece quando não há versão nova", () => {
    precisaAtualizar = false;
    const { container } = render(<AvisoNovaVersao />);
    expect(container).toBeEmptyDOMElement();
  });

  it("avisa e troca de versão no toque", async () => {
    precisaAtualizar = true;
    render(<AvisoNovaVersao />);

    expect(screen.getByText("Tem uma versão nova do app.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    // `true` é o que recarrega a página para o worker novo assumir.
    expect(atualizar).toHaveBeenCalledWith(true);
  });

  it("dá para dispensar e seguir usando", async () => {
    precisaAtualizar = true;
    render(<AvisoNovaVersao />);
    await userEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(setPrecisaAtualizar).toHaveBeenCalledWith(false);
  });
});
