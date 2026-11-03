// Preparo comum dos testes.
//
// Os matchers de DOM (`toBeInTheDocument`, `toHaveValue`) entram sempre: o
// import também é o que ensina os tipos deles ao TypeScript, e registrar um
// matcher não custa nada em quem não usa.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Já o `cleanup` precisa de DOM, e os testes de `src/lib` rodam em node. Por
// isso o import é dinâmico e condicional — sem isto, a suíte inteira quebrava
// ao carregar o testing-library onde não existe document.
if (typeof document !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  // Sem isto um teste enxerga o que o anterior renderizou, e a busca por
  // texto acha dois botões onde deveria achar um.
  afterEach(() => cleanup());
}
