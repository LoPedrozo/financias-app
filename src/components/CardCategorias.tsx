import { PieChart } from "lucide-react";
import type { Tipo } from "../types";
import { MESES } from "../types";
import type { PorCategoria, Situacao } from "../lib/resumoMes";
import { useDinheiro } from "../hooks/usePreferencias";
import IconeCategoria from "./IconeCategoria";
import EmptyState from "./EmptyState";

// "Por categoria": no lugar da pizza, a lista das categorias do mês, da maior
// para a menor, com barra, a parte de cada uma no total e quanto mudou em
// relação ao mês anterior. As contas vêm prontas de lib/resumoMes.ts.

interface Props {
  dados: PorCategoria;
  tipo: Tipo;
  onTipo: (t: Tipo) => void;
  mes: number;
  situacao: Situacao;
  /** Mês atual: até que dia a comparação vai. */
  ateDia: number | null;
}

export default function CardCategorias({ dados, tipo, onTipo, mes, situacao, ateDia }: Props) {
  const dinheiro = useDinheiro();
  const nomeMes = MESES[mes].toLowerCase();
  const anterior = MESES[(mes + 11) % 12].toLowerCase();
  const abrevAnterior = anterior.slice(0, 3);
  const verbo = tipo === "saida" ? "saíram" : "entraram";
  const referencia = situacao === "atual" && ateDia ? `1 a ${ateDia} de ${anterior}` : anterior;
  // Mais saída é ruim e mais entrada é bom: a cor da diferença depende do tipo.
  const corDa = (dif: number) =>
    dif === 0 ? "var(--text-faint)" : (dif > 0) === (tipo === "entrada") ? "var(--green)" : "var(--red)";
  const maior = dados.linhas[0]?.valor ?? 0;

  return (
    <div>
      <div style={estilos.cabecalho}>
        <h2 style={estilos.titulo}>Por categoria</h2>
        <div style={estilos.alternar} role="group" aria-label="Tipo">
          {(["saida", "entrada"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tipo === t}
              onClick={() => onTipo(t)}
              style={{ ...estilos.opcao, ...(tipo === t ? estilos.opcaoAtiva : {}) }}
            >
              {t === "saida" ? "Saídas" : "Entradas"}
            </button>
          ))}
        </div>
      </div>

      {situacao === "futuro" ? (
        <EmptyState compacto icon={<PieChart size={22} />} titulo={`${MESES[mes]} ainda não começou.`} />
      ) : dados.linhas.length === 0 ? (
        <EmptyState
          compacto
          icon={<PieChart size={22} />}
          titulo={tipo === "entrada" ? "Sem entradas neste mês." : "Sem gastos neste mês."}
        />
      ) : (
        <>
          <p className="categorias-total" style={estilos.total}>{dinheiro(dados.total)}</p>
          <p style={estilos.sub}>
            {verbo} em {nomeMes}
            {situacao === "atual" ? " até hoje" : ""}
            {dados.diferenca !== null && (
              <>
                {" · "}
                <span style={{ color: corDa(dados.diferenca), fontWeight: 600 }}>
                  {dados.diferenca === 0
                    ? `igual a ${referencia}`
                    : `${dinheiro(Math.abs(dados.diferenca))} a ${dados.diferenca > 0 ? "mais" : "menos"} que ${referencia}`}
                </span>
              </>
            )}
          </p>

          <ul style={estilos.lista}>
            {dados.linhas.map((c) => {
              const pct = Math.round(c.fracao * 100);
              return (
                <li key={c.nome} style={estilos.linha} className="categoria-linha">
                  <IconeCategoria tipo={tipo} categoria={c.nome} tamanho={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={estilos.linhaTopo}>
                      <span style={estilos.nome}>{c.nome}</span>
                      <span style={estilos.valor}>{dinheiro(c.valor)}</span>
                    </div>
                    <div style={estilos.trilho} aria-hidden="true">
                      <div style={{ ...estilos.barra, width: `${(c.valor / maior) * 100}%`, background: c.cor }} />
                    </div>
                    <div style={estilos.linhaBase}>
                      <span style={{ whiteSpace: "nowrap" }}>{pct === 0 ? "menos de 1%" : `${pct}%`} {tipo === "saida" ? "das saídas" : "das entradas"}</span>
                      {c.diferenca !== null && (
                        <span style={{ whiteSpace: "nowrap", marginLeft: "auto" }}>
                          {c.diferenca === 0 ? (
                            `igual a ${abrevAnterior}`
                          ) : (
                            <>
                              <b style={{ color: corDa(c.diferenca) }}>
                                {c.diferenca > 0 ? "▲" : "▼"} {dinheiro(Math.abs(c.diferenca))}
                              </b>{" "}
                              vs {abrevAnterior}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

const estilos: Record<string, React.CSSProperties> = {
  cabecalho: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  titulo: { fontSize: 16, fontWeight: 600 },
  alternar: { display: "flex", gap: 3, background: "var(--bg)", padding: 3, borderRadius: 9 },
  opcao: {
    border: "none",
    background: "transparent",
    color: "var(--text-faint)",
    fontSize: 12.5,
    fontWeight: 600,
    padding: "5px 10px",
    borderRadius: 7,
    cursor: "pointer",
  },
  opcaoAtiva: { background: "var(--surface)", color: "var(--text)", boxShadow: "var(--shadow)" },
  total: {
    fontFamily: "'Sora', sans-serif",
    fontWeight: 800,
    fontSize: 24,
    fontVariantNumeric: "tabular-nums",
  },
  sub: { fontSize: 12.5, color: "var(--text-faint)", margin: "2px 0 14px", lineHeight: 1.4 },
  // minmax(0, 1fr): sem isso a coluna da grade crescia até caber a linha
  // inteira sem quebrar, e num celular de 320px empurrava o card para fora.
  lista: { listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14 },
  linha: { display: "flex", alignItems: "center", gap: 11 },
  linhaTopo: { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 },
  nome: { flex: "1 1 auto", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 },
  valor: {
    flexShrink: 0,
    fontFamily: "'Sora', sans-serif",
    fontWeight: 700,
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
  },
  trilho: { height: 6, borderRadius: 3, background: "var(--bg)", margin: "6px 0 5px", overflow: "hidden" },
  barra: { height: "100%", borderRadius: 3, transition: "width 0.6s ease" },
  // Em tela estreita "72% das saídas" e "▼ R$ 404,53 vs out" não cabem lado
  // a lado: a comparação desce para a linha de baixo, cada pedaço inteiro.
  linhaBase: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    columnGap: 8,
    rowGap: 1,
    fontSize: 11.5,
    color: "var(--text-faint)",
  },
};
