import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Pause, Play, Repeat } from "lucide-react";
import type { NovaRecorrencia, Recorrencia } from "../types";
import {
  atualizarRecorrencia,
  criarRecorrencia,
  deletarRecorrencia,
  listarRecorrencias,
  toggleRecorrencia,
} from "../lib/recorrencias";
import { brl } from "../lib/format";
import ModalRecorrencia from "./ModalRecorrencia";
import ConfirmModal from "./ConfirmModal";
import Toast, { type ToastDados } from "./Toast";
import EmptyState from "./EmptyState";
import { SkeletonLista } from "./Skeleton";

const DIAS_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

function textoFrequencia(r: Recorrencia): string {
  if (r.frequencia === "semanal" && r.dia_semana != null) {
    return `todo ${DIAS_SEMANA[r.dia_semana]}`;
  }
  if (r.frequencia === "mensal" && r.dia_mes != null) {
    return `todo dia ${r.dia_mes}`;
  }
  return "";
}

interface Props {
  onMudanca?: () => void;
}

export default function Recorrencias({ onMudanca }: Props) {
  const [itens, setItens] = useState<Recorrencia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Recorrencia | null>(null);
  const [confirmarId, setConfirmarId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastDados | null>(null);

  const mostrarToast = useCallback(
    (tipo: ToastDados["tipo"], mensagem: string) => {
      setToast({ id: Date.now(), tipo, mensagem });
    },
    []
  );

  const carregar = useCallback(() => {
    setCarregando(true);
    listarRecorrencias()
      .then(setItens)
      .catch((e) => {
        console.error(e);
        mostrarToast("erro", "Não foi possível carregar as recorrências.");
      })
      .finally(() => setCarregando(false));
  }, [mostrarToast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const ordenados = useMemo(() => {
    return itens.slice().sort((a, b) => {
      if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [itens]);

  async function criar(dados: NovaRecorrencia) {
    try {
      const novo = await criarRecorrencia(dados);
      setItens((atual) => [novo, ...atual]);
      setModal(false);
      mostrarToast("sucesso", "Recorrência criada!");
      onMudanca?.();
    } catch (e) {
      console.error(e);
      mostrarToast("erro", "Não foi possível salvar. Verifique sua conexão.");
    }
  }

  async function editar(dados: NovaRecorrencia) {
    if (!editando) return;
    const original = editando;
    try {
      const atualizada = await atualizarRecorrencia(original.id, dados);
      setItens((atual) =>
        atual.map((r) => (r.id === atualizada.id ? atualizada : r))
      );
      setEditando(null);
      mostrarToast("sucesso", "Recorrência atualizada!");
      onMudanca?.();
    } catch (e) {
      console.error(e);
      mostrarToast("erro", "Não foi possível salvar. Verifique sua conexão.");
    }
  }

  async function alternarAtivo(r: Recorrencia) {
    const novoAtivo = !r.ativo;
    setItens((atual) =>
      atual.map((x) => (x.id === r.id ? { ...x, ativo: novoAtivo } : x))
    );
    try {
      await toggleRecorrencia(r.id, novoAtivo);
      mostrarToast(
        "sucesso",
        novoAtivo ? "Recorrência ativada." : "Recorrência pausada."
      );
      onMudanca?.();
    } catch (e) {
      console.error(e);
      setItens((atual) =>
        atual.map((x) => (x.id === r.id ? { ...x, ativo: r.ativo } : x))
      );
      mostrarToast("erro", "Não foi possível atualizar. Tente novamente.");
    }
  }

  async function confirmarDelecao() {
    if (!confirmarId) return;
    const id = confirmarId;
    setConfirmarId(null);
    const anterior = itens;
    setItens((atual) => atual.filter((r) => r.id !== id));
    try {
      await deletarRecorrencia(id);
      mostrarToast("sucesso", "Recorrência excluída.");
      onMudanca?.();
    } catch (e) {
      console.error(e);
      setItens(anterior);
      mostrarToast("erro", "Não foi possível excluir. Verifique sua conexão.");
    }
  }

  return (
    <div style={styles.panel} className="panel-mobile">
      <div style={styles.head}>
        <h2 style={styles.titulo}>Recorrências</h2>
        <button style={styles.add} onClick={() => setModal(true)}>
          <Plus size={16} /> Nova
        </button>
      </div>

      {carregando ? (
        <SkeletonLista linhas={3} />
      ) : ordenados.length === 0 ? (
        <EmptyState
          icon={<Repeat size={24} />}
          titulo="Nenhuma recorrência cadastrada"
          sugestao="Clique em '+ Nova' para começar"
        />
      ) : (
        <div style={styles.list}>
          {ordenados.map((r) => {
            const corValor =
              r.tipo === "entrada" ? "var(--green)" : "var(--red)";
            const bolinha = r.ativo ? "var(--green)" : "var(--text-faint)";
            const itemStyle: React.CSSProperties = {
              ...styles.item,
              opacity: r.ativo ? 1 : 0.55,
            };
            return (
              <div key={r.id} style={itemStyle}>
                <div style={styles.itemInfo}>
                  <div style={styles.linhaTopo}>
                    <span
                      style={{ ...styles.bolinha, background: bolinha }}
                      aria-hidden
                    />
                    <span style={styles.descricao}>{r.descricao}</span>
                  </div>
                  <div style={styles.linhaMeta}>
                    <span style={{ ...styles.valor, color: corValor }}>
                      {r.tipo === "entrada" ? "+ " : "− "}
                      {brl(r.valor)}
                    </span>
                    <span style={styles.sep}>·</span>
                    <span style={styles.freq}>{textoFrequencia(r)}</span>
                  </div>
                  <div style={styles.linhaSub}>
                    <span>{r.categoria}</span>
                    <span style={styles.sep}>·</span>
                    <span>{r.ativo ? "Ativo" : "Pausado"}</span>
                  </div>
                </div>
                <div style={styles.acoes}>
                  <button
                    style={styles.acao}
                    onClick={() => alternarAtivo(r)}
                    aria-label={r.ativo ? "Pausar" : "Ativar"}
                    title={r.ativo ? "Pausar" : "Ativar"}
                  >
                    {r.ativo ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button
                    style={styles.acao}
                    onClick={() => setEditando(r)}
                    aria-label="Editar recorrência"
                    title="Editar"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    style={styles.acao}
                    onClick={() => setConfirmarId(r.id)}
                    aria-label="Excluir recorrência"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <ModalRecorrencia
          onFechar={() => setModal(false)}
          onSalvar={criar}
        />
      )}

      {editando && (
        <ModalRecorrencia
          recorrenciaParaEditar={editando}
          onFechar={() => setEditando(null)}
          onSalvar={editar}
        />
      )}

      {confirmarId && (
        <ConfirmModal
          titulo="Excluir recorrência"
          mensagem="Excluir esta recorrência? Os lançamentos futuros gerados por ela serão removidos. Os já contabilizados serão preservados no histórico."
          textoConfirmar="Excluir"
          textoCancelar="Cancelar"
          onConfirmar={confirmarDelecao}
          onCancelar={() => setConfirmarId(null)}
        />
      )}

      {toast && <Toast toast={toast} onFechar={() => setToast(null)} />}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 22,
    boxShadow: "var(--shadow)",
  },
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  titulo: { fontSize: 16, fontWeight: 600 },
  add: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    padding: "9px 16px",
    borderRadius: 11,
    fontWeight: 600,
    fontSize: 14,
  },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  item: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    background: "var(--bg)",
    padding: "12px 14px",
    borderRadius: 12,
    minWidth: 0,
  },
  itemInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    minWidth: 0,
    flex: 1,
  },
  linhaTopo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  bolinha: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  descricao: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  linhaMeta: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    color: "var(--text-soft)",
    flexWrap: "wrap",
  },
  valor: {
    fontFamily: "'Sora', sans-serif",
    fontWeight: 600,
  },
  freq: { color: "var(--text-soft)" },
  sep: { color: "var(--text-faint)" },
  linhaSub: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "var(--text-faint)",
    flexWrap: "wrap",
  },
  acoes: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  acao: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
    padding: 6,
    cursor: "pointer",
  },
};
