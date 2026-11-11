import { useState } from "react";
import type { CSSProperties } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Globe, Nfc, Plus, Repeat, Settings2 } from "lucide-react";
import type { Cartao, CompraCartao, Lancamento, PrevistoCartao } from "../types";
import {
  CATEGORIA_FATURA,
  cicloDaData,
  cicloSeguinte,
  diaEMes,
  faturaDoCiclo,
  nomeDaFatura,
  primeiroCiclo,
  somarDias,
} from "../lib/fatura";
import type { Fatura } from "../lib/fatura";
import { rotuloCurto } from "../lib/agruparPorDia";
import { useDinheiro } from "../hooks/usePreferencias";
import Folha from "./Folha";
import IconeCategoria from "./IconeCategoria";
import { BotaoPrincipal } from "./campos";

// A fatura inteira do cartão (opção 2 dos protótipos): quanto já foi, a
// previsão, a meta dividida em essenciais e livre, os previstos que ainda vão
// acontecer até fechar e as compras por dia. As setas andam pelas faturas.

interface Props {
  cartao: Cartao;
  compras: CompraCartao[];
  previstos: PrevistoCartao[];
  /** Os lançamentos de verdade, para achar a fatura lançada à mão. */
  lancamentos: Lancamento[];
  hoje: string;
  /** Qual fatura abrir (o dia do fechamento); sem ele, a aberta. */
  fechamento?: string;
  onNovaCompra: () => void;
  onEditarCompra: (c: CompraCartao) => void;
  onNovoPrevisto: () => void;
  onEditarPrevisto: (p: PrevistoCartao) => void;
  onConfigurar: () => void;
  onApagarLancamento: (l: Lancamento) => void;
  onFechar: () => void;
}

const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// "13, 20 e 27 nov".
function listaDeDias(datas: string[]): string {
  const dias = datas.map((d) => String(Number(d.slice(8, 10))));
  const mes = diaEMes(datas[datas.length - 1]).split(" ")[1];
  const juntos = dias.length > 1 ? `${dias.slice(0, -1).join(", ")} e ${dias[dias.length - 1]}` : dias[0];
  const mesmoMes = datas.every((d) => d.slice(0, 7) === datas[0].slice(0, 7));
  return mesmoMes ? `${juntos} ${mes}` : datas.map(diaEMes).join(", ");
}

export function lancadasAMao(lancamentos: Lancamento[], fatura: Fatura, cartao: Cartao): Lancamento[] {
  if (fatura.ciclo.vencimento < cartao.inicio) return [];
  const mes = fatura.ciclo.vencimento.slice(0, 7);
  return lancamentos.filter(
    (l) =>
      !l.fatura &&
      l.tipo === "saida" &&
      l.categoria === CATEGORIA_FATURA &&
      /cart[aã]o|fatura|nubank/i.test(l.descricao) &&
      (l.data ?? "").slice(0, 7) === mes
  );
}

export default function FolhaCartao(props: Props) {
  const { cartao, compras, previstos, lancamentos, hoje } = props;
  const dinheiro = useDinheiro();
  const aberta = cicloDaData(hoje, cartao);
  const [fechamento, setFechamento] = useState(props.fechamento ?? aberta.fechamento);
  const ciclo = cicloDaData(somarDias(fechamento, -1), cartao);
  const f = faturaDoCiclo(ciclo, cartao, compras, previstos, hoje);
  const primeiro = primeiroCiclo(cartao);
  const acompanhada = ciclo.fechamento >= primeiro.fechamento;
  const aMao = lancadasAMao(lancamentos, f, cartao);

  const estado =
    f.estado === "aberta"
      ? "aberta"
      : f.estado === "futura"
      ? "ainda não abriu"
      : hoje < ciclo.vencimento
      ? "fechada"
      : "vencida";

  const metaTotal = cartao.meta_total;
  const metaEssenciais = cartao.meta_essenciais;

  return (
    <Folha
      titulo={`Fatura de ${nomeDaFatura(ciclo, hoje)}`}
      onFechar={props.onFechar}
      largura={460}
      rodape={
        <BotaoPrincipal onClick={props.onNovaCompra} icone={<Plus size={19} aria-hidden="true" />}>
          Compra no cartão
        </BotaoPrincipal>
      }
    >
      <div style={estilos.navegacao}>
        <button
          type="button"
          style={estilos.seta}
          aria-label="Fatura anterior"
          disabled={!acompanhada || ciclo.fechamento <= primeiro.fechamento}
          onClick={() => setFechamento(cicloSeguinte(ciclo, cartao, -1).fechamento)}
        >
          <ChevronLeft size={18} />
        </button>
        <p style={estilos.datas}>
          Fecha {diaEMes(ciclo.fechamento)} · vence {diaEMes(ciclo.vencimento)} · <b>{estado}</b>
        </p>
        <button
          type="button"
          style={estilos.seta}
          aria-label="Próxima fatura"
          onClick={() => setFechamento(cicloSeguinte(ciclo, cartao).fechamento)}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div style={estilos.resumo}>
        <div>
          <small style={estilos.rotulo}>{f.estado === "fechada" ? "Total" : "Já gastou"}</small>
          <div className="fatura-gasto" style={estilos.grande}>{dinheiro(f.gasto)}</div>
        </div>
        {f.previsto > 0 && (
          <div style={{ textAlign: "right" }}>
            <small style={estilos.rotulo}>Fatura prevista</small>
            <div style={estilos.medio}>≈ {dinheiro(f.total)}</div>
          </div>
        )}
      </div>

      {metaTotal ? (
        metaEssenciais != null ? (
          <>
            <Barra rotulo="Essenciais" usado={f.essenciais.gasto} previsto={f.essenciais.previsto} meta={metaEssenciais} cor="var(--destaque-texto)" />
            <Barra rotulo="Livre" usado={f.livre.gasto} previsto={f.livre.previsto} meta={metaTotal - metaEssenciais} cor="var(--text-soft)" />
          </>
        ) : (
          <Barra rotulo="Meta" usado={f.gasto} previsto={f.previsto} meta={metaTotal} cor="var(--destaque-texto)" />
        )
      ) : (
        <p style={estilos.semMeta}>
          Essenciais {dinheiro(f.essenciais.gasto + f.essenciais.previsto)} · Livre {dinheiro(f.livre.gasto + f.livre.previsto)} ·{" "}
          <button type="button" style={estilos.link} onClick={props.onConfigurar}>
            definir meta
          </button>
        </p>
      )}

      {!acompanhada && (
        <p style={estilos.aviso}>
          Antes de começar a acompanhar o cartão: esta fatura foi lançada à mão e não entra na conta daqui.
        </p>
      )}

      {aMao.map((l) => (
        <div key={l.id} style={estilos.aviso} role="note">
          <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ flex: 1 }}>
            “{l.descricao}” ({dinheiro(l.valor)}, {diaEMes(l.data!)}) parece esta fatura lançada à mão. As duas contam no saldo.
          </span>
          <button type="button" style={estilos.avisoBotao} onClick={() => props.onApagarLancamento(l)}>
            Apagar
          </button>
        </div>
      ))}

      {f.estado !== "fechada" && (
        <>
          <div style={estilos.dia}>
            <span>
              PREVISTOS <span style={estilos.diaSub}>· até fechar</span>
            </span>
            <button type="button" style={estilos.link} onClick={props.onNovoPrevisto}>
              + previsto
            </button>
          </div>
          {f.previstos.length === 0 ? (
            <p style={estilos.vazio}>
              Gasto que se repete, como o lanche de toda sexta? Com ele aqui, a fatura prevista já conta com isso.
            </p>
          ) : (
            f.previstos.map((p) => (
              <button key={p.previsto.id} type="button" style={estilos.linha} onClick={() => props.onEditarPrevisto(p.previsto)}>
                <span style={estilos.iconePrevisto} aria-hidden="true">
                  <Repeat size={16} />
                </span>
                <span style={estilos.textos}>
                  <span style={estilos.descricao}>{p.previsto.descricao}</span>
                  {/* O valor de cada vez fica no formulário; aqui, quando ainda cai. */}
                  <span style={estilos.sub}>
                    {p.previsto.frequencia === "semanal" ? `toda ${DIAS_SEMANA[p.previsto.dia_semana ?? 0]}` : `todo dia ${p.previsto.dia_mes}`} ·{" "}
                    {listaDeDias(p.datas)}
                  </span>
                </span>
                <span style={{ ...estilos.valor, opacity: 0.7 }}>− {dinheiro(p.centavos / 100)}</span>
              </button>
            ))
          )}
          {/* Previsto sem nenhum dia nesta fatura (ou pausado) ainda precisa ser alcançável. */}
          {previstos
            .filter((p) => !f.previstos.some((x) => x.previsto.id === p.id))
            .map((p) => (
              <button key={p.id} type="button" style={{ ...estilos.linha, opacity: 0.6 }} onClick={() => props.onEditarPrevisto(p)}>
                <span style={estilos.iconePrevisto} aria-hidden="true">
                  <Repeat size={16} />
                </span>
                <span style={estilos.textos}>
                  <span style={estilos.descricao}>{p.descricao}</span>
                  <span style={estilos.sub}>{p.ativo ? "nenhum dia até o fechamento" : "pausado"}</span>
                </span>
              </button>
            ))}
        </>
      )}

      {f.itens.length === 0 ? (
        <p style={{ ...estilos.vazio, marginTop: 14 }}>Nenhuma compra nesta fatura.</p>
      ) : (
        f.itens.map((item, i) => {
          const novoDia = i === 0 || f.itens[i - 1].compra.data !== item.compra.data;
          const totalDia = novoDia
            ? f.itens.filter((x) => x.compra.data === item.compra.data).reduce((s, x) => s + x.centavos, 0) / 100
            : 0;
          const ComoIcone = item.compra.como === "online" ? Globe : item.compra.como === "aproximacao" ? Nfc : null;
          return (
            <div key={`${item.compra.id}-${item.numero}`}>
              {novoDia && (
                <div style={estilos.dia}>
                  <span>{(item.compra.data === hoje ? "Hoje" : rotuloCurto(item.compra.data)).toUpperCase()}</span>
                  <span style={estilos.diaTotal}>− {dinheiro(totalDia)}</span>
                </div>
              )}
              <button type="button" style={estilos.linha} onClick={() => props.onEditarCompra(item.compra)}>
                <IconeCategoria tipo="saida" categoria={item.compra.categoria} tamanho={36} />
                <span style={estilos.textos}>
                  <span style={estilos.descricao}>{item.compra.descricao || "—"}</span>
                  <span style={estilos.sub}>
                    {ComoIcone && <ComoIcone size={12} aria-label={item.compra.como === "online" ? "online" : "por aproximação"} />}
                    {item.compra.categoria} ·{" "}
                    <span style={item.essencial ? estilos.essencial : undefined}>{item.essencial ? "essencial" : "livre"}</span>
                    {item.de > 1 && ` · ${item.numero}/${item.de}`}
                  </span>
                </span>
                <span style={estilos.valor}>− {dinheiro(item.centavos / 100)}</span>
              </button>
            </div>
          );
        })
      )}

      <button type="button" style={estilos.config} onClick={props.onConfigurar}>
        <Settings2 size={15} aria-hidden="true" /> Datas e meta do cartão
      </button>
    </Folha>
  );
}

function Barra({ rotulo, usado, previsto, meta, cor }: { rotulo: string; usado: number; previsto: number; meta: number; cor: string }) {
  const dinheiro = useDinheiro();
  const base = meta > 0 ? meta : 1;
  const p = Math.min(100, (usado / base) * 100);
  const q = Math.min(100 - p, (previsto / base) * 100);
  const resta = Math.round((meta - usado - previsto) * 100) / 100;
  return (
    <div style={estilos.barra}>
      <div style={estilos.barraTopo}>
        <span>{rotulo}</span>
        <span>
          <b style={{ color: "var(--text)" }}>{dinheiro(usado)}</b>
          {previsto > 0 && <span style={estilos.fraco}> + {dinheiro(previsto)} previsto</span>}
          <span style={estilos.fraco}> de {dinheiro(meta)}</span>
        </span>
      </div>
      <div style={estilos.trilho} aria-hidden="true">
        <div style={{ width: `${p}%`, background: cor }} />
        <div style={{ width: `${q}%`, background: `repeating-linear-gradient(135deg, ${cor} 0 4px, transparent 4px 7px)`, opacity: 0.55 }} />
      </div>
      <div style={{ ...estilos.resta, color: resta < 0 ? "var(--red)" : "var(--text-faint)" }}>
        {resta >= 0 ? `sobram ${dinheiro(resta)}` : `passou ${dinheiro(-resta)}`}
      </div>
    </div>
  );
}

const estilos: Record<string, CSSProperties> = {
  navegacao: { display: "flex", alignItems: "center", gap: 6, margin: "-6px 0 6px" },
  seta: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: "50%",
    borderWidth: 0,
    borderStyle: "solid",
    background: "var(--bg)",
    color: "var(--text-soft)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  datas: { flex: 1, textAlign: "center", fontSize: 12.5, color: "var(--text-faint)" },
  resumo: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, margin: "10px 0 6px" },
  rotulo: { fontSize: 12.5, color: "var(--text-soft)" },
  grande: { fontFamily: "'Sora', sans-serif", fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" },
  medio: { fontFamily: "'Sora', sans-serif", fontSize: 17, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  barra: { marginTop: 10 },
  barraTopo: { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, color: "var(--text-soft)" },
  fraco: { color: "var(--text-faint)", fontSize: 12 },
  trilho: { display: "flex", height: 8, borderRadius: 5, background: "var(--border)", overflow: "hidden", marginTop: 6 },
  resta: { fontSize: 11.5, marginTop: 4, textAlign: "right" },
  semMeta: { fontSize: 13, color: "var(--text-soft)", marginTop: 6 },
  link: {
    background: "none",
    borderWidth: 0,
    borderStyle: "solid",
    padding: "6px 0",
    color: "var(--destaque-texto)",
    fontSize: 13,
    fontWeight: 700,
  },
  aviso: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    padding: "11px 12px",
    borderRadius: 12,
    background: "var(--red-soft)",
    color: "var(--text)",
    fontSize: 13,
    lineHeight: 1.45,
  },
  avisoBotao: {
    flexShrink: 0,
    background: "none",
    borderWidth: 0,
    borderStyle: "solid",
    color: "var(--red)",
    fontWeight: 700,
    fontSize: 13,
    padding: "2px 0",
    textDecoration: "underline",
  },
  dia: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: "14px 2px 4px",
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: "0.07em",
    color: "var(--text-faint)",
  },
  diaSub: { letterSpacing: 0, fontWeight: 500 },
  diaTotal: { letterSpacing: 0, fontWeight: 600, fontSize: 12, fontVariantNumeric: "tabular-nums" },
  vazio: { fontSize: 13, color: "var(--text-faint)", lineHeight: 1.45, padding: "2px 2px 0" },
  linha: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 2px",
    background: "none",
    borderWidth: 0,
    borderStyle: "solid",
    textAlign: "left",
    color: "var(--text)",
  },
  iconePrevisto: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--accent-soft)",
    color: "var(--destaque-texto)",
  },
  textos: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 },
  descricao: { fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  sub: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12.5,
    color: "var(--text-faint)",
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
  essencial: { color: "var(--destaque-texto)", fontWeight: 600 },
  valor: { fontSize: 15, fontWeight: 700, color: "var(--red)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  config: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
    marginTop: 16,
    minHeight: 40,
    background: "none",
    borderWidth: 0,
    borderStyle: "solid",
    color: "var(--text-soft)",
    fontSize: 13.5,
    fontWeight: 600,
  },
};
