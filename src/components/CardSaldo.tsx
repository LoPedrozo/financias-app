import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { useDinheiro } from "../hooks/usePreferencias";
import { useValorAnimado } from "../hooks/useValorAnimado";
import type { ResumoPendentes } from "../lib/calculos";

// O card do saldo, no estilo cartão de banco.
//
// É o card mais importante do app: o "fim do mês" é o número com que se
// decide se dá para pagar uma conta. Por isso ele mostra a conta armada —
// saldo de hoje, o que entra, o que sai e o resultado — e nunca calcula nada:
// os quatro números chegam prontos do Dashboard, das mesmas funções de
// calculos.ts de sempre. Um teste sorteia milhares de situações e confere que
// essa conta fecha (src/lib/projecao_invariante.test.ts).
//
// Antes o detalhe ficava escondido até um toque, e o projetado era o menor
// texto do card. Agora fica sempre à vista, e o fim do mês tem o mesmo peso
// do saldo de hoje.

interface PendenteItem {
  total: number;
  quantidade: number;
}

interface Props {
  /** Saldo de hoje: tudo que já foi contabilizado até o mês da tela. */
  valor: number;
  /** O que ainda vai entrar e sair. As saídas já incluem `contasAPagar`. */
  pendente: ResumoPendentes;
  /** Parte das saídas que veio de Contas a Pagar (feature hoje desligada). */
  contasAPagar?: PendenteItem;
  /** Fim do mês. Ausente quando não há nada pendente — aí só o saldo importa. */
  saldoProjetado?: number;
}

// Negativo decidido em centavos, que é o que aparece na tela: um resto de
// ponto flutuante como −0,000001 não pode acender o alerta de "vai faltar".
function negativo(valor: number): boolean {
  return Math.round(valor * 100) < 0;
}

export default function CardSaldo({
  valor,
  pendente,
  contasAPagar,
  saldoProjetado,
}: Props) {
  const dinheiro = useDinheiro();
  const entra = pendente.entradas;
  const sai = pendente.saidas;
  const contas = contasAPagar ?? { total: 0, quantidade: 0 };
  const temPendentes = saldoProjetado !== undefined;
  // Os dois números rolam até o valor novo ao trocar de mês e sempre terminam
  // no valor exato (useValorAnimado). O alerta de negativo olha o valor de
  // verdade, não o do meio da animação — senão piscaria no caminho.
  const atualNaTela = useValorAnimado(valor);
  const fimNaTela = useValorAnimado(saldoProjetado ?? valor);

  // A barra é proporção, não conta: mostra quanto do movimento previsto é
  // entrada e quanto é saída. Os valores de verdade estão escritos embaixo.
  const movimento = entra.total + sai.total;
  const parteEntra = movimento > 0 ? (entra.total / movimento) * 100 : 0;

  return (
    <div className="card card-destaque card-saldo" style={estilos.cartao}>
      <div aria-hidden="true" style={estilos.brilho} />

      <div style={estilos.topo}>
        <div style={estilos.bloco}>
          <p style={estilos.rotulo}>Saldo atual</p>
          <Valor valor={valor} texto={dinheiro(atualNaTela)} />
        </div>
        {temPendentes && (
          <div style={{ ...estilos.bloco, textAlign: "right", marginLeft: "auto" }}>
            <p style={estilos.rotulo}>
              {negativo(saldoProjetado) && (
                <AlertTriangle size={12} style={{ verticalAlign: "-1px", marginRight: 4 }} />
              )}
              ≈ Fim do mês
            </p>
            <Valor valor={saldoProjetado} texto={dinheiro(fimNaTela)} />
          </div>
        )}
      </div>

      {temPendentes ? (
        <>
          {/* A barra enche devagar, junto com a contagem dos números: a
              entrada cresce da esquerda e a saída da direita até se
              encontrarem (global.css, .card-saldo-barra). */}
          <div aria-hidden="true" className="card-saldo-barra" style={estilos.trilho}>
            <div style={{ ...estilos.parteEntra, width: `${parteEntra}%` }} />
            <div style={{ ...estilos.parteSai, width: `${100 - parteEntra}%` }} />
          </div>
          <div style={estilos.legenda}>
            {entra.quantidade > 0 && (
              <span style={estilos.item}>
                <TrendingUp size={13} /> {dinheiro(entra.total)} entra ({entra.quantidade})
              </span>
            )}
            {sai.quantidade > 0 && (
              <span style={{ ...estilos.item, marginLeft: "auto" }}>
                <TrendingDown size={13} /> {dinheiro(sai.total)} sai ({sai.quantidade})
              </span>
            )}
          </div>
          {contas.quantidade > 0 && (
            <p style={estilos.nota}>
              Inclui {dinheiro(contas.total)} em contas a pagar ({contas.quantidade}).
            </p>
          )}
        </>
      ) : (
        <p style={estilos.nota}>Nada a receber ou a pagar até o fim do mês.</p>
      )}
    </div>
  );
}

// Valor negativo ganha uma pílula escura com texto claro e avermelhado:
// vermelho puro sobre o fundo colorido do cartão não se lê, e "vai faltar"
// é justamente o que não pode passar despercebido.
function Valor({ valor, texto }: { valor: number; texto: string }) {
  if (!negativo(valor)) return <p className="card-saldo-valor" style={estilos.valor}>{texto}</p>;
  return (
    <p className="card-saldo-valor" style={estilos.valor}>
      <span style={estilos.negativo} title="Valor negativo">
        {texto}
      </span>
    </p>
  );
}

const estilos: Record<string, React.CSSProperties> = {
  cartao: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 20,
    padding: "18px 20px",
    // Tinta e degradê vêm da cor de destaque (global.css): sobre as cores
    // claras a tinta é escura e o degradê clareia; sobre as fundas, branca e
    // o degradê escurece. Um teste confere a tinta nas duas pontas.
    color: "var(--sobre-destaque)",
    background: "var(--saldo-degrade), var(--accent)",
    boxShadow: "0 10px 30px rgba(16,24,40,.22)",
  },
  brilho: {
    position: "absolute",
    right: -50,
    top: -50,
    width: 170,
    height: 170,
    borderRadius: "50%",
    background: "rgba(255,255,255,.12)",
    pointerEvents: "none",
  },
  topo: {
    position: "relative",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: "8px 16px",
  },
  bloco: { minWidth: 0 },
  // Os textos pequenos ficam na tinta cheia: semitransparentes, perdiam o
  // 4,5:1 em quase toda cor. A hierarquia fica no tamanho.
  rotulo: { fontSize: 12.5, marginBottom: 2, whiteSpace: "nowrap" },
  valor: {
    fontFamily: "'Sora', sans-serif",
    // Encolhe um pouco em tela estreita para os dois valores caberem lado a
    // lado; se mesmo assim não couberem, o fim do mês desce para a linha de
    // baixo (flex-wrap) em vez de cortar o número.
    fontSize: "clamp(19px, 6vw, 24px)",
    fontWeight: 800,
    letterSpacing: "-0.01em",
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
  },
  negativo: {
    // Escura o bastante para o rosado passar de 4,5:1 até sobre as cores
    // claras do escuro (há teste).
    background: "rgba(0,0,0,.6)",
    color: "#ffd4d4",
    borderRadius: 8,
    padding: "0 6px",
  },
  trilho: {
    position: "relative",
    display: "flex",
    height: 8,
    borderRadius: 5,
    overflow: "hidden",
    margin: "14px 0 8px",
    background: "rgba(0,0,0,.25)",
  },
  parteEntra: { background: "rgba(255,255,255,.95)" },
  // margin-left: auto prende a saída na borda direita enquanto ela enche.
  parteSai: { background: "rgba(0,0,0,.35)", marginLeft: "auto" },
  legenda: {
    position: "relative",
    display: "flex",
    flexWrap: "wrap",
    gap: "4px 14px",
    fontSize: 12.5,
    fontWeight: 600,
  },
  item: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
  },
  nota: { position: "relative", fontSize: 12, marginTop: 8 },
};
