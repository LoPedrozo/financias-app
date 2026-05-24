import { useEffect } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

export type ToastTipo = "sucesso" | "erro";

export interface ToastDados {
  id: number;
  tipo: ToastTipo;
  mensagem: string;
}

interface Props {
  toast: ToastDados;
  onFechar: () => void;
}

export default function Toast({ toast, onFechar }: Props) {
  useEffect(() => {
    const t = setTimeout(onFechar, 3000);
    return () => clearTimeout(t);
  }, [toast.id, onFechar]);

  const cor = toast.tipo === "sucesso" ? "var(--green)" : "var(--red)";
  const corSoft =
    toast.tipo === "sucesso" ? "var(--green-soft)" : "var(--red-soft)";

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--surface)",
        border: `1px solid ${cor}44`,
        borderLeft: `4px solid ${cor}`,
        borderRadius: 12,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxShadow: "var(--shadow)",
        fontSize: 14,
        color: "var(--text)",
        maxWidth: "calc(100vw - 32px)",
        zIndex: 100,
        animation: "fadeUp 0.22s ease-out",
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: corSoft,
          color: cor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {toast.tipo === "sucesso" ? (
          <CheckCircle2 size={17} />
        ) : (
          <AlertCircle size={17} />
        )}
      </span>
      <span>{toast.mensagem}</span>
    </div>
  );
}
