import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Pencil, Trash2, Receipt, AlertTriangle, RotateCw,
  ChevronDown, ChevronRight, Users, Check, FolderPlus, MoreHorizontal, Archive,
  Wallet, ClipboardPaste,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { MESES } from "../types";
import type {
  Grupo, ItemLista, ListaContas, NovoItemLista, ResumoGrupo,
} from "../types";
import {
  alternarContaNoSaldo, arquivarGrupo, atualizarItem, contarMembrosPorGrupo,
  criarGrupo, criarItem, criarItensEmLote,
  criarLista, deletarItem, desmarcarPago, excluirGrupo, garantirPilhaPessoal,
  listarItens, listarListasDoMes, listarMembros, marcarComoPago, removerMembro,
  renomearGrupo, resumoDoGrupo, transferirPosse,
} from "../lib/listas";
import MenuPilha, { type AcaoPilha } from "./MenuPilha";
import ModalPassarPosse from "./ModalPassarPosse";
import { supabase } from "../lib/supabase";
import { SUCESSOS, traduzirErro } from "../lib/mensagens";
import { compararCompetencia, competenciaAtual, hojeLocal } from "../lib/calculos";
import { brl } from "../lib/format";
import { SkeletonLista } from "./Skeleton";
import EmptyState from "./EmptyState";
import ConfirmModal from "./ConfirmModal";
import Toast, { type ToastDados } from "./Toast";
import ModalItem from "./ModalItem";
import ModalCompartilhar from "./ModalCompartilhar";
import ModalNomeGrupo from "./ModalNomeGrupo";
import ModalColarLista from "./ModalColarLista";
import AvisoDesatualizado from "./AvisoDesatualizado";

interface Props {
  mes: number;
  ano: number;
  session: Session;
  onNovoLancamento?: (item: ItemLista) => void;
}

function dataBR(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function vencimentoPadrao(mes: number, ano: number): string {
  const hoje = competenciaAtual();
  if (hoje.mes === mes && hoje.ano === ano) return hojeLocal();
  return `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
}

export default function ContasAPagar({ mes, ano, session, onNovoLancamento }: Props) {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [membrosPorGrupo, setMembrosPorGrupo] = useState<Map<string, number>>(
    new Map()
  );
  const [listas, setListas] = useState<ListaContas[]>([]);
  const [itens, setItens] = useState<ItemLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [pagosExpandido, setPagosExpandido] = useState(false);
  const [modalItem, setModalItem] = useState<ItemLista | "novo" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ItemLista | null>(null);
  const [modalCompartilhar, setModalCompartilhar] = useState(false);
  const [modalNovaPilha, setModalNovaPilha] = useState(false);
  const [modalColar, setModalColar] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [modalRenomear, setModalRenomear] = useState(false);
  const [modalPassarPosse, setModalPassarPosse] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState<ResumoGrupo | null>(null);
  const [afetados, setAfetados] = useState<string[]>([]);
  const [verArquivadas, setVerArquivadas] = useState(false);
  const [pilhasCarregadas, setPilhasCarregadas] = useState(false);
  const [falhaAoAtualizar, setFalhaAoAtualizar] = useState(false);
  const [toast, setToast] = useState<ToastDados | null>(null);
  const [toastPagamento, setToastPagamento] = useState<ItemLista | null>(null);

  const mesPassado = compararCompetencia({ mes, ano }, competenciaAtual()) < 0;
  const grupo = grupos.find((g) => g.id === grupoId) ?? null;
  const lista = listas.find((l) => l.grupo_id === grupoId) ?? null;
  const ehDono = grupo?.criador_id === session.user.id;
  // Mínimo 1: o dono é sempre membro, então uma pilha nunca tem zero pessoas.
  const quantasPessoas = grupoId ? (membrosPorGrupo.get(grupoId) ?? 1) : 1;

  // Numa faixa que rola, a aba selecionada pode nascer fora da vista — ao
  // trocar de pilha ou entrar na tela, ela é trazida para dentro.
  const abaAtivaRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    abaAtivaRef.current?.scrollIntoView({
      inline: "nearest",
      block: "nearest",
    });
  }, [grupoId, grupos.length]);

  const avisar = useCallback((tipo: ToastDados["tipo"], mensagem: string) => {
    setToast({ id: Date.now(), tipo, mensagem });
  }, []);

  // Toda conta precisa de pelo menos uma pilha; se for a primeira vez, a
  // pessoal é criada aqui.
  const carregarPilhas = useCallback(async () => {
    const [pilhas, contagem] = await Promise.all([
      garantirPilhaPessoal(verArquivadas),
      contarMembrosPorGrupo(),
    ]);
    setGrupos(pilhas);
    setMembrosPorGrupo(contagem);
    setGrupoId((atual) =>
      atual && pilhas.some((g) => g.id === atual) ? atual : pilhas[0]?.id ?? null
    );
    setPilhasCarregadas(true);
  }, [verArquivadas]);

  useEffect(() => {
    carregarPilhas().catch((e) => {
      console.error(e);
      setErro(traduzirErro(e));
      setPilhasCarregadas(true);
      setCarregando(false);
    });
  }, [carregarPilhas]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setListas(await listarListasDoMes(mes, ano));
    } catch (e) {
      console.error(e);
      setErro(traduzirErro(e));
    } finally {
      setCarregando(false);
    }
  }, [mes, ano]);

  useEffect(() => {
    // Sem esperar as pilhas, o primeiro render (grupos ainda vazio) mostraria
    // o vazio por um instante antes de tudo aparecer.
    if (!pilhasCarregadas) return;
    if (grupos.length > 0) {
      carregar();
      return;
    }
    // Nenhuma pilha ativa — arquivar todas deixava a tela presa no esqueleto.
    setListas([]);
    setCarregando(false);
  }, [carregar, grupos.length, pilhasCarregadas]);

  // Os itens seguem a lista da pilha selecionada; trocar de pilha ou de mês
  // troca a lista, e daí os itens.
  const listaId = lista?.id ?? null;

  const recarregarItens = useCallback(async () => {
    if (!listaId) {
      setItens([]);
      return;
    }
    setItens(await listarItens(listaId));
  }, [listaId]);

  useEffect(() => {
    let cancelado = false;
    recarregarItens().catch((e) => {
      console.error(e);
      if (!cancelado) setErro(traduzirErro(e));
    });
    return () => {
      cancelado = true;
    };
  }, [recarregarItens]);

  // Tempo real: quando a outra pessoa mexe na mesma lista, a tela reflete sem
  // recarregar. Recarregamos a lista inteira em vez de aplicar o payload
  // evento a evento — assim o email de quem pagou é resolvido junto e não há
  // risco de o estado local divergir do banco.
  //
  // A RLS vale aqui também: quem não é do grupo não recebe o evento.
  useEffect(() => {
    if (!listaId) return;

    const canal = supabase
      .channel(`itens-lista-${listaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "itens_lista",
          filter: `lista_id=eq.${listaId}`,
        },
        () => {
          recarregarItens().catch((e) => {
            console.error(e);
            setFalhaAoAtualizar(true);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [listaId, recarregarItens]);

  // O outro lado pode abrir o mês antes de mim, e alguém pode entrar na pilha
  // pelo link a qualquer momento. Sem filtro porque a RLS já recorta: só
  // chegam eventos de grupos de que eu participo.
  useEffect(() => {
    const canal = supabase
      .channel("pilhas-e-listas")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listas_contas" },
        () => {
          carregar();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "membros_grupo" },
        () => {
          carregarPilhas().catch((e) => {
            console.error(e);
            setFalhaAoAtualizar(true);
          });
        }
      )
      // Renomear, arquivar ou excluir do outro lado chega sem recarregar.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grupos" },
        () => {
          carregarPilhas().catch((e) => {
            console.error(e);
            setFalhaAoAtualizar(true);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregar, carregarPilhas]);

  const atualizarTudo = useCallback(() => {
    setFalhaAoAtualizar(false);
    Promise.all([carregarPilhas(), recarregarItens(), carregar()]).catch((e) => {
      console.error(e);
      setFalhaAoAtualizar(true);
    });
  }, [carregarPilhas, recarregarItens, carregar]);

  // Com o celular bloqueado o WebSocket cai e os eventos perdidos não voltam.
  // Ao reaparecer, recarregamos em vez de confiar no que o Realtime trouxe.
  useEffect(() => {
    function aoVoltar() {
      if (document.visibilityState === "visible") atualizarTudo();
    }
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [atualizarTudo]);

  async function abrirMes() {
    if (!grupoId || ocupado) return;
    setOcupado(true);
    try {
      const nova = await criarLista(grupoId, mes, ano);
      setListas((atual) => [...atual, nova]);
      avisar("sucesso", SUCESSOS.listaCriada(MESES[mes]));
    } catch (e) {
      console.error(e);
      avisar("erro", traduzirErro(e));
    } finally {
      setOcupado(false);
    }
  }

  async function novaPilha(nome: string) {
    try {
      const criado = await criarGrupo(nome);
      setGrupos((atual) => [...atual, criado]);
      setGrupoId(criado.id);
      setModalNovaPilha(false);
      avisar("sucesso", `Lista "${criado.nome}" criada.`);
    } catch (e) {
      console.error(e);
      avisar("erro", traduzirErro(e));
    }
  }

  async function renomear(nome: string) {
    if (!grupo) return;
    try {
      const atualizado = await renomearGrupo(grupo.id, nome);
      setGrupos((atual) =>
        atual.map((g) => (g.id === atualizado.id ? atualizado : g))
      );
      setModalRenomear(false);
      avisar("sucesso", "Nome atualizado.");
    } catch (e) {
      console.error(e);
      avisar("erro", traduzirErro(e));
    }
  }

  async function sairDaPilha() {
    if (!grupo) return;
    try {
      const membros = await listarMembros(grupo.id);
      const meu = membros.find((m) => m.user_id === session.user.id);
      if (!meu) return;
      await removerMembro(meu.id);
      setGrupoId(null);
      await carregarPilhas();
      avisar("sucesso", SUCESSOS.saiuDaLista);
    } catch (e) {
      console.error(e);
      avisar("erro", traduzirErro(e));
    }
  }

  async function arquivar(arquivado: boolean) {
    if (!grupo) return;
    try {
      await arquivarGrupo(grupo.id, arquivado);
      setGrupoId(null);
      await carregarPilhas();
      avisar(
        "sucesso",
        arquivado
          ? `"${grupo.nome}" arquivada. O histórico continua guardado.`
          : `"${grupo.nome}" está de volta.`
      );
    } catch (e) {
      console.error(e);
      avisar("erro", traduzirErro(e));
    }
  }

  async function confirmarExclusaoDaPilha() {
    if (!grupo) return;
    const nome = grupo.nome;
    setConfirmExcluir(null);
    try {
      await excluirGrupo(grupo.id);
      setGrupoId(null);
      await carregarPilhas();
      avisar("sucesso", `"${nome}" foi excluída.`);
    } catch (e) {
      console.error(e);
      avisar("erro", traduzirErro(e));
    }
  }

  async function passarPosse(novoDonoId: string) {
    if (!grupo) return;
    try {
      await transferirPosse(grupo.id, novoDonoId);
      setModalPassarPosse(false);
      await carregarPilhas();
      avisar("sucesso", "Posse transferida. Agora você é participante.");
    } catch (e) {
      console.error(e);
      avisar("erro", traduzirErro(e));
    }
  }

  async function alternarSaldo() {
    if (!grupo) return;
    const ligando = !grupo.conta_no_saldo;
    try {
      await alternarContaNoSaldo(grupo.id, ligando);
      setGrupos((atual) =>
        atual.map((g) =>
          g.id === grupo.id ? { ...g, conta_no_saldo: ligando } : g
        )
      );
      avisar(
        "sucesso",
        ligando
          ? `As contas em aberto de "${grupo.nome}" entram no seu saldo projetado.`
          : `"${grupo.nome}" saiu do seu saldo projetado.`
      );
    } catch (e) {
      console.error(e);
      avisar("erro", traduzirErro(e));
    }
  }

  async function acaoDaPilha(acao: AcaoPilha) {
    setMenuAberto(false);
    if (!grupo) return;
    switch (acao) {
      case "alternarSaldo":
        await alternarSaldo();
        break;
      case "compartilhar":
        setModalCompartilhar(true);
        break;
      case "renomear":
        setModalRenomear(true);
        break;
      case "passarPosse":
        setModalPassarPosse(true);
        break;
      case "sair":
        await sairDaPilha();
        break;
      case "arquivar":
        await arquivar(true);
        break;
      case "desarquivar":
        await arquivar(false);
        break;
      case "excluir":
        // Buscamos o tamanho do estrago antes de perguntar: "isso apaga 4
        // meses e 23 contas" pesa diferente de "tem certeza?". E os emails de
        // quem perde acesso — some da tela deles sem aviso nenhum.
        try {
          const [resumo, pessoas] = await Promise.all([
            resumoDoGrupo(grupo.id),
            listarMembros(grupo.id),
          ]);
          setConfirmExcluir(resumo);
          setAfetados(
            pessoas
              .filter((m) => m.user_id !== session.user.id)
              .map((m) => m.email ?? "outra pessoa")
          );
        } catch (e) {
          console.error(e);
          avisar("erro", traduzirErro(e));
        }
        break;
    }
  }

  async function salvarLote(novos: NovoItemLista[]) {
    if (!lista) return;
    try {
      const criados = await criarItensEmLote(lista.id, novos);
      setItens((atual) => [...atual, ...criados]);
      setModalColar(false);
      avisar(
        "sucesso",
        `${criados.length} ${criados.length === 1 ? "conta adicionada" : "contas adicionadas"}.`
      );
    } catch (e) {
      console.error(e);
      avisar("erro", traduzirErro(e));
    }
  }

  async function salvarItem(dados: NovoItemLista) {
    if (!lista) return;
    const editando = modalItem !== "novo" ? modalItem : null;
    try {
      if (editando) {
        const atualizado = await atualizarItem(editando.id, dados);
        setItens((atual) =>
          atual.map((i) => (i.id === atualizado.id ? atualizado : i))
        );
        avisar("sucesso", SUCESSOS.itemAtualizado);
      } else {
        const novo = await criarItem(lista.id, dados);
        setItens((atual) => [...atual, novo]);
        avisar("sucesso", SUCESSOS.itemCriado);
      }
      setModalItem(null);
    } catch (e) {
      console.error(e);
      avisar("erro", traduzirErro(e));
    }
  }

  async function alternarPago(item: ItemLista) {
    const anterior = itens;
    setItens((atual) =>
      atual.map((i) => (i.id === item.id ? { ...i, pago: !i.pago } : i))
    );
    try {
      const atualizado = item.pago
        ? await desmarcarPago(item.id)
        : await marcarComoPago(item.id);
      // O banco devolve só o user_id em pago_por, e quem acabou de pagar é o
      // usuário da sessão — sem isso a linha diria "pago por alguém" até a
      // próxima carga da tela.
      const comAutor: ItemLista = {
        ...atualizado,
        pago_por_email: atualizado.pago ? (session.user.email ?? null) : null,
      };
      setItens((atual) =>
        atual.map((i) => (i.id === comAutor.id ? comAutor : i))
      );
      if (item.pago) {
        avisar("sucesso", SUCESSOS.itemDesmarcado);
      } else {
        setToastPagamento(comAutor);
      }
    } catch (e) {
      console.error(e);
      setItens(anterior);
      avisar("erro", traduzirErro(e));
    }
  }

  async function confirmarExclusao() {
    if (!confirmDelete || !lista) return;
    const alvo = confirmDelete;
    setConfirmDelete(null);
    const anterior = itens;
    setItens((atual) => atual.filter((i) => i.id !== alvo.id));
    try {
      await deletarItem(alvo.id, lista.id);
      avisar("sucesso", SUCESSOS.itemExcluido);
    } catch (e) {
      console.error(e);
      setItens(anterior);
      avisar("erro", traduzirErro(e));
    }
  }

  const hoje = hojeLocal();
  const pendentes = useMemo(
    () =>
      itens
        .filter((i) => !i.pago)
        .slice()
        .sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    [itens]
  );
  const pagos = useMemo(() => itens.filter((i) => i.pago), [itens]);

  const total = itens.reduce((s, i) => s + i.valor, 0);
  const totalPago = pagos.reduce((s, i) => s + i.valor, 0);
  const percentual = total > 0 ? Math.round((totalPago / total) * 100) : 0;

  function renderItem(item: ItemLista) {
    const vencido = !item.pago && item.vencimento < hoje;
    return (
      <div
        key={item.id}
        style={{
          ...styles.item,
          borderLeft: `3px solid ${vencido ? "var(--red)" : "var(--accent)"}`,
        }}
      >
        <button
          style={styles.check}
          onClick={() => alternarPago(item)}
          aria-label="Marcar como paga"
          title="Marcar como paga"
        >
          <span style={styles.checkVazio} />
        </button>
        <div style={styles.itemCorpo}>
          <div style={styles.itemLinha}>
            <span style={styles.descricao}>{item.descricao}</span>
            <span style={styles.valor}>− {brl(item.valor)}</span>
          </div>
          <div style={styles.itemMeta}>
            {vencido && (
              <span style={styles.badgeVencido}>
                <AlertTriangle size={11} /> Vencido
              </span>
            )}
            <span>
              {vencido ? "venceu" : "vence"} dia {dataBR(item.vencimento)}
            </span>
            <span style={styles.sep}>·</span>
            <span>{item.categoria}</span>
          </div>
        </div>
        {!mesPassado && (
          <div style={styles.acoes}>
            <button
              style={styles.acao}
              onClick={() => setModalItem(item)}
              aria-label="Editar conta"
              title="Editar"
            >
              <Pencil size={15} />
            </button>
            <button
              style={styles.acao}
              onClick={() => setConfirmDelete(item)}
              aria-label="Excluir conta"
              title="Excluir"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderItemPago(item: ItemLista) {
    return (
      <div key={item.id} style={styles.itemPago}>
        <button
          style={styles.check}
          onClick={() => alternarPago(item)}
          aria-label="Desmarcar como paga"
          title="Desmarcar como paga"
        >
          <span style={styles.checkMarcado}>
            <Check size={12} color="#fff" strokeWidth={3} />
          </span>
        </button>
        <div style={styles.itemCorpo}>
          <div style={styles.itemLinha}>
            <span style={{ ...styles.descricao, textDecoration: "line-through" }}>
              {item.descricao}
            </span>
            <span style={styles.valorPago}>{brl(item.valor)}</span>
          </div>
          <div style={styles.itemMetaPago}>
            pago por {item.pago_por_email ?? "alguém"}
            {item.pago_em ? ` · dia ${dataBR(item.pago_em.slice(0, 10))}` : ""}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.painel} className="panel-mobile">
      <div style={styles.head}>
        <div style={{ minWidth: 0 }}>
          <h2 style={styles.titulo}>Contas a Pagar</h2>
          <p style={styles.subtitulo}>
            {MESES[mes]} de {ano}
          </p>
        </div>
        <div style={styles.headAcoes}>
          {grupo && (
            <button
              style={styles.pessoas}
              onClick={() => setModalCompartilhar(true)}
              aria-label={`${quantasPessoas} ${quantasPessoas === 1 ? "pessoa" : "pessoas"} nesta lista. Compartilhar.`}
              title={
                quantasPessoas === 1
                  ? "Só você vê esta lista"
                  : `${quantasPessoas} pessoas veem esta lista`
              }
            >
              <Users size={15} />
              <span>{quantasPessoas}</span>
            </button>
          )}
          {lista && !mesPassado && (
            <>
              <button
                style={styles.colar}
                onClick={() => setModalColar(true)}
                title="Cole a lista pronta do WhatsApp e cadastre tudo de uma vez"
              >
                <ClipboardPaste size={15} /> Colar lista
              </button>
              <button
                style={styles.adicionar}
                onClick={() => setModalItem("novo")}
              >
                <Plus size={16} /> Adicionar
              </button>
            </>
          )}
        </div>
      </div>

      {falhaAoAtualizar && <AvisoDesatualizado onTentarDeNovo={atualizarTudo} />}

      {/* Cada pilha é um conjunto separado de contas, com seus próprios
          membros. É aqui que "Contas da mãe" e "Contas da esposa" convivem. */}
      <div style={styles.seletorLinha}>
        <div style={styles.seletor} className="abas-rolaveis">
          {grupos.map((g) => (
            <button
              key={g.id}
              ref={g.id === grupoId ? abaAtivaRef : undefined}
              onClick={() => setGrupoId(g.id)}
              style={{
                ...styles.seletorBtn,
                ...(g.id === grupoId ? styles.seletorBtnAtivo : {}),
                ...(g.arquivado ? styles.seletorBtnArquivado : {}),
              }}
            >
              {g.arquivado && <Archive size={12} style={{ flexShrink: 0 }} />}
              <span style={styles.seletorBtnNome}>{g.nome}</span>
              {/* Diz de relance quais pilhas mexem no seu saldo projetado —
                  sem isso o número do Início vem sem explicação. */}
              {g.conta_no_saldo && !g.arquivado && (
                <Wallet
                  size={11}
                  aria-label="Conta no seu saldo projetado"
                  style={{ flexShrink: 0 }}
                />
              )}
            </button>
          ))}
        </div>

        <div style={styles.seletorAcoes}>
          <button
            style={{
              ...styles.iconeSeletor,
              color: verArquivadas ? "var(--accent)" : "var(--text-faint)",
            }}
            onClick={() => setVerArquivadas((v) => !v)}
            aria-label={verArquivadas ? "Esconder arquivadas" : "Ver arquivadas"}
            title={verArquivadas ? "Esconder arquivadas" : "Ver arquivadas"}
          >
            <Archive size={15} />
          </button>
          <button
            style={styles.iconeSeletor}
            onClick={() => setModalNovaPilha(true)}
            aria-label="Nova lista"
            title="Nova lista"
          >
            <FolderPlus size={15} />
          </button>
          {grupo && (
            <div style={{ position: "relative" }}>
              <button
                style={styles.iconeSeletor}
                onClick={() => setMenuAberto((v) => !v)}
                aria-label="Opções da lista"
                aria-expanded={menuAberto}
                title="Opções da lista"
              >
                <MoreHorizontal size={16} />
              </button>
              {menuAberto && (
                <MenuPilha
                  grupo={grupo}
                  ehDono={!!ehDono}
                  temOutrosMembros={quantasPessoas > 1}
                  onAcao={acaoDaPilha}
                  onFechar={() => setMenuAberto(false)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* O total precisa ser a primeira coisa que se lê. Ele já era calculado,
          mas vivia em letra miúda embaixo da barra — e por isso o usuário
          lançava um card "Total de Tudo" à mão, que dobrava o valor da pilha. */}
      {itens.length > 0 && (
        <div style={styles.resumo}>
          <p style={styles.resumoRotulo}>Total de {MESES[mes]}</p>
          <p style={styles.resumoTotal}>{brl(total)}</p>
          <div style={styles.barra}>
            <div style={{ ...styles.barraCheia, width: `${percentual}%` }} />
          </div>
          <p style={styles.resumoTexto}>
            {totalPago > 0 && `${brl(totalPago)} pagos · `}
            {total - totalPago > 0.001
              ? `falta ${brl(total - totalPago)}`
              : "tudo pago"}
            {" · "}
            {percentual}%
          </p>
        </div>
      )}

      {carregando ? (
        <SkeletonLista linhas={3} />
      ) : erro ? (
        <div style={styles.erroBox}>
          <div style={styles.erroIcone}>
            <AlertTriangle size={22} />
          </div>
          <p style={styles.erroTexto}>{erro}</p>
          <button style={styles.retry} onClick={carregar}>
            <RotateCw size={14} /> Tentar novamente
          </button>
        </div>
      ) : !grupo ? (
        <EmptyState
          icon={<Receipt size={24} />}
          titulo={
            verArquivadas
              ? "Você ainda não tem nenhuma lista"
              : "Todas as suas listas estão arquivadas"
          }
          sugestao={
            verArquivadas
              ? "Crie uma para começar a organizar as contas do mês."
              : "Toque no ícone de caixa para vê-las de novo, ou crie uma nova."
          }
          acao={
            <button
              style={styles.adicionar}
              onClick={() => setModalNovaPilha(true)}
            >
              <Plus size={16} /> Nova lista
            </button>
          }
        />
      ) : !lista ? (
        <EmptyState
          icon={<Receipt size={24} />}
          titulo={
            mesPassado
              ? "Nenhuma conta registrada neste mês"
              : `${grupo.nome} ainda não tem ${MESES[mes]}`
          }
          sugestao={mesPassado ? undefined : "Abra o mês e comece a lançar."}
          acao={
            mesPassado ? undefined : (
              <button
                style={{ ...styles.adicionar, opacity: ocupado ? 0.7 : 1 }}
                onClick={abrirMes}
                disabled={ocupado}
              >
                <Plus size={16} />
                {ocupado ? "Abrindo..." : `Abrir ${MESES[mes]}`}
              </button>
            )
          }
        />
      ) : itens.length === 0 ? (
        <EmptyState
          icon={<Receipt size={24} />}
          titulo={
            mesPassado
              ? "Nenhuma conta registrada neste mês"
              : "Nenhuma conta cadastrada"
          }
          sugestao={
            mesPassado
              ? undefined
              : "Lance uma por vez, ou cole a lista inteira de uma vez só."
          }
          acao={
            mesPassado ? undefined : (
              <div style={styles.acoesVazio}>
                <button
                  style={styles.adicionar}
                  onClick={() => setModalColar(true)}
                >
                  <ClipboardPaste size={16} /> Colar lista pronta
                </button>
                <button
                  style={styles.colar}
                  onClick={() => setModalItem("novo")}
                >
                  <Plus size={16} /> Adicionar uma conta
                </button>
              </div>
            )
          }
        />
      ) : (
        <div style={styles.lista}>
          {pendentes.map(renderItem)}
          {pagos.length > 0 && (
            <>
              <button
                style={styles.pagosHead}
                onClick={() => setPagosExpandido((v) => !v)}
              >
                {pagosExpandido ? (
                  <ChevronDown size={15} />
                ) : (
                  <ChevronRight size={15} />
                )}
                {pagos.length} {pagos.length === 1 ? "conta paga" : "contas pagas"}
              </button>
              {pagosExpandido && (
                <div style={styles.lista}>{pagos.map(renderItemPago)}</div>
              )}
            </>
          )}
        </div>
      )}

      {modalItem && lista && (
        <ModalItem
          itemParaEditar={modalItem === "novo" ? undefined : modalItem}
          vencimentoInicial={vencimentoPadrao(mes, ano)}
          onFechar={() => setModalItem(null)}
          onSalvar={salvarItem}
        />
      )}

      {modalColar && lista && (
        <ModalColarLista
          ano={ano}
          vencimentoPadrao={vencimentoPadrao(mes, ano)}
          onFechar={() => setModalColar(false)}
          onSalvar={salvarLote}
        />
      )}

      {modalNovaPilha && (
        <ModalNomeGrupo
          titulo="Nova lista"
          textoBotao="Criar lista"
          onFechar={() => setModalNovaPilha(false)}
          onSalvar={novaPilha}
        />
      )}

      {modalRenomear && grupo && (
        <ModalNomeGrupo
          titulo="Renomear lista"
          nomeInicial={grupo.nome}
          textoBotao="Salvar nome"
          onFechar={() => setModalRenomear(false)}
          onSalvar={renomear}
        />
      )}

      {modalPassarPosse && grupo && (
        <ModalPassarPosse
          grupoId={grupo.id}
          grupoNome={grupo.nome}
          meuUserId={session.user.id}
          onFechar={() => setModalPassarPosse(false)}
          onConfirmar={passarPosse}
        />
      )}

      {confirmExcluir && grupo && (
        <ConfirmModal
          titulo={`Excluir "${grupo.nome}"?`}
          mensagem={
            (confirmExcluir.contas === 0
              ? "Esta lista está vazia. Nada será perdido."
              : `Isso apaga ${confirmExcluir.meses} ${confirmExcluir.meses === 1 ? "mês" : "meses"} e ${confirmExcluir.contas} ${confirmExcluir.contas === 1 ? "conta" : "contas"}. ` +
                "O histórico não volta. Se é só para tirar da frente, prefira arquivar.") +
            // Quem mais perde a lista some da tela sem aviso; o mínimo é o
            // dono saber o nome de quem está afetando.
            (afetados.length > 0
              ? ` ${afetados.join(", ")} ${afetados.length === 1 ? "perde" : "perdem"} o acesso na hora.`
              : "")
          }
          textoConfirmar="Excluir mesmo assim"
          textoCancelar="Cancelar"
          onConfirmar={confirmarExclusaoDaPilha}
          onCancelar={() => setConfirmExcluir(null)}
        />
      )}

      {modalCompartilhar && grupo && (
        <ModalCompartilhar
          grupo={grupo}
          ehDono={!!ehDono}
          meuUserId={session.user.id}
          onFechar={() => setModalCompartilhar(false)}
          onMudanca={() => {
            carregarPilhas().catch((e) => {
            console.error(e);
            setFalhaAoAtualizar(true);
          });
            carregar();
          }}
          onAviso={avisar}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          titulo="Excluir conta"
          mensagem={`Excluir "${confirmDelete.descricao}"? Isso vale para todo mundo que enxerga ${grupo?.nome ?? "esta lista"}.`}
          textoConfirmar="Excluir"
          textoCancelar="Cancelar"
          onConfirmar={confirmarExclusao}
          onCancelar={() => setConfirmDelete(null)}
        />
      )}

      {toastPagamento && (
        <div style={styles.toastPagamento} role="status">
          <p style={styles.toastPagamentoTitulo}>
            <Check size={15} color="var(--green)" strokeWidth={3} />
            {toastPagamento.descricao} marcada como paga
          </p>
          <p style={styles.toastPagamentoPergunta}>
            Lançar − {brl(toastPagamento.valor)} como saída no seu financeiro?
          </p>
          <div style={styles.toastPagamentoAcoes}>
            <button
              style={styles.toastNao}
              onClick={() => setToastPagamento(null)}
            >
              Agora não
            </button>
            <button
              style={styles.toastSim}
              onClick={() => {
                onNovoLancamento?.(toastPagamento);
                setToastPagamento(null);
              }}
            >
              Sim, lançar
            </button>
          </div>
        </div>
      )}

      {toast && <Toast toast={toast} onFechar={() => setToast(null)} />}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  painel: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 22,
    boxShadow: "var(--shadow)",
  },
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
    // Com dois botões nomeados, no celular a linha estoura — deixar quebrar é
    // melhor do que espremer o título ou voltar ao ícone sem legenda.
    flexWrap: "wrap",
  },
  titulo: { fontSize: 16, fontWeight: 600 },
  subtitulo: { fontSize: 13, color: "var(--text-faint)", marginTop: 2 },
  headAcoes: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  pessoas: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    color: "var(--text-soft)",
    padding: "8px 11px",
    borderRadius: 11,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  adicionar: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    padding: "9px 16px",
    borderRadius: 11,
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  seletorLinha: {
    display: "flex",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 14,
    minWidth: 0,
  },
  seletor: {
    // Uma linha que rola na horizontal. O grid anterior quebrava as pilhas em
    // várias linhas no celular e desalinhava os ícones de ação ao lado.
    display: "flex",
    flexWrap: "nowrap",
    overflowX: "auto",
    gap: 4,
    background: "var(--bg)",
    padding: 4,
    borderRadius: 10,
    flex: 1,
    minWidth: 0,
  },
  seletorAcoes: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  iconeSeletor: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    border: "none",
    borderRadius: 8,
    background: "transparent",
    color: "var(--text-faint)",
    cursor: "pointer",
  },
  seletorBtnArquivado: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontStyle: "italic",
  },
  seletorBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: "6px 8px",
    border: "none",
    borderRadius: 7,
    background: "transparent",
    color: "var(--text-faint)",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
    // Não encolhe: numa faixa que rola, espremer as abas para caber é o que
    // fazia o nome virar reticências antes de a rolagem entrar em ação.
    flexShrink: 0,
    maxWidth: 160,
  },
  seletorBtnNome: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  seletorBtnAtivo: {
    background: "var(--surface)",
    color: "var(--text)",
    boxShadow: "var(--shadow)",
  },
  resumo: { marginBottom: 18, textAlign: "center" },
  resumoRotulo: {
    fontSize: 12,
    color: "var(--text-faint)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  resumoTotal: {
    fontFamily: "'Sora', sans-serif",
    fontSize: 30,
    fontWeight: 700,
    color: "var(--text)",
    marginBottom: 10,
    lineHeight: 1.15,
  },
  colar: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 14px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    color: "var(--text-soft)",
    borderRadius: 11,
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  barra: {
    height: 8,
    background: "var(--bg)",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 7,
  },
  barraCheia: {
    height: "100%",
    background: "var(--green)",
    borderRadius: 999,
    transition: "width 0.3s ease",
  },
  resumoTexto: { fontSize: 12.5, color: "var(--text-soft)" },
  lista: { display: "flex", flexDirection: "column", gap: 8 },
  item: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    background: "var(--surface)",
    boxShadow: "var(--shadow)",
    padding: "14px 16px",
    borderRadius: 12,
    minWidth: 0,
  },
  itemPago: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    background: "var(--bg)",
    padding: "12px 16px",
    borderRadius: 12,
    opacity: 0.6,
    minWidth: 0,
  },
  check: {
    background: "none",
    border: "none",
    padding: 0,
    marginTop: 2,
    display: "flex",
    cursor: "pointer",
    flexShrink: 0,
  },
  checkVazio: {
    width: 18,
    height: 18,
    borderRadius: 6,
    border: "2px solid var(--border)",
    display: "block",
  },
  checkMarcado: {
    width: 18,
    height: 18,
    borderRadius: 6,
    background: "var(--green)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  itemCorpo: { flex: 1, minWidth: 0 },
  itemLinha: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  descricao: {
    fontSize: 14.5,
    fontWeight: 600,
    color: "var(--text)",
    lineHeight: 1.3,
    flex: 1,
    minWidth: 0,
    wordBreak: "normal",
    overflowWrap: "normal",
  },
  valor: {
    fontFamily: "'Sora', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    color: "var(--red)",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  valorPago: {
    fontFamily: "'Sora', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-faint)",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  itemMeta: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    fontSize: 12.5,
    color: "var(--text-faint)",
    marginTop: 3,
  },
  itemMetaPago: { fontSize: 11, color: "var(--text-faint)", marginTop: 3 },
  badgeVencido: {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    background: "var(--red-soft)",
    color: "var(--red)",
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: 5,
  },
  sep: { color: "var(--text-faint)" },
  acoes: { display: "flex", alignItems: "center", gap: 2, flexShrink: 0 },
  acao: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
    padding: 4,
    cursor: "pointer",
  },
  pagosHead: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "none",
    border: "none",
    color: "var(--text-soft)",
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 2px",
    cursor: "pointer",
    textAlign: "left",
    alignSelf: "flex-start",
  },
  erroBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    padding: "30px 16px",
    gap: 10,
  },
  erroIcone: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: "var(--red-soft)",
    color: "var(--red)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  erroTexto: { fontSize: 14, color: "var(--text-soft)", fontWeight: 500 },
  retry: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    padding: "8px 14px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    marginTop: 4,
    cursor: "pointer",
  },
  toastPagamento: {
    position: "fixed",
    bottom: 80,
    left: "50%",
    transform: "translateX(-50%)",
    width: "calc(100vw - 32px)",
    maxWidth: 400,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: "14px 16px",
    boxShadow: "0 12px 40px rgba(16,24,40,0.18)",
    zIndex: 100,
    animation: "fadeUp 0.22s ease-out",
  },
  toastPagamentoTitulo: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: 4,
  },
  toastPagamentoPergunta: {
    fontSize: 13.5,
    color: "var(--text-soft)",
    marginBottom: 12,
  },
  toastPagamentoAcoes: { display: "flex", gap: 8 },
  toastNao: {
    flex: 1,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    padding: 10,
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
  },
  toastSim: {
    flex: 1,
    background: "var(--accent)",
    border: "none",
    color: "#fff",
    padding: 10,
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
  },
};
