interface Props {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: React.CSSProperties;
}

export default function Skeleton({ width, height = 14, radius = 8, style }: Props) {
  return (
    <span
      className="skeleton-pulse"
      style={{
        display: "inline-block",
        width: width ?? "100%",
        height,
        borderRadius: radius,
        background: "var(--border)",
        ...style,
      }}
    />
  );
}

export function SkeletonItem() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background: "var(--bg)",
        padding: "12px 14px",
        borderRadius: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Skeleton width={22} height={14} />
        <Skeleton width={90} height={20} radius={7} />
        <Skeleton width={70} height={16} style={{ marginLeft: "auto" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Skeleton width="60%" height={14} />
      </div>
    </div>
  );
}

export function SkeletonLista({ linhas = 4 }: { linhas?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: linhas }).map((_, i) => (
        <SkeletonItem key={i} />
      ))}
    </div>
  );
}
