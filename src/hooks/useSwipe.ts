import { useEffect, useRef } from "react";
import type { TouchEvent } from "react";

interface UseSwipeOptions {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  threshold?: number;
  // O trackpad manda dezenas de deltas pequenos por gesto, então o limite aqui
  // é maior que o do toque para não trocar de mês com um roçar de dedo.
  wheelThreshold?: number;
}

// Um gesto de trackpad continua emitindo eventos por inércia depois que os
// dedos saem. Sem essa pausa, um único movimento avançaria vários meses.
const PAUSA_FIM_DE_GESTO = 300;

// Trocar de mês com um modal aberto deixava a tela e o modal falando de meses
// diferentes — o formulário editava agosto enquanto o fundo já era setembro.
// Consultamos o DOM em vez de receber um booleano: os modais nascem em
// componentes diferentes (Dashboard, ContasAPagar, Recorrências) e enfiar esse
// estado por todos eles daria a mesma resposta com muito mais fio solto.
function existeModalAberto(): boolean {
  return document.querySelector("[data-modal], [role='dialog']") !== null;
}

// Não sequestrar o gesto quando ele pertence a algo que rola na horizontal
// (uma tabela larga, um gráfico com overflow).
function dentroDeAreaRolavel(alvo: EventTarget | null, limite: Element): boolean {
  let no = alvo instanceof Element ? alvo : null;
  while (no && no !== limite) {
    const estilo = getComputedStyle(no);
    const rolaNaHorizontal =
      /(auto|scroll)/.test(estilo.overflowX) && no.scrollWidth > no.clientWidth;
    if (rolaNaHorizontal) return true;
    no = no.parentElement;
  }
  return false;
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  wheelThreshold = 80,
}: UseSwipeOptions) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  function onTouchStart(e: TouchEvent<HTMLDivElement>) {
    const touch = e.touches[0];
    if (!touch) return;
    if (existeModalAberto()) return;
    startX.current = touch.clientX;
    startY.current = touch.clientY;
  }

  function onTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (startX.current === null || startY.current === null) return;
    const touch = e.changedTouches[0];
    if (!touch) {
      startX.current = null;
      startY.current = null;
      return;
    }
    const deltaX = touch.clientX - startX.current;
    const deltaY = touch.clientY - startY.current;

    startX.current = null;
    startY.current = null;

    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    // De novo no fim: um modal pode ter aberto no meio do gesto.
    if (existeModalAberto()) return;

    if (deltaX < -threshold) onSwipeLeft();
    else if (deltaX > threshold) onSwipeRight();
  }

  // Mesmo gesto no desktop: dois dedos para o lado no trackpad. Guardamos os
  // callbacks em refs para o listener nativo ser registrado uma vez só, em vez
  // de a cada render.
  const alvo = useRef<HTMLDivElement | null>(null);
  const callbacks = useRef({ onSwipeLeft, onSwipeRight, wheelThreshold });
  callbacks.current = { onSwipeLeft, onSwipeRight, wheelThreshold };

  useEffect(() => {
    const elemento = alvo.current;
    if (!elemento) return;

    let acumulado = 0;
    let travado = false;
    let fimDeGesto: number | undefined;

    function aoRolar(e: WheelEvent) {
      if (!elemento) return;
      // Rolagem vertical comum: deixa passar.
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      if (dentroDeAreaRolavel(e.target, elemento)) return;
      if (existeModalAberto()) return;

      // Sem isso, o gesto horizontal também aciona o "voltar" do navegador no
      // macOS e o usuário sai do app sem querer.
      e.preventDefault();

      window.clearTimeout(fimDeGesto);
      fimDeGesto = window.setTimeout(() => {
        acumulado = 0;
        travado = false;
      }, PAUSA_FIM_DE_GESTO);

      if (travado) return;

      acumulado += e.deltaX;
      if (Math.abs(acumulado) < callbacks.current.wheelThreshold) return;

      // deltaX positivo = conteúdo indo para a esquerda = mesmo sentido de
      // arrastar o dedo para a esquerda no celular.
      if (acumulado > 0) callbacks.current.onSwipeLeft();
      else callbacks.current.onSwipeRight();

      acumulado = 0;
      travado = true;
    }

    elemento.addEventListener("wheel", aoRolar, { passive: false });
    return () => {
      window.clearTimeout(fimDeGesto);
      elemento.removeEventListener("wheel", aoRolar);
    };
  }, []);

  return { onTouchStart, onTouchEnd, ref: alvo };
}
