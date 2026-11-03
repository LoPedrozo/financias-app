import { CalendarDays, CalendarRange, Database, X } from "lucide-react";
import type { ReactNode } from "react";
import { MESES } from "../types";
import type { Lancamento } from "../types";
import { filtrarPeriodo } from "../lib/csv";
import type { Periodo } from "../lib/csv";

// Escolha do recorte antes de exportar.
//
// O mês e o ano são os da tela, de propósito: o app já tem um seletor de mês
// que você usa o tempo todo, e repetir outro aqui dentro seria um segundo
// jeito de fazer a mesma coisa. Para exportar março, é ir até março e tocar.
//
// Cada opção mostra quantos lançamentos leva, para não sair um arquivo vazio
// sem ninguém perceber — e opção sem nada fica desligada.

interface Props {
  mes: number;
  ano: number;
  lancamentos: Lancamento[];
  onExportar: (periodo: Periodo) => void;
  onFechar: () => void;
}

function contagem(n: number): string {
  if (n === 0) return "nenhum lançamento";
  return n === 1 ? "1 lançamento" : `${n} lançamentos`;
}

export default function ModalExportar({
  mes,
  ano,
  lancamentos,
  onExportar,
  onFechar,
}: Props) {
  const opcoes: Array<{ periodo: Periodo; titulo: string; icone: ReactNode }> = [
    {
      periodo: { tipo: "mes", mes, ano },
      titulo: `${MESES[mes]} de ${ano}`,
      icone: <CalendarDays size={18} />,
    },
    {
      periodo: { tipo: "ano", ano },
      titulo: `Ano de ${ano}`,
      icone: <CalendarRange size={18} />,
    },
    {
      periodo: { tipo: "tudo" },
      titulo: "Tudo",
      icone: <Database size={18} />,
    },
  ];

  return (
    <div style={estilos.overlay} data-modal onClick={onFechar}>
      <div
        style={estilos.modal}
        className="modal-mobile"
        role="dialog"
        aria-labelledby="titulo-exportar"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={estilos.cabeca}>
          <h3 id="titulo-exportar" style={estilos.titulo}>
            Exportar CSV
          </h3>
          <button style={estilos.fechar} onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <p style={estilos.ajuda}>
          Para outro mês, navegue até ele antes de exportar.
        </p>

        <div style={estilos.lista}>
          {opcoes.map(({ periodo, titulo, icone }) => {
            const n = filtrarPeriodo(lancamentos, periodo).length;
            const vazio = n === 0;
            return (
              <button
                key={periodo.tipo}
                style={{
                  ...estilos.opcao,
                  opacity: vazio ? 0.45 : 1,
                  cursor: vazio ? "not-allowed" : "pointer",
                }}
                disabled={vazio}
                onClick={() => onExportar(periodo)}
              >
                <span style={estilos.icone}>{icone}</span>
                <span style={estilos.textos}>
                  <span style={estilos.opcaoTitulo}>{titulo}</span>
                  <span style={estilos.opcaoSub}>{contagem(n)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const estilos: Record<string, React.CSSProperties> = {
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
    padding: 24,
    width: "100%",
    maxWidth: 380,
    boxShadow: "0 20px 60px rgba(16,24,40,0.18)",
    animation: "fadeUp 0.25s ease",
  },
  cabeca: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  titulo: { fontSize: 19, fontWeight: 700 },
  fechar: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
    padding: 4,
  },
  ajuda: {
    fontSize: 13,
    color: "var(--text-soft)",
    marginBottom: 16,
    lineHeight: 1.45,
  },
  lista: { display: "flex", flexDirection: "column", gap: 8 },
  opcao: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    textAlign: "left",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: "12px 14px",
    color: "var(--text)",
  },
  icone: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "var(--accent-soft)",
    color: "var(--accent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textos: { display: "flex", flexDirection: "column", gap: 2 },
  opcaoTitulo: { fontSize: 15, fontWeight: 600 },
  opcaoSub: { fontSize: 12.5, color: "var(--text-soft)" },
};
