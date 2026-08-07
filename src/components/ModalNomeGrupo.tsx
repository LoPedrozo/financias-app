import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  titulo: string;
  nomeInicial?: string;
  textoBotao: string;
  onFechar: () => void;
  onSalvar: (nome: string) => Promise<void> | void;
}

// Usado tanto para criar quanto para renomear uma pilha. O nome é o que
// distingue "Contas da mãe" de "Contas da esposa" na hora de escolher a lista
// e, principalmente, na hora de mandar o link certo para a pessoa certa.
export default function ModalNomeGrupo({
  titulo,
  nomeInicial = "",
  textoBotao,
  onFechar,
  onSalvar,
}: Props) {
  const [nome, setNome] = useState(nomeInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function submit() {
    if (salvando) return;
    if (nome.trim().length < 2) {
      setErro("Dê um nome com pelo menos 2 letras.");
      return;
    }
    setSalvando(true);
    try {
      await onSalvar(nome.trim());
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
          <h3 style={styles.titulo}>{titulo}</h3>
          <button style={styles.fechar} onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <label htmlFor="grupo-nome" style={styles.lbl}>
          Nome da lista
        </label>
        <input
          id="grupo-nome"
          maxLength={60}
          autoFocus
          style={{
            ...styles.input,
            borderColor: erro ? "var(--red)" : "var(--border)",
          }}
          value={nome}
          placeholder="ex: Contas da mãe"
          onChange={(e) => {
            setNome(e.target.value);
            if (erro) setErro(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {erro && <p style={styles.erro}>{erro}</p>}

        <button
          style={{ ...styles.salvar, opacity: salvando ? 0.7 : 1 }}
          onClick={submit}
          disabled={salvando}
        >
          {salvando ? "Salvando..." : textoBotao}
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
    marginBottom: 18,
  },
  titulo: { fontSize: 19, fontWeight: 700 },
  fechar: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
  },
  lbl: {
    fontSize: 13,
    color: "var(--text-soft)",
    marginBottom: 6,
    display: "block",
  },
  input: {
    width: "100%",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 11,
    padding: "11px 14px",
    color: "var(--text)",
    fontSize: 15,
    outline: "none",
  },
  erro: { fontSize: 12.5, color: "var(--red)", marginTop: 6 },
  salvar: {
    width: "100%",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    padding: 13,
    borderRadius: 12,
    fontWeight: 600,
    fontSize: 15,
    marginTop: 16,
    cursor: "pointer",
  },
};
