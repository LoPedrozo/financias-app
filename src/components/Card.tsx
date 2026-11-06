import { useDinheiro } from "../hooks/usePreferencias";

// Card simples de um número só — Renda e Gastos. O saldo, que mostra a conta
// do fim do mês, tem o próprio componente (CardSaldo).

interface Props {
  label: string;
  valor: number;
  icon: React.ReactNode;
  cor: string;
}

export default function Card({ label, valor, icon, cor }: Props) {
  const dinheiro = useDinheiro();

  return (
    <div
      className="card"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "18px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: "var(--shadow)",
      }}
    >
      <div
        className="card-icone"
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
        <p
          className="card-rotulo"
          style={{ fontSize: 13, color: "var(--text-soft)", marginBottom: 2 }}
        >
          {label}
        </p>
        <p
          className="card-valor"
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 21,
            fontWeight: 700,
            color: "var(--text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {dinheiro(valor)}
        </p>
      </div>
    </div>
  );
}
