import { AlertTriangle } from "lucide-react";

interface Props {
  titulo: string;
  mensagem: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export default function ConfirmModal({
  titulo,
  mensagem,
  textoConfirmar = "Excluir",
  textoCancelar = "Cancelar",
  onConfirmar,
  onCancelar,
}: Props) {
  return (
    <div style={styles.overlay} onClick={onCancelar}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.iconWrap}>
          <AlertTriangle size={22} color="var(--red)" strokeWidth={2.2} />
        </div>
        <h3 style={styles.titulo}>{titulo}</h3>
        <p style={styles.mensagem}>{mensagem}</p>
        <div style={styles.acoes}>
          <button style={styles.cancelar} onClick={onCancelar}>
            {textoCancelar}
          </button>
          <button style={styles.confirmar} onClick={onConfirmar}>
            {textoConfirmar}
          </button>
        </div>
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
    zIndex: 60,
  },
  modal: {
    background: "var(--surface)",
    borderRadius: 20,
    padding: 26,
    width: "100%",
    maxWidth: 380,
    boxShadow: "0 20px 60px rgba(16,24,40,0.18)",
    animation: "fadeUp 0.25s ease",
    textAlign: "center",
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: "var(--red-soft)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 14px",
  },
  titulo: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 8,
    color: "var(--text)",
  },
  mensagem: {
    fontSize: 14,
    color: "var(--text-soft)",
    lineHeight: 1.5,
    marginBottom: 22,
  },
  acoes: {
    display: "flex",
    gap: 10,
  },
  cancelar: {
    flex: 1,
    background: "var(--bg)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    padding: 12,
    borderRadius: 12,
    fontWeight: 600,
    fontSize: 14,
  },
  confirmar: {
    flex: 1,
    background: "var(--red)",
    color: "#fff",
    border: "none",
    padding: 12,
    borderRadius: 12,
    fontWeight: 600,
    fontSize: 14,
  },
};
