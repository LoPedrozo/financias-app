import { useEffect, useState } from "react";

// O aparelho é de toque (celular, tablet)? Decide entre o deslizar na lista,
// com os botões coloridos por trás da linha, e o lápis e a lixeira à vista,
// que é o que funciona com mouse.
//
// Sem matchMedia (o jsdom dos testes, navegador muito antigo) a resposta é
// "não": os botões ficam à vista, que funciona em qualquer lugar.
const CONSULTA = "(hover: none) and (pointer: coarse)";

function consultar(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? !!window.matchMedia(CONSULTA)?.matches
    : false;
}

export function useToque(): boolean {
  const [toque, setToque] = useState(consultar);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(CONSULTA);
    if (!mq || typeof mq.addEventListener !== "function") return;
    const mudou = () => setToque(mq.matches);
    mq.addEventListener("change", mudou);
    return () => mq.removeEventListener("change", mudou);
  }, []);
  return toque;
}
