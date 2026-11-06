import { TrendingDown, TrendingUp } from "lucide-react";
import { useDinheiro } from "../hooks/usePreferencias";
import { useValorAnimado } from "../hooks/useValorAnimado";
import type { Tipo } from "../types";

// Renda e Gastos do mês num card só, dividido ao meio.
//
// Eram dois cards soltos, cada um com o seu ícone num quadradinho. Juntos,
// leem como uma coisa só — o que entrou e o que saiu neste mês — e cada
// metade ganha um véu da própria cor, de cima para baixo: verde é entrada,
// vermelho é saída, como no resto do app. O rótulo vai em caixa alta pelo
// CSS (o texto continua "Renda", que é o que leitor de tela e teste leem).
//
// Cada metade é também um botão: tocar em Renda mostra na lista só as
// entradas do mês; em Gastos, só as saídas; tocar de novo volta a mostrar
// tudo. O filtro é só da lista — os números daqui, do cartão do saldo e dos
// gráficos continuam sendo do mês inteiro.

interface Props {
  renda: number;
  gastos: number;
  filtro?: Tipo | null;
  onFiltrar?: (tipo: Tipo) => void;
}

export default function ResumoMes({ renda, gastos, filtro = null, onFiltrar }: Props) {
  return (
    <div className="card resumo-mes" style={estilos.cartao}>
      <Metade
        rotulo="Renda"
        valor={renda}
        cor="var(--green)"
        icone={<TrendingUp size={15} />}
        ativo={filtro === "entrada"}
        apagado={filtro === "saida"}
        onTocar={onFiltrar && (() => onFiltrar("entrada"))}
        dica="Mostrar só as entradas na lista"
      />
      <Metade
        rotulo="Gastos"
        valor={gastos}
        cor="var(--red)"
        icone={<TrendingDown size={15} />}
        ativo={filtro === "saida"}
        apagado={filtro === "entrada"}
        onTocar={onFiltrar && (() => onFiltrar("saida"))}
        dica="Mostrar só as saídas na lista"
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
  ativo,
  apagado,
  onTocar,
  dica,
}: {
  rotulo: string;
  valor: number;
  cor: string;
  icone: React.ReactNode;
  divisoria?: boolean;
  ativo?: boolean;
  apagado?: boolean;
  onTocar?: () => void;
  dica?: string;
}) {
  const dinheiro = useDinheiro();
  const mostrado = useValorAnimado(valor);
  // Sem onTocar (uso só de leitura), é uma caixa comum; com ele, um botão de
  // verdade — com teclado, foco e "pressionado" para leitor de tela.
  const Caixa = onTocar ? "button" : "div";
  return (
    <Caixa
      {...(onTocar ? { type: "button" as const, onClick: onTocar, "aria-pressed": !!ativo, title: dica } : {})}
      className="resumo-metade"
      style={{
        ...estilos.metade,
        ...(onTocar ? estilos.botao : {}),
        ...(divisoria ? { borderLeft: "1px solid var(--border)" } : {}),
        // Navegador sem color-mix ignora a linha e a metade fica lisa.
        background: `linear-gradient(180deg, color-mix(in srgb, ${cor} ${ativo ? 30 : 16}%, transparent), transparent 72%)`,
        // A metade escolhida ganha um contorno na própria cor; a outra
        // esmaece — dá para ver de relance que a lista está filtrada.
        boxShadow: ativo ? `inset 0 0 0 2px ${cor}` : undefined,
        opacity: apagado ? 0.5 : 1,
      }}
    >
      <span className="resumo-rotulo" style={{ ...estilos.rotulo, color: cor }}>
        {icone}
        {rotulo}
      </span>
      {/* O tamanho da fonte sai do comprimento do valor final (global.css):
          "R$ 128.345,67" precisa de letra menor que "R$ 8.625,00" para
          caber inteiro. Medido no valor final, e não no do meio da
          animação, para a letra não mudar de tamanho enquanto rola. */}
      <span
        className="resumo-valor"
        style={{ ...estilos.valor, "--caracteres": dinheiro(valor).length } as React.CSSProperties}
      >
        {dinheiro(mostrado)}
      </span>
    </Caixa>
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
  // Zera o visual de botão do navegador: a metade continua parecendo card.
  botao: {
    display: "block",
    width: "100%",
    textAlign: "left",
    border: "none",
    font: "inherit",
    color: "inherit",
    cursor: "pointer",
    transition: "opacity 0.2s ease, box-shadow 0.2s ease",
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
    display: "block",
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
