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

// Com ação, o toast precisa durar o tempo de ler e decidir; três segundos
// some antes do polegar chegar. Exportado porque o Desfazer da exclusão
// espera exatamente esse tempo antes de apagar de verdade.
export const DURACAO_TOAST_COM_ACAO_MS = 7000;

export default function Toast({ toast, onFechar }: Props) {
  useEffect(() => {
    const t = setTimeout(onFechar, toast.acao ? DURACAO_TOAST_COM_ACAO_MS : 3000);
    return () => clearTimeout(t);
  }, [toast.id, toast.acao, onFechar]);

  const cor = toast.tipo === "sucesso" ? "var(--green)" : "var(--red)";
  const corSoft =
    toast.tipo === "sucesso" ? "var(--green-soft)" : "var(--red-soft)";
  const corBorda = `color-mix(in srgb, ${cor} 27%, transparent)`;

  return (
    <div
      role="status"
      // A altura fica no CSS (.toast): no celular ela sobe para cima da barra
      // de baixo, senão o aviso cobria o + por até 7 segundos.
      className="toast"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--surface)",
        // Bordas por partes: "1px solid var(--green)44" (o alfa colado no
        // var) é inválido, e o navegador jogava a borda fina fora.
        borderStyle: "solid",
        borderWidth: "1px 1px 1px 4px",
        borderColor: `${corBorda} ${corBorda} ${corBorda} ${cor}`,
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
          // Fecha antes de agir: a ação pode mostrar um aviso novo ("Lançamento
          // de volta."), e fechar depois apagaria justamente esse aviso.
          onClick={() => {
            onFechar();
            toast.acao?.onAcao();
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
