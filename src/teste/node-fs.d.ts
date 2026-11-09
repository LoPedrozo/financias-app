// O teste de tema precisa ler o global.css como texto, e o vitest entrega
// vazio qualquer import de .css — inclusive com ?raw. Ele também varre os
// componentes atrás de branco fixo em cima do destaque.
//
// Declarar só o que se usa evita trazer o @types/node inteiro para o projeto,
// que redefiniria setTimeout e afins e conflitaria com os tipos de DOM usados
// no app.
declare module "node:fs" {
  export function readFileSync(caminho: string, codificacao: "utf8"): string;
  export function readdirSync(caminho: string): string[];
}
