import { MESES } from "../types";

// A saudação do topo: "Boa tarde, Lorenzo" e a data de hoje por extenso.
//
// Tudo aqui é função pura de uma data, para ser testada sem relógio de
// verdade. Quem fornece o "agora" — e o atualiza quando o período vira com o
// app aberto — é o useAgora.

export type Periodo = "manha" | "tarde" | "noite";

// Madrugada conta como noite: abrir o app à 1h e ler "Bom dia" soa errado.
export function periodoDoDia(agora: Date): Periodo {
  const hora = agora.getHours();
  if (hora >= 5 && hora < 12) return "manha";
  if (hora >= 12 && hora < 18) return "tarde";
  return "noite";
}

const SAUDACOES: Record<Periodo, string> = {
  manha: "Bom dia",
  tarde: "Boa tarde",
  noite: "Boa noite",
};

export function saudacao(periodo: Periodo, nome: string | null): string {
  return nome ? `${SAUDACOES[periodo]}, ${nome}` : SAUDACOES[periodo];
}

// Sem o "-feira": a data divide a linha com o nome do app, e "Sexta-feira"
// fazia a linha quebrar num celular de 320px.
const DIAS_DA_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// "Sexta, 6 nov 2026". O ano mora aqui, e não no carrossel de meses: lá os
// meses ficam só abreviados (OUT NOV DEZ). Montada à mão, e não com
// toLocaleDateString: o formato do navegador varia de aparelho para aparelho
// (vírgula, "de", ponto na abreviação), e o topo precisa caber igual em todos.
export function dataCurta(agora: Date): string {
  const mes = MESES[agora.getMonth()].slice(0, 3).toLowerCase();
  return `${DIAS_DA_SEMANA[agora.getDay()]}, ${agora.getDate()} ${mes} ${agora.getFullYear()}`;
}

// O primeiro nome vem do perfil do Google, que o Supabase guarda em
// user_metadata. Quem entrou com e-mail e senha não tem nome nenhum ali: aí
// a saudação fica só "Boa tarde" — melhor que chamar a pessoa pelo e-mail.
export function primeiroNome(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  for (const campo of ["given_name", "full_name", "name"]) {
    const valor = m[campo];
    if (typeof valor !== "string") continue;
    const primeiro = valor.trim().split(/\s+/)[0];
    // Nome que parece e-mail não é nome: alguns provedores repetem o
    // endereço no campo "name".
    if (primeiro && !primeiro.includes("@")) return primeiro;
  }
  return null;
}
