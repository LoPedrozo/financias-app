import { useEffect, useRef, useState } from "react";
import { podeAnimar } from "../lib/movimento";

// Um número que "rola" até o valor novo quando ele muda — ao trocar de mês,
// a renda corre de 8.550 para 7.200 em vez de saltar.
//
// A garantia é a parte importante: a animação sempre termina EXATAMENTE no
// valor recebido, nunca numa aproximação do último quadro. Por três caminhos:
// o último quadro escreve o alvo em vez da conta da curva; se o alvo muda no
// meio, a animação nova parte de onde a tela está e termina no alvo novo; e
// um timer de garantia escreve o alvo mesmo que os quadros parem (aba em
// segundo plano, navegador que economiza bateria).
//
// No primeiro render não anima: o valor aparece pronto.
export function useValorAnimado(alvo: number, duracaoMs = 450): number {
  const [mostrado, setMostrado] = useState(alvo);
  const naTela = useRef(alvo);

  useEffect(() => {
    const de = naTela.current;
    const terminar = () => {
      naTela.current = alvo;
      setMostrado(alvo);
    };

    if (de === alvo || !podeAnimar()) {
      terminar();
      return;
    }

    const inicio = performance.now();
    let quadro = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracaoMs);
      if (p >= 1) {
        terminar();
        return;
      }
      // Desacelera no fim: o olho chega ao número junto com a animação.
      const curva = 1 - (1 - p) ** 3;
      naTela.current = de + (alvo - de) * curva;
      setMostrado(naTela.current);
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    const garantia = window.setTimeout(() => {
      cancelAnimationFrame(quadro);
      terminar();
    }, duracaoMs + 150);

    return () => {
      cancelAnimationFrame(quadro);
      window.clearTimeout(garantia);
    };
  }, [alvo, duracaoMs]);

  // Sem animação o valor certo sai já neste render, sem esperar o efeito:
  // nem um quadro com o número antigo.
  return podeAnimar() ? mostrado : alvo;
}
