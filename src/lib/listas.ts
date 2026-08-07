import { supabase } from "./supabase";
import { compararCompetencia, competenciaAtual } from "./calculos";
import type { Competencia } from "./calculos";
import { ERROS, ErroAmigavel, traduzirErro } from "./mensagens";
import type {
  Convite,
  Grupo,
  ItemLista,
  ListaContas,
  MembroGrupo,
  NovoItemLista,
  PerfilUsuario,
  PreviaConvite,
  ResumoGrupo,
} from "../types";

// Toda a comunicação com o banco de "Contas a Pagar" fica isolada aqui,
// no mesmo espírito de lancamentos.ts.
//
// Modelo mental: uma PILHA (grupo) é um conjunto de contas com nome, dono e
// membros próprios — "Contas mãe", "Contas esposa", "Minhas contas". A lista de
// um mês pertence à pilha, não à pessoa: por isso o mesmo mês pode ter uma
// lista em cada pilha sem se misturarem.
//
// O convite é da pilha. Quem entra por um link passa a ver aquela pilha em
// todos os meses, hoje e no futuro, até sair ou o dono remover.

const CAMPOS_GRUPO = "id, nome, criador_id, pessoal, arquivado, created_at";
const CAMPOS_MEMBRO = "id, grupo_id, user_id, entrou_em, conta_no_saldo";
const CAMPOS_LISTA = "id, grupo_id, mes, ano, created_at";
const CAMPOS_ITEM =
  "id, lista_id, descricao, valor, categoria, vencimento, pago, pago_por, pago_em, created_at";
const CAMPOS_CONVITE =
  "id, grupo_id, token, criado_em, expira_em, usado_em, usado_por";

const VIOLACAO_UNIQUE = "23505";

async function usuarioAtual(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new ErroAmigavel(ERROS.naoAutenticado);
  return userId;
}

/* ------------------------------------------------------------------ */
/* Pilhas (grupos)                                                    */
/* ------------------------------------------------------------------ */

// Ids das pilhas de que participo — como dono ou convidado. A tabela de
// membros já inclui o dono, então uma consulta responde os dois casos.
async function meusVinculos(
  userId: string
): Promise<{ grupo_id: string; conta_no_saldo: boolean }[]> {
  const { data, error } = await supabase
    .from("membros_grupo")
    .select("grupo_id, conta_no_saldo")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as { grupo_id: string; conta_no_saldo: boolean }[];
}

async function idsDasMinhasPilhas(userId: string): Promise<string[]> {
  return (await meusVinculos(userId)).map((v) => v.grupo_id);
}

export async function listarGrupos(
  incluirArquivadas = false
): Promise<Grupo[]> {
  const userId = await usuarioAtual();
  const vinculos = await meusVinculos(userId);
  if (vinculos.length === 0) return [];

  let consulta = supabase
    .from("grupos")
    .select(CAMPOS_GRUPO)
    .in(
      "id",
      vinculos.map((v) => v.grupo_id)
    )
    .order("created_at", { ascending: true });
  if (!incluirArquivadas) consulta = consulta.eq("arquivado", false);

  const { data, error } = await consulta;
  if (error) throw error;

  // Anexa a preferência do usuário atual: ela vive no vínculo, não na pilha.
  const contaNoSaldo = new Map(
    vinculos.map((v) => [v.grupo_id, v.conta_no_saldo])
  );

  // A pessoal primeiro; depois as compartilhadas, na ordem em que nasceram.
  return ((data ?? []) as Grupo[])
    .map((g) => ({ ...g, conta_no_saldo: contaNoSaldo.get(g.id) ?? false }))
    .sort((a, b) => Number(b.pessoal) - Number(a.pessoal));
}

// Arquivar é reversível e não perde nada — a pilha só sai do seletor.
export async function arquivarGrupo(
  grupoId: string,
  arquivado: boolean
): Promise<Grupo> {
  const userId = await usuarioAtual();

  const { data, error } = await supabase
    .from("grupos")
    .update({ arquivado })
    .eq("id", grupoId)
    .eq("criador_id", userId)
    .select(CAMPOS_GRUPO)
    .single();
  if (error) throw error;
  return data as Grupo;
}

// Preferência individual: mexe só no vínculo de quem chamou. O outro lado da
// pilha mantém a escolha dele.
export async function alternarContaNoSaldo(
  grupoId: string,
  contaNoSaldo: boolean
): Promise<void> {
  const userId = await usuarioAtual();

  const { error } = await supabase
    .from("membros_grupo")
    .update({ conta_no_saldo: contaNoSaldo })
    .eq("grupo_id", grupoId)
    .eq("user_id", userId);
  if (error) throw error;
}

// Contas ainda NÃO pagas das pilhas marcadas, da competência pedida PARA TRÁS.
//
// Duas regras aqui, e as duas custaram bug:
//
// 1. Só as não pagas. Ao marcar como paga, a conta sai daqui e o lançamento
//    (se o usuário aceitar criá-lo) assume o valor — senão o mesmo dinheiro
//    contaria duas vezes.
// 2. Acumula os meses anteriores, igual ao calcularSaldoProjetado. Uma conta
//    de agosto que ninguém pagou continua devida em setembro; filtrar só o mês
//    da tela fazia a dívida evaporar ao virar o mês.
export async function pendentesDeContas(
  mes: number,
  ano: number
): Promise<{ total: number; quantidade: number }> {
  const userId = await usuarioAtual();
  const vazio = { total: 0, quantidade: 0 };

  const marcados = (await meusVinculos(userId))
    .filter((v) => v.conta_no_saldo)
    .map((v) => v.grupo_id);
  if (marcados.length === 0) return vazio;

  // Arquivada não conta: se saiu da frente, não deve mexer no saldo.
  const { data: pilhas, error: erroPilhas } = await supabase
    .from("grupos")
    .select("id")
    .in("id", marcados)
    .eq("arquivado", false);
  if (erroPilhas) throw erroPilhas;

  const idsQueContam = (pilhas ?? []).map((g) => (g as { id: string }).id);
  if (idsQueContam.length === 0) return vazio;

  // Competência <= (mes, ano): anos anteriores inteiros, mais os meses até o
  // pedido dentro do ano corrente.
  const { data: listas, error: erroListas } = await supabase
    .from("listas_contas")
    .select("id")
    .in("grupo_id", idsQueContam)
    .or(`ano.lt.${ano},and(ano.eq.${ano},mes.lte.${mes})`);
  if (erroListas) throw erroListas;

  const idsListas = (listas ?? []).map((l) => (l as { id: string }).id);
  if (idsListas.length === 0) return vazio;

  const { data: itens, error: erroItens } = await supabase
    .from("itens_lista")
    .select("valor")
    .in("lista_id", idsListas)
    .eq("pago", false);
  if (erroItens) throw erroItens;

  const abertas = (itens ?? []) as { valor: number }[];
  return {
    total: abertas.reduce((s, i) => s + i.valor, 0),
    quantidade: abertas.length,
  };
}

// Destrutivo e em cascata: some com as listas e as contas de todos os meses,
// para todas as pessoas da pilha. A tela pede confirmação à altura.
export async function excluirGrupo(grupoId: string): Promise<void> {
  const userId = await usuarioAtual();

  const { error } = await supabase
    .from("grupos")
    .delete()
    .eq("id", grupoId)
    .eq("criador_id", userId);
  if (error) throw error;
}

export async function resumoDoGrupo(grupoId: string): Promise<ResumoGrupo> {
  await usuarioAtual();

  const { data, error } = await supabase.rpc("resumo_do_grupo", {
    grupo_id_param: grupoId,
  });
  if (error) throw new ErroAmigavel(traduzirErro(error));

  const linha = (data as ResumoGrupo[] | null)?.[0];
  return linha ?? { meses: 0, contas: 0, pessoas: 1 };
}

// Deixa a pilha nas mãos de quem fica. Depois disso o antigo dono vira membro
// comum e pode sair sem levar o histórico junto.
export async function transferirPosse(
  grupoId: string,
  novoDonoId: string
): Promise<void> {
  await usuarioAtual();

  const { error } = await supabase.rpc("transferir_posse", {
    grupo_id_param: grupoId,
    novo_dono_param: novoDonoId,
  });
  if (error) throw new ErroAmigavel(traduzirErro(error));
}

// Criar a pilha e entrar nela são duas escritas; se a segunda falhasse, o dono
// ficaria de fora da própria pilha e sem conseguir vê-la de novo.
export async function criarGrupo(nome: string, pessoal = false): Promise<Grupo> {
  const userId = await usuarioAtual();
  const nomeLimpo = nome.trim();
  if (!nomeLimpo) throw new ErroAmigavel(ERROS.nomeDaPilhaObrigatorio);

  const { data, error } = await supabase
    .from("grupos")
    .insert({ nome: nomeLimpo, criador_id: userId, pessoal })
    .select(CAMPOS_GRUPO)
    .single();
  if (error) throw error;

  const grupo = data as Grupo;
  const { error: erroMembro } = await supabase
    .from("membros_grupo")
    .insert({ grupo_id: grupo.id, user_id: userId });
  if (erroMembro) {
    await supabase.from("grupos").delete().eq("id", grupo.id);
    throw erroMembro;
  }

  return grupo;
}

export async function renomearGrupo(
  grupoId: string,
  nome: string
): Promise<Grupo> {
  const userId = await usuarioAtual();
  const nomeLimpo = nome.trim();
  if (!nomeLimpo) throw new ErroAmigavel(ERROS.nomeDaPilhaObrigatorio);

  const { data, error } = await supabase
    .from("grupos")
    .update({ nome: nomeLimpo })
    .eq("id", grupoId)
    .eq("criador_id", userId)
    .select(CAMPOS_GRUPO)
    .single();
  if (error) throw error;
  return data as Grupo;
}

// Toda conta precisa de pelo menos uma pilha. Em vez de criar no cadastro —
// que exigiria trigger no banco —, criamos na primeira vez que a tela abre.
export async function garantirPilhaPessoal(
  incluirArquivadas = false
): Promise<Grupo[]> {
  const ativas = await listarGrupos(incluirArquivadas);
  if (ativas.length > 0) return ativas;

  // Nenhuma ativa pode significar "todas arquivadas" — nesse caso não criamos
  // outra, senão arquivar tudo faria brotar uma pilha nova a cada carga.
  const todas = await listarGrupos(true);
  if (todas.length > 0) return ativas;

  return [await criarGrupo("Minhas contas", true)];
}

// Quantas pessoas há em cada pilha, numa consulta só. Serve ao contador do
// cabeçalho, que precisa do número de todas as pilhas ao mesmo tempo — buscar
// os membros de cada uma daria uma consulta por pilha.
export async function contarMembrosPorGrupo(): Promise<Map<string, number>> {
  const userId = await usuarioAtual();
  const ids = await idsDasMinhasPilhas(userId);
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from("membros_grupo")
    .select("grupo_id")
    .in("grupo_id", ids);
  if (error) throw error;

  const contagem = new Map<string, number>();
  for (const linha of data ?? []) {
    const id = (linha as { grupo_id: string }).grupo_id;
    contagem.set(id, (contagem.get(id) ?? 0) + 1);
  }
  return contagem;
}

export async function listarMembros(grupoId: string): Promise<MembroGrupo[]> {
  await usuarioAtual();

  const { data, error } = await supabase
    .from("membros_grupo")
    .select(CAMPOS_MEMBRO)
    .eq("grupo_id", grupoId)
    .order("entrou_em", { ascending: true });
  if (error) throw error;

  const membros = (data ?? []) as MembroGrupo[];
  if (membros.length === 0) return membros;

  const emails = await mapaDeEmails(membros.map((m) => m.user_id));
  return membros.map((m) => ({ ...m, email: emails.get(m.user_id) }));
}

// O dono remove qualquer membro; o membro sai por conta própria. Conferimos
// antes para poder explicar a recusa — um delete barrado pela RLS volta como
// sucesso com zero linhas.
export async function removerMembro(membroId: string): Promise<void> {
  const userId = await usuarioAtual();

  const { data: vinculo, error: erroVinculo } = await supabase
    .from("membros_grupo")
    .select(CAMPOS_MEMBRO)
    .eq("id", membroId)
    .maybeSingle();
  if (erroVinculo) throw erroVinculo;
  if (!vinculo) throw new ErroAmigavel(ERROS.listaNaoEncontrada);

  const membro = vinculo as MembroGrupo;
  if (membro.user_id !== userId) {
    const { data: grupo, error } = await supabase
      .from("grupos")
      .select(CAMPOS_GRUPO)
      .eq("id", membro.grupo_id)
      .maybeSingle();
    if (error) throw error;
    if ((grupo as Grupo | null)?.criador_id !== userId) {
      throw new ErroAmigavel(ERROS.apenasCriadorRemove);
    }
  }

  const { error } = await supabase
    .from("membros_grupo")
    .delete()
    .eq("id", membroId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Listas                                                             */
/* ------------------------------------------------------------------ */

async function listasAcessiveis(
  competencia?: Competencia
): Promise<ListaContas[]> {
  const userId = await usuarioAtual();
  const ids = await idsDasMinhasPilhas(userId);
  if (ids.length === 0) return [];

  let consulta = supabase
    .from("listas_contas")
    .select(CAMPOS_LISTA)
    .in("grupo_id", ids);
  if (competencia) {
    consulta = consulta.eq("mes", competencia.mes).eq("ano", competencia.ano);
  }

  const { data, error } = await consulta;
  if (error) throw error;
  return (data ?? []) as ListaContas[];
}

// Uma lista por pilha naquele mês. A tela usa isso para montar o seletor de
// pilhas — é aqui que "Contas mãe" e "Contas esposa" aparecem lado a lado.
export async function listarListasDoMes(
  mes: number,
  ano: number
): Promise<ListaContas[]> {
  const listas = await listasAcessiveis({ mes, ano });
  return listas.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// Qualquer membro pode abrir o mês da pilha; ela nasce dentro da pilha, então
// todos os membros já enxergam.
export async function criarLista(
  grupoId: string,
  mes: number,
  ano: number
): Promise<ListaContas> {
  await usuarioAtual();

  const { data, error } = await supabase
    .from("listas_contas")
    .insert({ grupo_id: grupoId, mes, ano })
    .select(CAMPOS_LISTA)
    .single();

  if (error?.code === VIOLACAO_UNIQUE) {
    throw new ErroAmigavel(ERROS.listaJaExiste);
  }
  if (error) throw error;
  return data as ListaContas;
}

export async function listarListas(): Promise<ListaContas[]> {
  const listas = await listasAcessiveis();
  return listas.sort((a, b) => compararCompetencia(b, a));
}

async function obterLista(listaId: string): Promise<ListaContas> {
  const { data, error } = await supabase
    .from("listas_contas")
    .select(CAMPOS_LISTA)
    .eq("id", listaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ErroAmigavel(ERROS.listaNaoEncontrada);
  return data as ListaContas;
}

// Meses fechados ficam acessíveis como referência histórica, mas não aceitam
// novos itens nem edição. Marcar como pago é a exceção deliberada.
async function garantirListaEditavel(listaId: string): Promise<ListaContas> {
  const lista = await obterLista(listaId);
  if (compararCompetencia(lista, competenciaAtual()) < 0) {
    throw new ErroAmigavel(ERROS.mesFechado);
  }
  return lista;
}

/* ------------------------------------------------------------------ */
/* Perfis                                                             */
/* ------------------------------------------------------------------ */

export async function buscarPerfis(ids: string[]): Promise<PerfilUsuario[]> {
  if (ids.length === 0) return [];
  await usuarioAtual();

  const { data, error } = await supabase.rpc("buscar_perfis_por_ids", {
    ids: [...new Set(ids)],
  });
  if (error) throw error;
  return (data ?? []) as PerfilUsuario[];
}

async function mapaDeEmails(ids: string[]): Promise<Map<string, string>> {
  const perfis = await buscarPerfis(ids);
  return new Map(perfis.map((p) => [p.id, p.email]));
}

/* ------------------------------------------------------------------ */
/* Itens                                                              */
/* ------------------------------------------------------------------ */

export async function listarItens(listaId: string): Promise<ItemLista[]> {
  await usuarioAtual();

  const { data, error } = await supabase
    .from("itens_lista")
    .select(CAMPOS_ITEM)
    .eq("lista_id", listaId)
    .order("vencimento", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;

  const itens = (data ?? []) as ItemLista[];
  const pagadores = itens
    .map((i) => i.pago_por)
    .filter((id): id is string => id !== null);
  if (pagadores.length === 0) return itens;

  const emails = await mapaDeEmails(pagadores);
  return itens.map((item) => ({
    ...item,
    pago_por_email: item.pago_por ? emails.get(item.pago_por) ?? null : null,
  }));
}

export async function criarItem(
  listaId: string,
  dados: NovoItemLista
): Promise<ItemLista> {
  await usuarioAtual();
  await garantirListaEditavel(listaId);

  const { data, error } = await supabase
    .from("itens_lista")
    .insert({ ...dados, lista_id: listaId })
    .select(CAMPOS_ITEM)
    .single();
  if (error) throw error;
  return data as ItemLista;
}

// Insere a leva inteira numa tacada. Um insert por conta faria a tela piscar
// item a item e deixaria metade da lista dentro se a rede caísse no meio.
export async function criarItensEmLote(
  listaId: string,
  itens: NovoItemLista[]
): Promise<ItemLista[]> {
  await usuarioAtual();
  if (itens.length === 0) return [];
  await garantirListaEditavel(listaId);

  const { data, error } = await supabase
    .from("itens_lista")
    .insert(itens.map((i) => ({ ...i, lista_id: listaId })))
    .select(CAMPOS_ITEM);

  if (error) throw error;
  return (data ?? []) as ItemLista[];
}

export async function atualizarItem(
  id: string,
  dados: Partial<NovoItemLista>
): Promise<ItemLista> {
  await usuarioAtual();

  const { data: item, error: erroItem } = await supabase
    .from("itens_lista")
    .select("lista_id")
    .eq("id", id)
    .maybeSingle();
  if (erroItem) throw erroItem;
  if (!item) throw new ErroAmigavel(ERROS.listaNaoEncontrada);

  await garantirListaEditavel((item as { lista_id: string }).lista_id);

  const { data, error } = await supabase
    .from("itens_lista")
    .update(dados)
    .eq("id", id)
    .select(CAMPOS_ITEM)
    .single();
  if (error) throw error;
  return data as ItemLista;
}

// Sem trava de mês, de propósito: esquecer de marcar a conta de julho e só
// lembrar em agosto é situação comum.
export async function marcarComoPago(id: string): Promise<ItemLista> {
  const userId = await usuarioAtual();

  const { data, error } = await supabase
    .from("itens_lista")
    .update({
      pago: true,
      pago_por: userId,
      pago_em: new Date().toISOString(),
    })
    .eq("id", id)
    .select(CAMPOS_ITEM)
    .single();
  if (error) throw error;
  return data as ItemLista;
}

export async function desmarcarPago(id: string): Promise<ItemLista> {
  await usuarioAtual();

  const { data, error } = await supabase
    .from("itens_lista")
    .update({ pago: false, pago_por: null, pago_em: null })
    .eq("id", id)
    .select(CAMPOS_ITEM)
    .single();
  if (error) throw error;
  return data as ItemLista;
}

// Qualquer membro exclui. Quem divide a lista divide o trabalho: exigir o dono
// para apagar travava a lista quando ele não estava por perto. O que segue
// restrito ao dono é a pilha — convidar, remover gente, renomear, apagar.
export async function deletarItem(id: string, listaId: string): Promise<void> {
  await usuarioAtual();

  const { error } = await supabase
    .from("itens_lista")
    .delete()
    .eq("id", id)
    .eq("lista_id", listaId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Convites por link                                                  */
/* ------------------------------------------------------------------ */

export interface ConviteGerado {
  token: string;
  expira_em: string;
}

export async function gerarConviteLink(
  grupoId: string,
  horasValidade = 48
): Promise<ConviteGerado> {
  await usuarioAtual();

  const { data, error } = await supabase.rpc("gerar_convite", {
    grupo_id_param: grupoId,
    horas_validade: horasValidade,
  });
  if (error) throw new ErroAmigavel(traduzirErro(error));

  const linha = (data as ConviteGerado[] | null)?.[0];
  if (!linha) throw new ErroAmigavel(ERROS.inesperado);
  return linha;
}

export async function verConvite(token: string): Promise<PreviaConvite> {
  await usuarioAtual();

  const { data, error } = await supabase.rpc("ver_convite", {
    token_param: token,
  });
  if (error) throw new ErroAmigavel(traduzirErro(error));

  const linha = (data as PreviaConvite[] | null)?.[0];
  if (!linha) throw new ErroAmigavel(ERROS.conviteInvalido);
  return linha;
}

// Devolve o id da pilha em que a pessoa acabou de entrar.
export async function aceitarConvitePorToken(token: string): Promise<string> {
  await usuarioAtual();

  const { data, error } = await supabase.rpc("aceitar_convite_por_token", {
    token_param: token,
  });
  if (error) throw new ErroAmigavel(traduzirErro(error));
  return data as string;
}

export async function listarConvitesAtivos(
  grupoId: string
): Promise<Convite[]> {
  await usuarioAtual();

  const { data, error } = await supabase
    .from("convites")
    .select(CAMPOS_CONVITE)
    .eq("grupo_id", grupoId)
    .is("usado_em", null)
    .gt("expira_em", new Date().toISOString())
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Convite[];
}

export async function revogarConvite(conviteId: string): Promise<void> {
  await usuarioAtual();

  const { error } = await supabase
    .from("convites")
    .delete()
    .eq("id", conviteId);
  if (error) throw error;
}
