import { supabase } from "./supabase";
import type { Lancamento, NovoLancamento } from "../types";

// Toda a comunicação com o banco de lançamentos fica isolada aqui.
// Se um dia você trocar o Supabase por outro backend, só este arquivo muda.

export async function listarLancamentos(): Promise<Lancamento[]> {
  const { data, error } = await supabase
    .from("lancamentos")
    .select("*")
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

export async function removerLancamento(id: string): Promise<void> {
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) throw error;
}
