import { Home, Plus, Receipt } from "lucide-react";

interface Props {
  abaAtiva: "inicio" | "contas";
  onNavegar: (aba: "inicio" | "contas") => void;
  onNovo: () => void;
  // Com a feature de contas desligada não há para onde navegar: a barra fica
  // só com o botão de novo lançamento, centralizado. A volta das Recorrências
  // continua pela seta do próprio cabeçalho daquela tela.
  mostrarContas?: boolean;
}

export default function BottomNav({
  abaAtiva,
  onNavegar,
  onNovo,
  mostrarContas = true,
}: Props) {
  const corInicio = abaAtiva === "inicio" ? "var(--accent)" : "var(--text-faint)";
  const corContas = abaAtiva === "contas" ? "var(--accent)" : "var(--text-faint)";

  if (!mostrarContas) {
    return (
      <nav
        style={{ ...styles.nav, justifyContent: "center" }}
        className="bottom-nav"
        aria-label="Ações"
      >
        <button
          style={{ ...styles.fab, ...styles.fabSozinho }}
          onClick={onNovo}
          aria-label="Novo lançamento"
        >
          <Plus size={28} strokeWidth={2.4} />
        </button>
      </nav>
    );
  }

  return (
    <nav style={styles.nav} className="bottom-nav" aria-label="Navegação principal">
      <button
        style={{ ...styles.tab, color: corInicio }}
        onClick={() => onNavegar("inicio")}
        aria-label="Início"
        aria-current={abaAtiva === "inicio" ? "page" : undefined}
      >
        <Home size={22} strokeWidth={2} />
        <span style={styles.label}>Início</span>
      </button>

      <button
        style={styles.fab}
        onClick={onNovo}
        aria-label="Novo lançamento"
      >
        <Plus size={26} strokeWidth={2.4} />
      </button>

      <button
        style={{ ...styles.tab, color: corContas }}
        onClick={() => onNavegar("contas")}
        aria-label="Contas a pagar"
        aria-current={abaAtiva === "contas" ? "page" : undefined}
      >
        <Receipt size={22} strokeWidth={2} />
        <span style={styles.label}>Contas</span>
      </button>
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    paddingBottom: "env(safe-area-inset-bottom)",
    background: "var(--surface)",
    borderTop: "1px solid var(--border)",
    zIndex: 50,
    alignItems: "center",
    justifyContent: "space-around",
  },
  tab: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    background: "none",
    border: "none",
    padding: 6,
    height: "100%",
  },
  label: {
    fontSize: 10,
    fontWeight: 600,
  },
  fab: {
    flex: "0 0 auto",
    width: 52,
    height: 52,
    borderRadius: "50%",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 14px rgba(201, 168, 106, 0.4), 0 2px 4px rgba(0, 0, 0, 0.08)",
    marginBottom: 8,
  },
  // Sozinho no centro o botão vira o único elemento da barra: um pouco maior
  // para não parecer perdido, e sem o deslocamento que existia para alinhar
  // com o rótulo das abas ao lado.
  fabSozinho: {
    width: 58,
    height: 58,
    marginBottom: 0,
  },
};
