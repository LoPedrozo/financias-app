import { CreditCard, Nfc } from "lucide-react";
import type { CSSProperties } from "react";
import type { Cartao } from "../types";
import type { Fatura } from "../lib/fatura";
import { diaEMes, nomeDaFatura } from "../lib/fatura";
import { useDinheiro } from "../hooks/usePreferencias";

// O cartão de crédito na tela principal (opção 2 dos protótipos): um cartão
// escuro com a fatura aberta — quanto já foi, a previsão e a meta. Tocar abre
// a fatura inteira (FolhaCartao).
//
// Ainda sem cartão, é um convite discreto para configurar.

interface Props {
  cartao: Cartao | null;
  /** A fatura do ciclo de agora. */
  aberta: Fatura | null;
  /** A que já fechou e ainda não venceu, se houver: é a próxima a sair do saldo. */
  aPagar: Fatura | null;
  hoje: string;
  onAbrir: () => void;
  onConfigurar: () => void;
}

export default function CardCartao({ cartao, aberta, aPagar, hoje, onAbrir, onConfigurar }: Props) {
  const dinheiro = useDinheiro();

  if (!cartao || !aberta) {
    return (
      <button type="button" className="card card-destaque card-cartao-convite" style={estilos.convite} onClick={onConfigurar}>
        <span style={estilos.conviteIcone} aria-hidden="true">
          <CreditCard size={18} />
        </span>
        <span style={estilos.conviteTextos}>
          <span style={estilos.conviteTitulo}>Cartão de crédito</span>
          <span style={estilos.conviteSub}>Veja o que entra na fatura e quanto ela vai dar.</span>
        </span>
        <span style={estilos.conviteAcao}>Configurar</span>
      </button>
    );
  }

  const meta = cartao.meta_total;
  // A barra é proporção da meta; sem meta, do próprio total previsto.
  const base = meta && meta > 0 ? meta : Math.max(aberta.total, 1);
  const parteGasto = Math.min(100, (aberta.gasto / base) * 100);
  const partePrevisto = Math.min(100 - parteGasto, (aberta.previsto / base) * 100);
  const passou = meta ? aberta.total - meta : 0;

  return (
    <button
      type="button"
      className="card card-destaque card-cartao"
      style={estilos.cartao}
      onClick={onAbrir}
      aria-label={`Cartão de crédito: fatura de ${nomeDaFatura(aberta.ciclo, hoje)}, ${dinheiro(aberta.gasto)} até agora. Abrir a fatura.`}
    >
      <span aria-hidden="true" style={estilos.brilho} />
      <span style={estilos.topo}>
        <span style={estilos.nome}>{cartao.nome}</span>
        <Nfc size={20} aria-hidden="true" />
      </span>
      <span style={estilos.sub}>
        Fatura de {nomeDaFatura(aberta.ciclo, hoje)} · vence {diaEMes(aberta.ciclo.vencimento)}
      </span>
      <span className="card-cartao-valor" style={estilos.valor}>
        {dinheiro(aberta.gasto)}
      </span>
      <span aria-hidden="true" style={estilos.trilho}>
        <span style={{ ...estilos.parteGasto, width: `${parteGasto}%` }} />
        <span style={{ ...estilos.partePrevisto, width: `${partePrevisto}%` }} />
      </span>
      <span style={estilos.rodape}>
        <span>{aberta.previsto > 0 ? `≈ ${dinheiro(aberta.total)} previsto` : "sem previstos"}</span>
        <span>
          {meta ? (passou > 0.004 ? `${dinheiro(passou)} acima da meta` : `meta ${dinheiro(meta)}`) : "sem meta"}
        </span>
      </span>
      {aPagar && (
        <span style={estilos.aPagar}>
          Fatura de {nomeDaFatura(aPagar.ciclo, hoje)} fechou: {dinheiro(aPagar.total)} · vence{" "}
          {diaEMes(aPagar.ciclo.vencimento)}
        </span>
      )}
    </button>
  );
}

const estilos: Record<string, CSSProperties> = {
  cartao: {
    position: "relative",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    textAlign: "left",
    width: "100%",
    borderRadius: 20,
    padding: "18px 20px",
    borderWidth: 0,
    borderStyle: "solid",
    color: "var(--cartao-texto)",
    background: "var(--cartao-fundo)",
    boxShadow: "0 10px 30px rgba(16,24,40,.22)",
    cursor: "pointer",
  },
  brilho: {
    position: "absolute",
    right: -60,
    top: -60,
    width: 180,
    height: 180,
    borderRadius: "50%",
    background: "rgba(255,255,255,.06)",
    pointerEvents: "none",
  },
  topo: {
    position: "relative",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nome: { fontSize: 14, fontWeight: 600 },
  sub: { position: "relative", fontSize: 12.5, color: "var(--cartao-suave)", marginTop: 2 },
  valor: {
    position: "relative",
    fontFamily: "'Sora', sans-serif",
    fontSize: "clamp(24px, 7vw, 28px)",
    fontWeight: 800,
    letterSpacing: "-0.01em",
    margin: "12px 0 10px",
    fontVariantNumeric: "tabular-nums",
  },
  trilho: {
    position: "relative",
    display: "flex",
    height: 8,
    borderRadius: 5,
    overflow: "hidden",
    background: "var(--cartao-trilho)",
  },
  parteGasto: { background: "var(--cartao-texto)" },
  // Listrado: o que ainda vai acontecer, pelos previstos.
  partePrevisto: {
    background: "repeating-linear-gradient(135deg, var(--cartao-texto) 0 4px, transparent 4px 7px)",
    opacity: 0.6,
  },
  rodape: {
    position: "relative",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 12.5,
    color: "var(--cartao-suave)",
    marginTop: 8,
  },
  aPagar: {
    position: "relative",
    fontSize: 12.5,
    color: "var(--cartao-texto)",
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1px solid var(--cartao-trilho)",
  },
  convite: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    textAlign: "left",
    padding: "14px 16px",
    borderRadius: "var(--radius)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    cursor: "pointer",
  },
  conviteIcone: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--accent-soft)",
    color: "var(--destaque-texto)",
  },
  conviteTextos: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 },
  conviteTitulo: { fontSize: 15, fontWeight: 600 },
  conviteSub: { fontSize: 12.5, color: "var(--text-soft)" },
  conviteAcao: { fontSize: 13.5, fontWeight: 700, color: "var(--destaque-texto)", flexShrink: 0 },
};
