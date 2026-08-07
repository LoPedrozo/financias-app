import { CloudOff, RotateCw } from "lucide-react";

interface Props {
  onTentarDeNovo: () => void;
}

// Recarga de fundo que falha não pode sumir no console. Num app de dinheiro,
// um saldo velho sem aviso corrói a confiança mais rápido que um erro visível:
// o número está lá, parece certo, e está errado.
//
// É uma faixa discreta em vez de toast porque o problema persiste até
// conseguir atualizar — um toast que some em 3s deixaria o dado velho na tela
// sem nenhuma marca.
export default function AvisoDesatualizado({ onTentarDeNovo }: Props) {
  return (
    <div style={styles.faixa} role="status">
      <CloudOff size={14} />
      <span style={styles.texto}>
        Não consegui atualizar. Os valores podem estar desatualizados.
      </span>
      <button style={styles.botao} onClick={onTentarDeNovo}>
        <RotateCw size={13} /> Tentar de novo
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  faixa: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    background: "var(--red-soft)",
    color: "var(--red)",
    border: "1px solid var(--red)",
    borderRadius: 12,
    padding: "10px 14px",
    marginBottom: 14,
    fontSize: 13,
  },
  texto: { flex: 1, minWidth: 140, lineHeight: 1.4 },
  botao: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    background: "var(--surface)",
    border: "1px solid var(--red)",
    color: "var(--red)",
    borderRadius: 9,
    padding: "6px 11px",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  },
};
