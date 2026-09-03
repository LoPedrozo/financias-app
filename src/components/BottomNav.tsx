import { Home, Plus, Receipt } from "lucide-react";

interface Props {
  abaAtiva: "inicio" | "contas";
  onNavegar: (aba: "inicio" | "contas") => void;
  onNovo: () => void;
  // Com a feature de contas desligada sobra só Início: no lugar da segunda aba
  // entra um vão do mesmo tamanho, para o botão de novo lançamento continuar
  // centralizado na barra.
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

      {mostrarContas ? (
        <button
          style={{ ...styles.tab, color: corContas }}
          onClick={() => onNavegar("contas")}
          aria-label="Contas a pagar"
          aria-current={abaAtiva === "contas" ? "page" : undefined}
        >
          <Receipt size={22} strokeWidth={2} />
          <span style={styles.label}>Contas</span>
        </button>
      ) : (
        <div style={styles.vao} aria-hidden="true" />
      )}
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
  vao: {
    flex: 1,
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
};
