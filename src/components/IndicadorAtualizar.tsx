import { RefreshCw } from "lucide-react";
import type { EstadoPuxar } from "../hooks/usePuxarParaAtualizar";
import { LIMIAR_PUXAR } from "../hooks/usePuxarParaAtualizar";

// O círculo que desce do topo enquanto se puxa a tela (usePuxarParaAtualizar).
// A seta gira com o dedo e fica na cor de destaque quando soltar já atualiza;
// atualizando, gira sozinha (parada com "reduzir movimento"). Some quando
// não há gesto — nada fica na tela sem uso.

export default function IndicadorAtualizar({ distancia, estado }: { distancia: number; estado: EstadoPuxar }) {
  const atualizando = estado === "atualizando";
  const ativo = estado === "pronto" || atualizando;
  return (
    <>
      <div
        aria-hidden="true"
        className="indicador-atualizar"
        style={{
          ...estilos.circulo,
          opacity: estado === "parado" ? 0 : Math.min(1, distancia / (LIMIAR_PUXAR * 0.6)),
          transform: `translate(-50%, ${distancia - 46}px)`,
          // Seguindo o dedo, sem atraso; soltando, desliza para o lugar.
          transition: estado === "puxando" || estado === "pronto" ? "none" : "transform 0.25s ease, opacity 0.25s ease",
          color: ativo ? "var(--destaque-texto)" : "var(--text-faint)",
        }}
      >
        <RefreshCw
          size={18}
          strokeWidth={2.4}
          className={atualizando ? "girando" : undefined}
          style={atualizando ? undefined : { transform: `rotate(${distancia * 3}deg)` }}
        />
      </div>
      {/* Para o VoiceOver: o círculo é enfeite, o aviso é este. */}
      <span role="status" style={estilos.oculto}>
        {atualizando ? "Atualizando…" : ""}
      </span>
    </>
  );
}

const estilos: Record<string, React.CSSProperties> = {
  circulo: {
    position: "fixed",
    top: "env(safe-area-inset-top)",
    left: "50%",
    width: 38,
    height: 38,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow)",
    // Acima da página e da barra de baixo, abaixo dos menus e modais.
    zIndex: 35,
    pointerEvents: "none",
  },
  oculto: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
  },
};
