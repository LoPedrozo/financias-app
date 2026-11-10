import { supabase } from "./supabase";
import type {
  Cartao,
  CompraCartao,
  NovaCompraCartao,
  NovoCartao,
  NovoPrevistoCartao,
  PrevistoCartao,
} from "../types";

// A comunicação com o banco do cartão de crédito: o cartão, as compras e os
// previstos (supabase/migrations/20261110_cartao.sql). A conta da fatura não
// mora aqui — é do app, em lib/fatura.ts.

const CAMPOS_CARTAO =
  "id, user_id, nome, dia_fechamento, dia_vencimento, meta_total, meta_essenciais, inicio, created_at";
const CAMPOS_COMPRA =
  "id, user_id, cartao_id, descricao, valor, categoria, data, parcelas, essencial, como, created_at";
const CAMPOS_PREVISTO =
  "id, user_id, cartao_id, descricao, valor, categoria, frequencia, dia_semana, dia_mes, essencial, ativo, created_at";

async function usuario(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Usuário não autenticado.");
  return id;
}

// O banco devolve numeric como número ou texto, conforme o tamanho; o app
// sempre trabalha com número.
const num = (v: unknown) => (v == null ? null : Number(v));
const paraCartao = (c: Cartao): Cartao => ({
  ...c,
  meta_total: num(c.meta_total),
  meta_essenciais: num(c.meta_essenciais),
});
const paraCompra = (c: CompraCartao): CompraCartao => ({ ...c, valor: Number(c.valor) });
const paraPrevisto = (p: PrevistoCartao): PrevistoCartao => ({ ...p, valor: Number(p.valor) });

/** O cartão do usuário (o app acompanha um só), ou null se ainda não há. */
export async function obterCartao(): Promise<Cartao | null> {
  const userId = await usuario();
  const { data, error } = await supabase
    .from("cartoes")
    .select(CAMPOS_CARTAO)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data && data.length > 0 ? paraCartao(data[0] as Cartao) : null;
}

export async function criarCartao(dados: NovoCartao): Promise<Cartao> {
  const userId = await usuario();
  const { data, error } = await supabase
    .from("cartoes")
    .insert({ ...dados, user_id: userId })
    .select(CAMPOS_CARTAO)
    .single();
  if (error) throw error;
  return paraCartao(data as Cartao);
}

export async function atualizarCartao(id: string, dados: NovoCartao): Promise<Cartao> {
  const userId = await usuario();
  const { data, error } = await supabase
    .from("cartoes")
    .update(dados)
    .eq("user_id", userId)
    .eq("id", id)
    .select(CAMPOS_CARTAO)
    .single();
  if (error) throw error;
  return paraCartao(data as Cartao);
}

export async function listarCompras(cartaoId: string): Promise<CompraCartao[]> {
  const userId = await usuario();
  const { data, error } = await supabase
    .from("compras_cartao")
    .select(CAMPOS_COMPRA)
    .eq("user_id", userId)
    .eq("cartao_id", cartaoId)
    .order("data", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as CompraCartao[]).map(paraCompra);
}

export async function criarCompra(dados: NovaCompraCartao): Promise<CompraCartao> {
  const userId = await usuario();
  const { data, error } = await supabase
    .from("compras_cartao")
    .insert({ ...dados, user_id: userId })
    .select(CAMPOS_COMPRA)
    .single();
  if (error) throw error;
  return paraCompra(data as CompraCartao);
}

export async function atualizarCompra(id: string, dados: NovaCompraCartao): Promise<CompraCartao> {
  const userId = await usuario();
  const { data, error } = await supabase
    .from("compras_cartao")
    .update(dados)
    .eq("user_id", userId)
    .eq("id", id)
    .select(CAMPOS_COMPRA)
    .single();
  if (error) throw error;
  return paraCompra(data as CompraCartao);
}

export async function removerCompra(id: string): Promise<void> {
  const userId = await usuario();
  const { error } = await supabase.from("compras_cartao").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}

export async function listarPrevistos(cartaoId: string): Promise<PrevistoCartao[]> {
  const userId = await usuario();
  const { data, error } = await supabase
    .from("previstos_cartao")
    .select(CAMPOS_PREVISTO)
    .eq("user_id", userId)
    .eq("cartao_id", cartaoId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as PrevistoCartao[]).map(paraPrevisto);
}

export async function criarPrevisto(dados: NovoPrevistoCartao): Promise<PrevistoCartao> {
  const userId = await usuario();
  const { data, error } = await supabase
    .from("previstos_cartao")
    .insert({ ...dados, user_id: userId })
    .select(CAMPOS_PREVISTO)
    .single();
  if (error) throw error;
  return paraPrevisto(data as PrevistoCartao);
}

export async function atualizarPrevisto(id: string, dados: NovoPrevistoCartao): Promise<PrevistoCartao> {
  const userId = await usuario();
  const { data, error } = await supabase
    .from("previstos_cartao")
    .update(dados)
    .eq("user_id", userId)
    .eq("id", id)
    .select(CAMPOS_PREVISTO)
    .single();
  if (error) throw error;
  return paraPrevisto(data as PrevistoCartao);
}

export async function removerPrevisto(id: string): Promise<void> {
  const userId = await usuario();
  const { error } = await supabase.from("previstos_cartao").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}
