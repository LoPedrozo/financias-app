import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MESES } from "../types";

interface Props {
  mes: number; // 0-11
  ano: number;
  onChange: (mes: number, ano: number) => void;
}

export default function MonthPicker({ mes, ano, onChange }: Props) {
  const [aberto, setAberto] = useState(false);
  // Ano "navegável" dentro do picker — pode divergir do ano selecionado
  // enquanto o usuário escolhe um mês.
  const [anoPicker, setAnoPicker] = useState(ano);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ao abrir, sempre re-sincroniza o anoPicker com o ano externo.
  useEffect(() => {
    if (aberto) setAnoPicker(ano);
  }, [aberto, ano]);

  // Fecha ao clicar fora do componente.
  useEffect(() => {
    if (!aberto) return;
    function onMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [aberto]);

  function anterior() {
    if (mes === 0) onChange(11, ano - 1);
    else onChange(mes - 1, ano);
  }

  function proximo() {
    if (mes === 11) onChange(0, ano + 1);
    else onChange(mes + 1, ano);
  }

  function selecionarMes(novoMes: number) {
    onChange(novoMes, anoPicker);
    setAberto(false);
  }

  return (
    <div ref={containerRef} style={styles.container} className="month-picker">
      <button
        type="button"
        className="mp-seta"
        style={styles.seta}
        onClick={anterior}
        aria-label="Mês anterior"
      >
        <ChevronLeft size={16} />
      </button>

      <button
        type="button"
        style={styles.texto}
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
      >
        {MESES[mes]} {ano}
      </button>

      <button
        type="button"
        className="mp-seta"
        style={styles.seta}
        onClick={proximo}
        aria-label="Próximo mês"
      >
        <ChevronRight size={16} />
      </button>

      {aberto && (
        <div
          style={styles.picker}
          className="month-picker-popover"
          role="dialog"
          aria-label="Selecionar mês e ano"
        >
          <div style={styles.pickerHeader}>
            <button
              type="button"
              className="mp-seta"
              style={styles.seta}
              onClick={() => setAnoPicker((y) => y - 1)}
              aria-label="Ano anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={styles.anoLabel}>{anoPicker}</span>
            <button
              type="button"
              className="mp-seta"
              style={styles.seta}
              onClick={() => setAnoPicker((y) => y + 1)}
              aria-label="Próximo ano"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div style={styles.grid}>
            {MESES.map((nome, i) => {
              const selecionado = i === mes && anoPicker === ano;
              return (
                <button
                  key={nome}
                  type="button"
                  className={
                    "mp-cell" + (selecionado ? " mp-cell-selected" : "")
                  }
                  style={{
                    ...styles.cell,
                    ...(selecionado ? styles.cellSelected : {}),
                  }}
                  onClick={() => selecionarMes(i)}
                  aria-pressed={selecionado}
                >
                  {nome.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "4px 6px",
  },
  seta: {
    background: "transparent",
    border: "none",
    color: "var(--text-faint)",
    padding: 6,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  texto: {
    background: "transparent",
    border: "none",
    color: "var(--text)",
    fontSize: 14,
    fontWeight: 600,
    padding: "4px 12px",
    cursor: "pointer",
    minWidth: 120,
    textAlign: "center",
  },
  picker: {
    position: "absolute",
    top: "calc(100% + 8px)",
    left: 0,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    boxShadow: "0 20px 60px rgba(16,24,40,0.18)",
    padding: 14,
    minWidth: 240,
    zIndex: 100,
    animation: "fadeUp 0.22s ease-out",
  },
  pickerHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  anoLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--text)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 6,
  },
  cell: {
    padding: "8px 0",
    border: "none",
    borderRadius: 8,
    background: "transparent",
    color: "var(--text-soft)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s ease, color 0.15s ease",
  },
  cellSelected: {
    background: "var(--accent)",
    color: "#fff",
  },
};
