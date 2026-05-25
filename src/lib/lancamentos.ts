import { supabase } from "./supabase";
import type { Lancamento, NovoLancamento } from "../types";

// Toda a comunicação com o banco de lançamentos fica isolada aqui.
// Se um dia você trocar o Supabase por outro backend, só este arquivo muda.

export async function listarLancamentos(): Promise<Lancamento[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Usuário não autenticado.");

  const { data, error } = await supabase
    .from("lancamentos")
    .select(
      "id, user_id, tipo, valor, descricao, categoria, mes, ano, data, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function criarLancamento(
  dados: NovoLancamento
): Promise<Lancamento> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Usuário não autenticado.");

  const { data, error } = await supabase
    .from("lancamentos")
    .insert({ ...dados, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarLancamento(
  id: string,
  dados: NovoLancamento
): Promise<Lancamento> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Usuário não autenticado.");

  const { data, error } = await supabase
    .from("lancamentos")
    .update(dados)
    .eq("user_id", userId)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removerLancamento(id: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Usuário não autenticado.");

  const { error } = await supabase
    .from("lancamentos")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}
