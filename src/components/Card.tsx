import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { brl } from "../lib/format";

interface PendenteItem {
  total: number;
  quantidade: number;
}

interface Props {
  label: string;
  valor: number;
  icon: React.ReactNode;
  cor: string;
  destaque?: boolean;
  pendente?: {
    entradas: PendenteItem;
    saidas: PendenteItem;
  };
}

export default function Card({ label, valor, icon, cor, destaque, pendente }: Props) {
  const [hover, setHover] = useState(false);
  const [semHover, setSemHover] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: none)");
    setSemHover(mq.matches);
    const listener = (e: MediaQueryListEvent) => setSemHover(e.matches);
    mq.addEventListener?.("change", listener);
    return () => mq.removeEventListener?.("change", listener);
  }, []);

  const temEntradas = !!pendente && pendente.entradas.quantidade > 0;
  const temSaidas = !!pendente && pendente.saidas.quantidade > 0;
  const temPendentes = temEntradas || temSaidas;
  const [aberto, setAberto] = useState(false);
  const mostrarPendentes =
    temPendentes && (semHover ? aberto : hover);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={
        semHover && temPendentes ? () => setAberto((a) => !a) : undefined
      }
      style={{
        background: destaque ? "var(--accent-soft)" : "var(--surface)",
        border: `1px solid ${destaque ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        padding: "18px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: "var(--shadow)",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: cor + "1f",
          color: cor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, color: "var(--text-soft)", marginBottom: 2 }}>
          {label}
        </p>
        <p
          className="card-valor"
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: destaque ? 23 : 21,
            fontWeight: 700,
            color: destaque ? cor : "var(--text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {brl(valor)}
        </p>
        {mostrarPendentes && (
          <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
            {temEntradas && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--green)",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <TrendingUp size={11} />+ {brl(pendente!.entradas.total)} a receber
                ({pendente!.entradas.quantidade})
              </p>
            )}
            {temSaidas && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--red)",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <TrendingDown size={11} />− {brl(pendente!.saidas.total)} a pagar
                ({pendente!.saidas.quantidade})
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
