import { ArrowDown, ArrowUp, CalendarClock, Equal, PiggyBank, type LucideIcon } from "lucide-react";
import { MESES } from "../types";
import type { ResumoDoMes } from "../lib/resumoMes";
import { useDinheiro } from "../hooks/usePreferencias";
import { iconeDaCategoria } from "./IconeCategoria";

// "Resumo do mês": quanto sobrou (ou faltou), a comparação com o mês anterior
// em frases e a sobra dos últimos seis meses. Todas as contas vêm prontas de
// lib/resumoMes.ts — aqui só se escolhem as palavras e as cores.

type Tom = "bom" | "ruim" | "neutro";

const COR: Record<Tom, string> = { bom: "var(--green)", ruim: "var(--red)", neutro: "var(--text-faint)" };
const FUNDO: Record<Tom, string> = { bom: "var(--green-soft)", ruim: "var(--red-soft)", neutro: "var(--bg)" };

function Frase({ Icone, tom, children }: { Icone: LucideIcon; tom: Tom; children: React.ReactNode }) {
  return (
    <li style={estilos.frase}>
      <span style={{ ...estilos.fraseIcone, color: COR[tom], background: FUNDO[tom] }} aria-hidden="true">
        <Icone size={15} />
      </span>
      <span style={estilos.fraseTexto}>{children}</span>
    </li>
  );
}

const tomDe = (dif: number, maisEhBom: boolean): Tom => (dif === 0 ? "neutro" : (dif > 0) === maisEhBom ? "bom" : "ruim");

export default function CardResumoMes({ resumo, mes }: { resumo: ResumoDoMes; mes: number }) {
  const dinheiro = useDinheiro();
  const { situacao, totais, comparacao, historico } = resumo;
  const nomeMes = MESES[mes].toLowerCase();
  const anterior = MESES[(mes + 11) % 12].toLowerCase();
  const atual = situacao === "atual";
  // "que no mesmo período de outubro" (mês atual) ou "que em outubro".
  const queEm = atual && comparacao?.ateDia ? `que no mesmo período de ${anterior}` : `que em ${anterior}`;
  const b = (t: string) => <b style={estilos.forte}>{t}</b>;

  const sobrou = totais.sobra >= 0;
  const maxHist = Math.max(...historico.map((h) => Math.abs(h.sobra)), 0);

  return (
    <div>
      <h2 style={estilos.titulo}>Resumo de {nomeMes}</h2>

      {situacao === "futuro" ? (
        <p style={estilos.aviso}>{MESES[mes]} ainda não começou. O resumo aparece quando o mês chegar.</p>
      ) : (
        <>
          <p style={estilos.rotulo}>
            {sobrou ? "Sobrou" : "Faltou"} {atual ? "até hoje" : "no mês"}
          </p>
          <p
            className="resumo-sobra"
            style={{ ...estilos.sobra, color: totais.sobra === 0 ? "var(--text)" : sobrou ? "var(--green)" : "var(--red)" }}
          >
            {totais.sobra > 0 ? "+ " : totais.sobra < 0 ? "− " : ""}
            {dinheiro(Math.abs(totais.sobra))}
          </p>
          <p style={estilos.rotulo}>
            entrou {dinheiro(totais.entrou)} · saiu {dinheiro(totais.saiu)}
          </p>

          {comparacao ? (
            <>
              <p style={estilos.comparadoCom}>
                Comparado com {atual && comparacao.ateDia ? `1 a ${comparacao.ateDia} de ${anterior}` : anterior}
              </p>
              <ul style={estilos.frases}>
                <Frase Icone={comparacao.difSobra === 0 ? Equal : PiggyBank} tom={tomDe(comparacao.difSobra, true)}>
                  {comparacao.difSobra === 0 ? (
                    <>O mesmo resultado {queEm}</>
                  ) : (
                    <>
                      {b(`${dinheiro(Math.abs(comparacao.difSobra))} ${comparacao.difSobra > 0 ? "melhor" : "pior"}`)} {queEm}
                    </>
                  )}{" "}
                  (lá {comparacao.anterior.sobra >= 0 ? "sobrou" : "faltou"} {dinheiro(Math.abs(comparacao.anterior.sobra))})
                </Frase>
                <Frase Icone={comparacao.difSaiu === 0 ? Equal : comparacao.difSaiu < 0 ? ArrowDown : ArrowUp} tom={tomDe(comparacao.difSaiu, false)}>
                  {comparacao.difSaiu === 0 ? (
                    <>Gastou o mesmo {queEm}</>
                  ) : (
                    <>
                      Gastou {b(`${dinheiro(Math.abs(comparacao.difSaiu))} a ${comparacao.difSaiu > 0 ? "mais" : "menos"}`)} {queEm}
                    </>
                  )}
                </Frase>
                <Frase Icone={comparacao.difEntrou === 0 ? Equal : comparacao.difEntrou > 0 ? ArrowUp : ArrowDown} tom={tomDe(comparacao.difEntrou, true)}>
                  {comparacao.difEntrou === 0 ? (
                    <>Entrou o mesmo {queEm}</>
                  ) : (
                    <>
                      Entrou {b(`${dinheiro(Math.abs(comparacao.difEntrou))} a ${comparacao.difEntrou > 0 ? "mais" : "menos"}`)} {queEm}
                    </>
                  )}
                </Frase>
                {comparacao.maisSubiu && (
                  <Frase Icone={iconeDaCategoria(comparacao.maisSubiu.categoria)} tom="ruim">
                    {b(comparacao.maisSubiu.categoria)} foi o gasto que mais subiu:{" "}
                    <span style={{ whiteSpace: "nowrap" }}>+ {dinheiro(comparacao.maisSubiu.diferenca)}</span>
                  </Frase>
                )}
              </ul>
            </>
          ) : (
            <p style={estilos.aviso}>Sem lançamentos em {anterior} para comparar.</p>
          )}
        </>
      )}

      <p style={estilos.historicoTitulo}>Sobra dos últimos 6 meses</p>
      <div style={estilos.historico}>
        <div style={estilos.linhaZero} aria-hidden="true" />
        {historico.map((h, i) => {
          const ultimo = i === historico.length - 1;
          const alt = maxHist > 0 ? Math.max(h.sobra === 0 ? 0 : 3, (Math.abs(h.sobra) / maxHist) * 40) : 0;
          const nome = MESES[h.mes];
          return (
            <div
              key={`${h.ano}-${h.mes}`}
              style={estilos.coluna}
              role="img"
              aria-label={
                h.vazio
                  ? `${nome}: sem lançamentos`
                  : `${nome}: ${h.sobra >= 0 ? "sobrou" : "faltou"} ${dinheiro(Math.abs(h.sobra))}`
              }
            >
              {h.vazio ? (
                <span style={estilos.pontoVazio} />
              ) : (
                <span
                  style={{
                    ...estilos.barra,
                    height: alt,
                    // A linha do zero fica a 40px do topo de uma coluna de 100px:
                    // barra positiva sobe a partir dela (base a 60px do chão),
                    // negativa desce a partir dela.
                    ...(h.sobra >= 0 ? { bottom: 60 } : { top: 40 }),
                    background: h.sobra >= 0 ? "var(--green)" : "var(--red)",
                    opacity: ultimo ? 1 : 0.4,
                  }}
                />
              )}
              <span style={{ ...estilos.mesRotulo, ...(ultimo ? estilos.mesAtual : {}) }}>{nome.slice(0, 3)}</span>
            </div>
          );
        })}
      </div>
      {atual && (
        <p style={estilos.nota}>
          <CalendarClock size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
          {MESES[mes]} conta até hoje; o que está agendado entra quando a data chegar.
        </p>
      )}
    </div>
  );
}

const estilos: Record<string, React.CSSProperties> = {
  titulo: { fontSize: 16, fontWeight: 600, marginBottom: 12 },
  rotulo: { fontSize: 12.5, color: "var(--text-faint)" },
  sobra: {
    fontFamily: "'Sora', sans-serif",
    fontWeight: 800,
    fontSize: 28,
    fontVariantNumeric: "tabular-nums",
    margin: "1px 0 2px",
  },
  comparadoCom: {
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--text-faint)",
    margin: "16px 0 4px",
  },
  frases: { listStyle: "none", padding: 0, margin: 0 },
  frase: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: "9px 0",
    borderTop: "1px solid var(--border)",
  },
  fraseIcone: {
    flexShrink: 0,
    width: 30,
    height: 30,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  fraseTexto: { fontSize: 13.5, lineHeight: 1.35, color: "var(--text-soft)" },
  forte: { color: "var(--text)", fontWeight: 700 },
  aviso: { fontSize: 13.5, color: "var(--text-soft)", margin: "4px 0 8px", lineHeight: 1.4 },
  historicoTitulo: {
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--text-faint)",
    margin: "18px 0 8px",
  },
  historico: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 8,
    height: 100,
  },
  linhaZero: { position: "absolute", left: 0, right: 0, top: 40, borderTop: "1px dashed var(--border)" },
  coluna: { position: "relative", height: 100 },
  barra: { position: "absolute", left: "20%", right: "20%", borderRadius: 4 },
  pontoVazio: {
    position: "absolute",
    left: "50%",
    top: 37,
    width: 6,
    height: 6,
    marginLeft: -3,
    borderRadius: "50%",
    background: "var(--border)",
  },
  mesRotulo: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: "center",
    fontSize: 11,
    color: "var(--text-faint)",
  },
  mesAtual: { color: "var(--text)", fontWeight: 700 },
  nota: { fontSize: 11.5, color: "var(--text-faint)", marginTop: 6 },
};
