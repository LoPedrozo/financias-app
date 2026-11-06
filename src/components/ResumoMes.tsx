import { TrendingDown, TrendingUp } from "lucide-react";
import { useDinheiro } from "../hooks/usePreferencias";
import { useValorAnimado } from "../hooks/useValorAnimado";

// Renda e Gastos do mês num card só, dividido ao meio.
//
// Eram dois cards soltos, cada um com o seu ícone num quadradinho. Juntos,
// leem como uma coisa só — o que entrou e o que saiu neste mês — e cada
// metade ganha um véu da própria cor, de cima para baixo: verde é entrada,
// vermelho é saída, como no resto do app. O rótulo vai em caixa alta pelo
// CSS (o texto continua "Renda", que é o que leitor de tela e teste leem).

interface Props {
  renda: number;
  gastos: number;
}

export default function ResumoMes({ renda, gastos }: Props) {
  return (
    <div className="card resumo-mes" style={estilos.cartao}>
      <Metade rotulo="Renda" valor={renda} cor="var(--green)" icone={<TrendingUp size={15} />} />
      <Metade
        rotulo="Gastos"
        valor={gastos}
        cor="var(--red)"
        icone={<TrendingDown size={15} />}
        divisoria
      />
    </div>
  );
}

function Metade({
  rotulo,
  valor,
  cor,
  icone,
  divisoria,
}: {
  rotulo: string;
  valor: number;
  cor: string;
  icone: React.ReactNode;
  divisoria?: boolean;
}) {
  const dinheiro = useDinheiro();
  const mostrado = useValorAnimado(valor);
  return (
    <div
      className="resumo-metade"
      style={{
        ...estilos.metade,
        ...(divisoria ? { borderLeft: "1px solid var(--border)" } : {}),
        // Navegador sem color-mix ignora a linha e a metade fica lisa.
        background: `linear-gradient(180deg, color-mix(in srgb, ${cor} 16%, transparent), transparent 72%)`,
      }}
    >
      <p className="resumo-rotulo" style={{ ...estilos.rotulo, color: cor }}>
        {icone}
        {rotulo}
      </p>
      {/* O tamanho da fonte sai do comprimento do valor final (global.css):
          "R$ 128.345,67" precisa de letra menor que "R$ 8.625,00" para
          caber inteiro. Medido no valor final, e não no do meio da
          animação, para a letra não mudar de tamanho enquanto rola. */}
      <p
        className="resumo-valor"
        style={{ ...estilos.valor, "--caracteres": dinheiro(valor).length } as React.CSSProperties}
      >
        {dinheiro(mostrado)}
      </p>
    </div>
  );
}

const estilos: Record<string, React.CSSProperties> = {
  cartao: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    overflow: "hidden",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    boxShadow: "var(--shadow)",
  },
  metade: {
    padding: "14px 16px 16px",
    minWidth: 0,
    // O tamanho do valor é medido na largura da metade (global.css).
    containerType: "inline-size",
  },
  rotulo: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  valor: {
    fontFamily: "'Sora', sans-serif",
    fontWeight: 700,
    color: "var(--text)",
    marginTop: 8,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.01em",
  },
};
