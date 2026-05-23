import { useState } from "react";
import { X } from "lucide-react";
import { CATEGORIAS } from "../types";
import type { NovoLancamento, Tipo } from "../types";

interface Props {
  mes: number;
  ano: number;
  onFechar: () => void;
  onSalvar: (item: NovoLancamento) => void;
}

export default function ModalNovo({ mes, ano, onFechar, onSalvar }: Props) {
  const [tipo, setTipo] = useState<Tipo>("saida");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS[0].nome);

  function submit() {
    const v = parseFloat(valor.replace(",", "."));
    if (!v || v <= 0) return;
    onSalvar({
      tipo,
      valor: v,
      descricao,
      categoria: tipo === "entrada" ? "Entrada" : categoria,
      mes,
      ano,
    });
  }

  return (
    <div style={styles.overlay} onClick={onFechar}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.head}>
          <h3 style={styles.titulo}>Novo lançamento</h3>
          <button style={styles.fechar} onClick={onFechar}>
            <X size={18} />
          </button>
        </div>

        <div style={styles.toggle}>
          {(["saida", "entrada"] as Tipo[]).map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              style={{
                ...styles.toggleBtn,
                ...(tipo === t
                  ? {
                      background:
                        t === "entrada" ? "var(--green)" : "var(--red)",
                      color: "#fff",
                    }
                  : {}),
              }}
            >
              {t === "entrada" ? "Entrada" : "Saída"}
            </button>
          ))}
        </div>

        <label style={styles.lbl}>Valor (R$)</label>
        <input
          style={styles.input}
          value={valor}
          inputMode="decimal"
          placeholder="0,00"
          autoFocus
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />

        <label style={styles.lbl}>Descrição</label>
        <input
          style={styles.input}
          value={descricao}
          placeholder="ex: almoço no RU"
          onChange={(e) => setDescricao(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />

        {tipo === "saida" && (
          <>
            <label style={styles.lbl}>Categoria</label>
            <select
              style={styles.input}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              {CATEGORIAS.map((c) => (
                <option key={c.nome}>{c.nome}</option>
              ))}
            </select>
          </>
        )}

        <button style={styles.salvar} onClick={submit}>
          Salvar lançamento
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
    zIndex: 50,
  },
  modal: {
    background: "var(--surface)",
    borderRadius: 20,
    padding: 26,
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 20px 60px rgba(16,24,40,0.18)",
    animation: "fadeUp 0.25s ease",
  },
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  titulo: { fontSize: 19, fontWeight: 700 },
  fechar: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
  },
  toggle: {
    display: "flex",
    gap: 6,
    marginBottom: 18,
    background: "var(--bg)",
    padding: 4,
    borderRadius: 12,
  },
  toggleBtn: {
    flex: 1,
    padding: 10,
    border: "none",
    borderRadius: 9,
    background: "transparent",
    color: "var(--text-soft)",
    fontWeight: 600,
    fontSize: 14,
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
    marginBottom: 14,
    outline: "none",
  },
  salvar: {
    width: "100%",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    padding: 13,
    borderRadius: 12,
    fontWeight: 600,
    fontSize: 15,
    marginTop: 4,
  },
};
