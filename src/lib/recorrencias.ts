import { supabase } from "./supabase";
import { compararCompetencia, competenciaAtual, hojeLocal } from "./calculos";
import type { Competencia } from "./calculos";
import type {
  Lancamento,
  NovaRecorrencia,
  Recorrencia,
} from "../types";

const CAMPOS =
  "id, user_id, tipo, valor, descricao, categoria, frequencia, dia_semana, dia_mes, ativo, created_at";

export async function listarRecorrencias(): Promise<Recorrencia[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Usuário não autenticado.");

  const { data, error } = await supabase
    .from("recorrencias")
    .select(CAMPOS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function criarRecorrencia(
  dados: NovaRecorrencia
): Promise<Recorrencia> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Usuário não autenticado.");

  const { data, error } = await supabase
    .from("recorrencias")
    .insert({ ...dados, user_id: userId })
    .select(CAMPOS)
    .single();

  if (error) throw error;
  return data;
}

async function deletarLancamentosFuturos(
  userId: string,
  recorrenciaId: string
): Promise<void> {
  const { error } = await supabase
    .from("lancamentos")
    .delete()
    .eq("user_id", userId)
    .eq("recorrencia_id", recorrenciaId)
    .gt("data", hojeLocal());
  if (error) throw error;
}

export async function atualizarRecorrencia(
  id: string,
  dados: Partial<NovaRecorrencia>
): Promise<Recorrencia> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Usuário não autenticado.");

  const { data, error } = await supabase
    .from("recorrencias")
    .update(dados)
    .eq("user_id", userId)
    .eq("id", id)
    .select(CAMPOS)
    .single();

  if (error) throw error;

  // Limpa os futuros com os valores antigos — a próxima chamada de
  // gerarLancamentosRecorrentes recria com os novos valores. Passados
  // permanecem intactos (histórico imutável).
  await deletarLancamentosFuturos(userId, id);

  return data;
}

export async function deletarRecorrencia(id: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Usuário não autenticado.");

  // Remove os lançamentos futuros ainda não contabilizados. Os passados
  // continuam existindo — o FK ON DELETE SET NULL vai zerar o recorrencia_id
  // deles quando a recorrência for apagada, preservando o histórico.
  await deletarLancamentosFuturos(userId, id);

  const { error } = await supabase
    .from("recorrencias")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}

export async function toggleRecorrencia(
  id: string,
  ativo: boolean
): Promise<Recorrencia> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Usuário não autenticado.");

  // Ao pausar, remove os futuros para não poluir o mês corrente.
  // Ao ativar, o Dashboard dispara gerarLancamentosRecorrentes e recria.
  if (!ativo) {
    await deletarLancamentosFuturos(userId, id);
  }

  const { data, error } = await supabase
    .from("recorrencias")
    .update({ ativo })
    .eq("user_id", userId)
    .eq("id", id)
    .select(CAMPOS)
    .single();

  if (error) throw error;
  return data;
}

function formatarData(ano: number, mes: number, dia: number): string {
  const mm = String(mes + 1).padStart(2, "0");
  const dd = String(dia).padStart(2, "0");
  return `${ano}-${mm}-${dd}`;
}

function datasParaRecorrencia(
  r: Recorrencia,
  mes: number,
  ano: number
): string[] {
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();

  if (r.frequencia === "mensal") {
    if (r.dia_mes == null) return [];
    const dia = Math.min(r.dia_mes, ultimoDia);
    return [formatarData(ano, mes, dia)];
  }

  if (r.frequencia === "semanal") {
    if (r.dia_semana == null) return [];
    const datas: string[] = [];
    for (let dia = 1; dia <= ultimoDia; dia++) {
      if (new Date(ano, mes, dia).getDay() === r.dia_semana) {
        datas.push(formatarData(ano, mes, dia));
      }
    }
    return datas;
  }

  return [];
}

// Uma recorrência só materializa ocorrências a partir do mês em que foi criada
// e nunca em um mês já fechado. As duas condições são independentes: a primeira
// protege o histórico anterior à regra, a segunda protege qualquer mês passado
// visitado pelo MonthPicker.
export function podeGerarNaCompetencia(
  recorrenciaCriadaEm: string,
  alvo: Competencia,
  hoje: Competencia = competenciaAtual()
): boolean {
  if (compararCompetencia(alvo, hoje) < 0) return false;

  const criadaEm = new Date(recorrenciaCriadaEm);
  const criacao = {
    mes: criadaEm.getMonth(),
    ano: criadaEm.getFullYear(),
  };
  return compararCompetencia(alvo, criacao) >= 0;
}

export async function gerarLancamentosRecorrentes(
  mes: number,
  ano: number
): Promise<Lancamento[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Usuário não autenticado.");

  const { data: recorrencias, error: erroRec } = await supabase
    .from("recorrencias")
    .select(CAMPOS)
    .eq("user_id", userId)
    .eq("ativo", true);
  if (erroRec) throw erroRec;
  if (!recorrencias || recorrencias.length === 0) return [];

  const candidatos: Array<{
    user_id: string;
    tipo: Recorrencia["tipo"];
    valor: number;
    descricao: string;
    categoria: string;
    mes: number;
    ano: number;
    data: string;
    recorrencia_id: string;
  }> = [];
  for (const r of recorrencias as Recorrencia[]) {
    if (!podeGerarNaCompetencia(r.created_at, { mes, ano })) continue;

    for (const data of datasParaRecorrencia(r, mes, ano)) {
      candidatos.push({
        user_id: userId,
        tipo: r.tipo,
        valor: r.valor,
        descricao: r.descricao,
        categoria: r.categoria,
        mes,
        ano,
        data,
        recorrencia_id: r.id,
      });
    }
  }
  if (candidatos.length === 0) return [];

  // Filtra ocorrências que o usuário excluiu manualmente. Sem isso, apagar um
  // lançamento gerado apenas o traria de volta na próxima carga da tela.
  const idsRecorrencias = candidatos.map((c) => c.recorrencia_id);
  const datasCandidatas = candidatos.map((c) => c.data);
  const { data: excecoes, error: erroExc } = await supabase
    .from("recorrencia_excecoes")
    .select("recorrencia_id, data")
    .eq("user_id", userId)
    .in("recorrencia_id", idsRecorrencias)
    .in("data", datasCandidatas);
  if (erroExc) throw erroExc;

  const excluidos = new Set(
    (excecoes ?? []).map((e) => `${e.recorrencia_id}|${e.data}`)
  );
  const candidatosFiltrados = candidatos.filter(
    (c) => !excluidos.has(`${c.recorrencia_id}|${c.data}`)
  );
  if (candidatosFiltrados.length === 0) return [];

  // Upsert com ignoreDuplicates aproveita o índice único parcial
  // lancamentos_recorrencia_data_unique — se rodarmos duas gerações em paralelo
  // (StrictMode em dev, duas abas, retry de rede), a segunda vira no-op.
  const { data: inseridos, error } = await supabase
    .from("lancamentos")
    .upsert(candidatosFiltrados, {
      onConflict: "recorrencia_id,data",
      ignoreDuplicates: true,
    })
    .select();
  if (error) throw error;
  return (inseridos ?? []) as Lancamento[];
}
