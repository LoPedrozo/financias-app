import { useEffect, useState } from "react";

// O pedaço da tela que está de fato à vista.
//
// Com o teclado aberto no iPhone, o Safari não encolhe a página: o teclado
// passa por cima da parte de baixo, e o que é `position: fixed` no rodapé —
// o botão de salvar, por exemplo — fica escondido atrás dele. A
// visualViewport diz qual parte da página aparece: um overlay que se prende
// a ela termina logo acima do teclado.
//
// Onde não há visualViewport (navegador antigo, testes), devolve null e quem
// usa fica com a tela inteira, como sempre foi.

export interface AreaVisivel {
  /** Distância do topo da área visível até o topo da janela, em px. */
  top: number;
  height: number;
}

function ler(): AreaVisivel | null {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  return vv ? { top: vv.offsetTop, height: vv.height } : null;
}

export function useAreaVisivel(): AreaVisivel | null {
  const [area, setArea] = useState<AreaVisivel | null>(ler);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const atualizar = () =>
      setArea((antes) => {
        const agora = ler();
        // O iPhone dispara "scroll" a cada pixel de rolagem: sem mudança de
        // verdade, nada de render.
        return agora && antes && agora.top === antes.top && agora.height === antes.height ? antes : agora;
      });
    atualizar();
    vv.addEventListener("resize", atualizar);
    vv.addEventListener("scroll", atualizar);
    return () => {
      vv.removeEventListener("resize", atualizar);
      vv.removeEventListener("scroll", atualizar);
    };
  }, []);

  return area;
}
