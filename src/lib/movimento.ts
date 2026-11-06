// Animações e vibração são enfeite: nada pode depender delas.
//
// Quem pediu menos movimento no sistema (Acessibilidade → Reduzir movimento)
// não vê animação nenhuma. E onde o navegador não sabe responder — o jsdom
// dos testes, navegador antigo — a resposta é "não anima": o número aparece
// direto no valor certo.
export function podeAnimar(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  if (typeof window.requestAnimationFrame !== "function") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Um toque curto, como o de um botão físico. Só o Android obedece: o Safari
// do iPhone não expõe vibração para sites, e lá isto não faz nada.
export function vibrar(ms = 8): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(ms);
    }
  } catch {
    // Alguns navegadores lançam erro em vez de ignorar quando a página não
    // tem permissão. Vibrar nunca vale quebrar um toque.
  }
}
