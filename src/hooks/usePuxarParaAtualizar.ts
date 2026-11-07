import { useEffect, useRef, useState } from "react";

// Puxar a tela para baixo, no topo, atualiza — o gesto do Mail e do
// Instagram.
//
// No iPhone, o app instalado na tela de início não tem esse gesto: o Safari
// só o oferece dentro do navegador. Aqui ele é feito à mão, com cuidado para
// não roubar o que já funciona:
// - só começa com a página no topo e sem modal aberto (em qualquer outro
//   lugar, puxar para baixo é rolar);
// - só conta se o dedo for para baixo antes de ir para o lado — deslizar uma
//   linha da lista para os lados continua sendo da lista;
// - enquanto puxa, segura o "elástico" do Safari (preventDefault), senão a
//   página inteira desce junto com o indicador.
//
// O indicador anda menos que o dedo (efeito elástico), e soltar antes do
// limiar só devolve tudo ao lugar. "voltando" é a subida de volta, para quem
// desenha poder animar em vez de pular.

export type EstadoPuxar = "parado" | "puxando" | "pronto" | "atualizando" | "voltando";

/** Distância do indicador (já com o elástico) a partir da qual soltar atualiza. */
export const LIMIAR_PUXAR = 64;
const MAXIMO = 110;
const ELASTICO = 0.5;
/** Onde o indicador fica parado enquanto atualiza. */
export const PARADO_ATUALIZANDO = 56;
/** Uma atualização rápida demais pisca o indicador; fica à vista pelo menos isto. */
export const DURACAO_MINIMA_MS = 600;
/** A subida de volta (a mesma duração da transição no CSS). */
export const DURACAO_VOLTA_MS = 250;

type Direcao = "indefinida" | "puxando" | "ignorar";

export function usePuxarParaAtualizar(onAtualizar: () => Promise<unknown>, ativo: boolean) {
  const [distancia, setDistancia] = useState(0);
  const [estado, setEstado] = useState<EstadoPuxar>("parado");
  const gesto = useRef({ x: 0, y: 0, direcao: "ignorar" as Direcao, distancia: 0, atualizando: false });
  const atualizar = useRef(onAtualizar);
  atualizar.current = onAtualizar;

  useEffect(() => {
    if (!ativo) return;
    const g = gesto.current;
    let relogio: ReturnType<typeof setTimeout> | undefined;

    function voltar() {
      g.distancia = 0;
      setDistancia(0);
      setEstado("voltando");
      clearTimeout(relogio);
      relogio = setTimeout(() => setEstado((e) => (e === "voltando" ? "parado" : e)), DURACAO_VOLTA_MS);
    }

    function aoTocar(e: TouchEvent) {
      const naoComeca =
        g.atualizando ||
        e.touches.length !== 1 ||
        window.scrollY > 0 ||
        document.querySelector("[data-modal]") !== null;
      if (naoComeca) {
        g.direcao = "ignorar";
        return;
      }
      g.x = e.touches[0].clientX;
      g.y = e.touches[0].clientY;
      g.direcao = "indefinida";
      g.distancia = 0;
    }

    function aoMover(e: TouchEvent) {
      if (g.direcao === "ignorar") return;
      const dx = e.touches[0].clientX - g.x;
      const dy = e.touches[0].clientY - g.y;
      if (g.direcao === "indefinida") {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        // Para cima é rolar; para o lado é da lista. Só para baixo é nosso.
        g.direcao = dy > 0 && Math.abs(dy) > Math.abs(dx) ? "puxando" : "ignorar";
        if (g.direcao === "ignorar") return;
      }
      if (dy <= 0) {
        voltar();
        return;
      }
      e.preventDefault();
      const d = Math.min(MAXIMO, dy * ELASTICO);
      g.distancia = d;
      setDistancia(d);
      setEstado(d >= LIMIAR_PUXAR ? "pronto" : "puxando");
    }

    async function aoSoltar() {
      const puxou = g.direcao === "puxando";
      g.direcao = "ignorar";
      if (!puxou) return;
      if (g.distancia < LIMIAR_PUXAR) {
        voltar();
        return;
      }
      g.atualizando = true;
      setEstado("atualizando");
      setDistancia(PARADO_ATUALIZANDO);
      const inicio = Date.now();
      try {
        await atualizar.current();
      } catch {
        // Quem atualiza já avisa da falha (a faixa "Não consegui atualizar").
      }
      const falta = DURACAO_MINIMA_MS - (Date.now() - inicio);
      if (falta > 0) await new Promise((r) => setTimeout(r, falta));
      g.atualizando = false;
      voltar();
    }

    // Dedo interrompido (uma ligação, o sistema) não atualiza: só volta.
    function aoCancelar() {
      if (g.direcao === "puxando") voltar();
      g.direcao = "ignorar";
    }

    document.addEventListener("touchstart", aoTocar, { passive: true });
    document.addEventListener("touchmove", aoMover, { passive: false });
    document.addEventListener("touchend", aoSoltar);
    document.addEventListener("touchcancel", aoCancelar);
    return () => {
      clearTimeout(relogio);
      document.removeEventListener("touchstart", aoTocar);
      document.removeEventListener("touchmove", aoMover);
      document.removeEventListener("touchend", aoSoltar);
      document.removeEventListener("touchcancel", aoCancelar);
    };
  }, [ativo]);

  return { distancia, estado };
}
