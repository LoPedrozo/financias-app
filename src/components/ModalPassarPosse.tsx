import { useEffect, useState } from "react";
import { X, Crown } from "lucide-react";
import type { MembroGrupo } from "../types";
import { listarMembros } from "../lib/listas";
import { traduzirErro } from "../lib/mensagens";

interface Props {
  grupoId: string;
  grupoNome: string;
  meuUserId: string;
  onFechar: () => void;
  onConfirmar: (novoDonoId: string) => Promise<void> | void;
}

// Existe para desatar um nó: quem cria uma pilha compartilhada não consegue
// sair dela. Sem passar a posse, a única saída seria excluir — levando o
// histórico da outra pessoa junto.
export default function ModalPassarPosse({
  grupoId,
  grupoNome,
  meuUserId,
  onFechar,
  onConfirmar,
}: Props) {
  const [membros, setMembros] = useState<MembroGrupo[]>([]);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listarMembros(grupoId)
      .then((todos) => setMembros(todos.filter((m) => m.user_id !== meuUserId)))
      .catch((e) => {
        console.error(e);
        setErro(traduzirErro(e));
      })
      .finally(() => setCarregando(false));
  }, [grupoId, meuUserId]);

  async function confirmar() {
    if (!escolhido || salvando) return;
    setSalvando(true);
    try {
      await onConfirmar(escolhido);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={styles.overlay} data-modal onClick={onFechar}>
      <div
        style={styles.modal}
        className="modal-mobile"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.head}>
          <h3 style={styles.titulo}>Passar a posse</h3>
          <button style={styles.fechar} onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <p style={styles.explicacao}>
          Quem receber vira dono de <strong>{grupoNome}</strong> e passa a poder
          convidar, renomear e excluir. Você continua na lista como participante
          — e aí pode sair quando quiser, sem perder o histórico de ninguém.
        </p>

        {carregando ? (
          <p style={styles.vazio}>Carregando...</p>
        ) : erro ? (
          <p style={styles.erro}>{erro}</p>
        ) : membros.length === 0 ? (
          <p style={styles.vazio}>
            Não há mais ninguém nesta lista. Convide alguém antes de passar a
            posse.
          </p>
        ) : (
          <div style={styles.lista}>
            {membros.map((m) => (
              <button
                key={m.id}
                onClick={() => setEscolhido(m.user_id)}
                style={{
                  ...styles.opcao,
                  borderColor:
                    escolhido === m.user_id ? "var(--accent)" : "var(--border)",
                  background:
                    escolhido === m.user_id ? "var(--accent-soft)" : "var(--bg)",
                }}
              >
                <span style={styles.avatar}>
                  {(m.email ?? "?").charAt(0).toUpperCase()}
                </span>
                <span style={styles.email}>{m.email ?? "Participante"}</span>
                {escolhido === m.user_id && (
                  <Crown size={15} color="var(--accent)" />
                )}
              </button>
            ))}
          </div>
        )}

        <button
          style={{
            ...styles.confirmar,
            opacity: !escolhido || salvando ? 0.5 : 1,
            cursor: !escolhido || salvando ? "not-allowed" : "pointer",
          }}
          onClick={confirmar}
          disabled={!escolhido || salvando}
        >
          {salvando ? "Passando..." : "Passar a posse"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(16, 24, 40, 0.35)",
    backdropFilter: "blur(3px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 58,
  },
  modal: {
    background: "var(--surface)",
    borderRadius: 20,
    padding: 26,
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 20px 60px rgba(16,24,40,0.18)",
    animation: "fadeUp 0.25s ease",
  },
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  titulo: { fontSize: 19, fontWeight: 700 },
  fechar: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
  },
  explicacao: {
    fontSize: 13.5,
    color: "var(--text-soft)",
    lineHeight: 1.5,
    marginBottom: 16,
  },
  lista: { display: "flex", flexDirection: "column", gap: 8 },
  opcao: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "11px 12px",
    borderRadius: 11,
    border: "1.5px solid var(--border)",
    cursor: "pointer",
    minWidth: 0,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "var(--surface)",
    color: "var(--accent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12.5,
    fontWeight: 700,
    flexShrink: 0,
  },
  email: {
    flex: 1,
    fontSize: 13.5,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "left",
    minWidth: 0,
  },
  vazio: { fontSize: 13.5, color: "var(--text-faint)", lineHeight: 1.5 },
  erro: { fontSize: 13.5, color: "var(--red)" },
  confirmar: {
    width: "100%",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    padding: 13,
    borderRadius: 12,
    fontWeight: 600,
    fontSize: 15,
    marginTop: 18,
  },
};
