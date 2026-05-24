interface Props {
  icon: React.ReactNode;
  titulo: string;
  sugestao?: string;
  compacto?: boolean;
}

export default function EmptyState({ icon, titulo, sugestao, compacto }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: compacto ? "20px 12px" : "36px 16px",
        color: "var(--text-faint)",
      }}
    >
      <div
        style={{
          width: compacto ? 44 : 56,
          height: compacto ? 44 : 56,
          borderRadius: 14,
          background: "var(--bg)",
          color: "var(--text-faint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        {icon}
      </div>
      <p style={{ fontSize: 14, color: "var(--text-soft)", fontWeight: 500 }}>
        {titulo}
      </p>
      {sugestao && (
        <p style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 4 }}>
          {sugestao}
        </p>
      )}
    </div>
  );
}
