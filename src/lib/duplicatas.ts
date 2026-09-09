import { normalizar } from "./categorias";
import type { Lancamento, Tipo } from "../types";

// Reconhecer o que já está lançado, para o app avisar antes de duplicar.
//
// Nada aqui bloqueia: dois almoços de R$ 25 no mesmo dia são perfeitamente
// possíveis. O que não pode é o app deixar isso passar em silêncio depois de
// uma lista recolada por engano, ou de um "salvar" retentado porque a conexão
// caiu no meio — nesse segundo caso o insert já tinha entrado, e só a resposta
// se perdeu.
//
// São duas granularidades porque as duas telas perguntam coisas diferentes.

interface ParecidoComLancamento {
  tipo: Tipo;
  descricao: string;
  valor: number;
  data: string | null;
}

/** Linha idêntica: mesmo tipo, mesma descrição, mesmo valor, mesma data. */
export function chaveExata(l: ParecidoComLancamento): string {
  return `${l.tipo}|${normalizar(l.descricao)}|${l.valor.toFixed(2)}|${l.data ?? ""}`;
}

// A mesma conta do mês, independente do valor: a luz de setembro é a luz de
// agosto ainda que venha dez reais mais cara. É o que o Repetir precisa saber
// para não trazer de novo o que o mês de destino já tem.
export function chaveDaConta(l: { tipo: Tipo; descricao: string }): string {
  return `${l.tipo}|${normalizar(l.descricao)}`;
}

export function conjuntoExato(lancamentos: Lancamento[]): Set<string> {
  return new Set(lancamentos.map(chaveExata));
}

export function conjuntoDeContas(lancamentos: Lancamento[]): Set<string> {
  return new Set(lancamentos.map(chaveDaConta));
}
