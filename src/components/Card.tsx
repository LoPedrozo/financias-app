import { brl } from "../lib/format";

interface Props {
  label: string;
  valor: number;
  icon: React.ReactNode;
  cor: string;
  destaque?: boolean;
}

export default function Card({ label, valor, icon, cor, destaque }: Props) {
  return (
    <div
      style={{
        background: destaque ? cor + "0f" : "var(--surface)",
        border: `1px solid ${destaque ? cor + "44" : "var(--border)"}`,
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
            fontSize: 21,
            fontWeight: 700,
            color: destaque ? cor : "var(--text)",
            overflowWrap: "anywhere",
          }}
        >
          {brl(valor)}
        </p>
      </div>
    </div>
  );
}
