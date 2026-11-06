import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MESES } from "../types";

// Seletor de mês em carrossel.
//
// O mês da tela fica no meio, grande; os vizinhos aparecem dos dois lados e
// somem nas bordas. É o desenho do gesto que já existia — deslizar o dedo
// troca de mês — posto à vista: dá para ver que há um mês de cada lado.
// Tocar num vizinho vai até ele; tocar no do meio abre a grade com os doze
// meses e o ano, para saltos longos.
//
// Só abreviações, em caixa alta (OUT NOV DEZ), como os rótulos do resumo do
// mês. O ano não fica aqui: está na data do topo. A exceção é quando o mês da
// tela é de outro ano — aí o ano aparece no lugar do pontinho do meio, senão
// "JAN" de 2027 seria indistinguível de "JAN" deste ano.
//
// Os vizinhos imediatos se chamam "Mês anterior" e "Próximo mês" para leitor
// de tela (e para os testes, que navegam por eles); o nome do mês aparece no
// title.

interface Props {
  mes: number; // 0-11
  ano: number;
  onChange: (mes: number, ano: number) => void;
}

// Mês relativo: deslocar(10, 2026, 3) = { mes: 1, ano: 2027 }.
function deslocar(mes: number, ano: number, passos: number) {
  const total = ano * 12 + mes + passos;
  return { mes: ((total % 12) + 12) % 12, ano: Math.floor(total / 12) };
}

// "Nov": a caixa alta vem do CSS — leitor de tela lê "Nov", não soletra.
const abrev = (m: number) => MESES[m].slice(0, 3);

export default function MonthPicker({ mes, ano, onChange }: Props) {
  const [aberto, setAberto] = useState(false);
  const anoDeHoje = new Date().getFullYear();
  // Ano "navegável" dentro da grade — pode divergir do ano selecionado
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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [aberto]);

  function ir(passos: number) {
    const alvo = deslocar(mes, ano, passos);
    onChange(alvo.mes, alvo.ano);
  }

  function selecionarMes(novoMes: number) {
    onChange(novoMes, anoPicker);
    setAberto(false);
  }

  function vizinho(passos: number) {
    const alvo = deslocar(mes, ano, passos);
    const imediato = Math.abs(passos) === 1;
    const nome = `${MESES[alvo.mes]} de ${alvo.ano}`;
    return (
      <button
        key={passos}
        type="button"
        className={"mp-vizinho" + (imediato ? "" : " mp-longe")}
        onClick={() => ir(passos)}
        aria-label={imediato ? (passos < 0 ? "Mês anterior" : "Próximo mês") : nome}
        title={nome}
        tabIndex={imediato ? 0 : -1}
      >
        {abrev(alvo.mes)}
      </button>
    );
  }

  return (
    <div ref={containerRef} className="month-picker mp-carrossel">
      <div className="mp-trilho anima-mes">
        <div className="mp-lado mp-esq">{[-2, -1].map(vizinho)}</div>
        <button
          type="button"
          className="mp-atual"
          onClick={() => setAberto((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={aberto}
          aria-label={`Escolher outro mês (agora: ${MESES[mes]} de ${ano})`}
        >
          {abrev(mes)}
        </button>
        <div className="mp-lado mp-dir">{[1, 2].map(vizinho)}</div>
      </div>

      {/* Os pontinhos dizem "isto desliza", como nos carrosséis de foto. O
          do meio vira o ano quando o mês da tela não é deste ano. */}
      <div className="mp-pontos" aria-hidden="true">
        <span />
        {ano === anoDeHoje ? (
          <span className="mp-ponto-atual" />
        ) : (
          <b className="mp-ano">{ano}</b>
        )}
        <span />
      </div>

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
                  className={"mp-cell" + (selecionado ? " mp-cell-selected" : "")}
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
  // A grade abre centralizada embaixo do mês do meio, que é quem a abre.
  picker: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    margin: "0 auto",
    width: 250,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    boxShadow: "0 20px 60px rgba(16,24,40,0.18)",
    padding: 14,
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
