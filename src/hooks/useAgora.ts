import { useEffect, useState } from "react";

// O "agora" da saudação e do tom do topo.
//
// O PWA fica aberto por horas e volta do segundo plano sem recarregar: sem
// isto, quem abriu o app de manhã continuaria lendo "Bom dia" à noite. Um
// minuto de atraso na virada não incomoda; o que não pode é ficar parado.
// Ao voltar para a tela, atualiza na hora — timers dormem em segundo plano.
export function useAgora(intervaloMs = 60_000): Date {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const atualizar = () => setAgora(new Date());
    const relogio = window.setInterval(atualizar, intervaloMs);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") atualizar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [intervaloMs]);

  return agora;
}
