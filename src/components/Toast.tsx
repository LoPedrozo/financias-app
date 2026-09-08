import { useEffect } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

export type ToastTipo = "sucesso" | "erro";

export interface ToastAcao {
  rotulo: string;
  onAcao: () => void;
}

export interface ToastDados {
  id: number;
  tipo: ToastTipo;
  mensagem: string;
  /** Botão opcional no próprio toast — hoje, o desfazer de uma leva. */
  acao?: ToastAcao;
}

interface Props {
  toast: ToastDados;
  onFechar: () => void;
}

export default function Toast({ toast, onFechar }: Props) {
  // Com ação, o toast precisa durar o tempo de ler e decidir; três segundos
  // some antes do polegar chegar.
  useEffect(() => {
    const t = setTimeout(onFechar, toast.acao ? 7000 : 3000);
    return () => clearTimeout(t);
  }, [toast.id, toast.acao, onFechar]);

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
      {toast.acao && (
        <button
          type="button"
          onClick={() => {
            toast.acao?.onAcao();
            onFechar();
          }}
          style={{
            background: "none",
            border: "none",
            padding: "4px 2px",
            marginLeft: 2,
            color: cor,
            fontSize: 14,
            fontWeight: 700,
            whiteSpace: "nowrap",
            textDecoration: "underline",
          }}
        >
          {toast.acao.rotulo}
        </button>
      )}
    </div>
  );
}
