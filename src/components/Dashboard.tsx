import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  Plus, Trash2, Pencil, Wallet, TrendingUp, TrendingDown, LogOut,
  Receipt, PieChart as PieIcon, AlertTriangle, RotateCw, Clock,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  listarLancamentos, criarLancamento, atualizarLancamento, removerLancamento,
} from "../lib/lancamentos";
import { CATEGORIAS_SAIDA, CATEGORIAS_ENTRADA, MESES } from "../types";
import type { Lancamento, NovoLancamento } from "../types";
import { brl } from "../lib/format";
import {
  agruparPorCategoria,
  calcularBalancoAnual,
  calcularPendentes,
  calcularSaldoAcumulado,
  calcularSaldoProjetado,
  filtrarPorMes,
  hojeLocal,
  somarPorTipo,
} from "../lib/calculos";
import Card from "./Card";
import MonthPicker from "./MonthPicker";
import { useSwipe } from "../hooks/useSwipe";
import ModalNovo from "./ModalNovo";
import ConfirmModal from "./ConfirmModal";
import Toast, { type ToastDados } from "./Toast";
import EmptyState from "./EmptyState";
import { SkeletonLista } from "./Skeleton";
import BottomNav from "./BottomNav";
import ContasAPagar from "./ContasAPagar";

function dataInicialNovoLancamento(mes: number, ano: number): string {
  const hoje = new Date();
  if (hoje.getFullYear() === ano && hoje.getMonth() === mes) {
    return hojeLocal();
  }
  const mm = String(mes + 1).padStart(2, "0");
  return `${ano}-${mm}-01`;
}

const tooltipStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 13,
  boxShadow: "var(--shadow)",
};

export default function Dashboard({ session }: { session: Session }) {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mes, setMes] = useState(new Date().getMonth());
  const [ano, setAno] = useState(new Date().getFullYear());
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [confirmarId, setConfirmarId] = useState<string | null>(null);
  const [tipoGrafico, setTipoGrafico] = useState<"saida" | "entrada">("saida");
  const [toast, setToast] = useState<ToastDados | null>(null);
  const [erroCarregar, setErroCarregar] = useState(false);
  const [tooltipFuturoId, setTooltipFuturoId] = useState<string | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<"inicio" | "contas">("inicio");
  const longPressTimer = useRef<number | null>(null);
  const tooltipAutoHide = useRef<number | null>(null);
  const hoverDelayTimer = useRef<number | null>(null);

  function limparHoverDelay() {
    if (hoverDelayTimer.current !== null) {
      window.clearTimeout(hoverDelayTimer.current);
      hoverDelayTimer.current = null;
    }
  }

  function limparLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function abrirTooltipFuturo(id: string) {
    setTooltipFuturoId(id);
    if (tooltipAutoHide.current !== null) {
      window.clearTimeout(tooltipAutoHide.current);
    }
    tooltipAutoHide.current = window.setTimeout(() => {
      setTooltipFuturoId(null);
      tooltipAutoHide.current = null;
    }, 2000);
  }

  useEffect(() => {
    if (!tooltipFuturoId) return;
    function fechar() {
      setTooltipFuturoId(null);
      if (tooltipAutoHide.current !== null) {
        window.clearTimeout(tooltipAutoHide.current);
        tooltipAutoHide.current = null;
      }
    }
    window.addEventListener("touchstart", fechar, { passive: true });
    return () => window.removeEventListener("touchstart", fechar);
  }, [tooltipFuturoId]);

  useEffect(() => {
    return () => {
      limparLongPress();
      limparHoverDelay();
      if (tooltipAutoHide.current !== null) {
        window.clearTimeout(tooltipAutoHide.current);
      }
    };
  }, []);

  const mostrarToast = useCallback(
    (tipo: ToastDados["tipo"], mensagem: string) => {
      setToast({ id: Date.now(), tipo, mensagem });
    },
    []
  );

  const carregar = useCallback(() => {
    setCarregando(true);
    setErroCarregar(false);
    listarLancamentos()
      .then(setLancamentos)
      .catch((e) => {
        console.error(e);
        setErroCarregar(true);
      })
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function adicionar(item: NovoLancamento) {
    try {
      const novo = await criarLancamento(item);
      setLancamentos((atual) => [novo, ...atual]);
      setModal(false);
      mostrarToast("sucesso", "Lançamento salvo!");
    } catch (e) {
      console.error(e);
      mostrarToast("erro", "Não foi possível salvar. Verifique sua conexão.");
    }
  }

  async function editar(item: NovoLancamento) {
    if (!editando) return;
    const original = editando;
    const otimista: Lancamento = { ...original, ...item };
    setLancamentos((atual) =>
      atual.map((l) => (l.id === original.id ? otimista : l))
    );
    setEditando(null);
    try {
      const atualizado = await atualizarLancamento(original.id, item);
      setLancamentos((atual) =>
        atual.map((l) => (l.id === atualizado.id ? atualizado : l))
      );
      mostrarToast("sucesso", "Lançamento atualizado!");
    } catch (e) {
      console.error(e);
      setLancamentos((atual) =>
        atual.map((l) => (l.id === original.id ? original : l))
      );
      mostrarToast("erro", "Não foi possível salvar. Verifique sua conexão.");
    }
  }

  async function confirmarRemocao() {
    if (!confirmarId) return;
    const id = confirmarId;
    setConfirmarId(null);
    const anterior = lancamentos;
    const index = anterior.findIndex((l) => l.id === id);
    if (index === -1) return;
    setLancamentos((atual) => atual.filter((l) => l.id !== id));
    try {
      await removerLancamento(id);
      mostrarToast("sucesso", "Lançamento excluído.");
    } catch (e) {
      console.error(e);
      setLancamentos(anterior);
      mostrarToast("erro", "Não foi possível excluir. Verifique sua conexão.");
    }
  }

  function dataOrdenacao(l: Lancamento): string {
    return l.data ?? l.created_at.slice(0, 10);
  }

  const doMes = useMemo(
    () =>
      filtrarPorMes(lancamentos, mes, ano)
        .slice()
        .sort((a, b) => {
          const cmp = dataOrdenacao(b).localeCompare(dataOrdenacao(a));
          if (cmp !== 0) return cmp;
          return b.created_at.localeCompare(a.created_at);
        }),
    [lancamentos, mes, ano]
  );

  const renda = somarPorTipo(doMes, "entrada");
  const gastos = somarPorTipo(doMes, "saida");

  const saldoAcumulado = useMemo(
    () => calcularSaldoAcumulado(lancamentos, mes, ano),
    [lancamentos, mes, ano]
  );

  const pendentes = useMemo(
    () => calcularPendentes(lancamentos, mes, ano),
    [lancamentos, mes, ano]
  );

  const saldoProjetado = useMemo(
    () => calcularSaldoProjetado(saldoAcumulado, pendentes),
    [saldoAcumulado, pendentes]
  );

  const porCategoria = useMemo(
    () =>
      agruparPorCategoria(
        doMes,
        tipoGrafico,
        tipoGrafico === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA
      ),
    [doMes, tipoGrafico]
  );

  const anual = useMemo(
    () => calcularBalancoAnual(lancamentos, ano, MESES),
    [lancamentos, ano]
  );

  const email = session.user.email ?? "";

  function avancarMes() {
    if (mes === 11) {
      setMes(0);
      setAno((a) => a + 1);
    } else {
      setMes((m) => m + 1);
    }
  }

  function recuarMes() {
    if (mes === 0) {
      setMes(11);
      setAno((a) => a - 1);
    } else {
      setMes((m) => m - 1);
    }
  }

  const swipeHandlers = useSwipe({
    onSwipeLeft: avancarMes,
    onSwipeRight: recuarMes,
    threshold: 50,
  });

  return (
    <div
      style={styles.page}
      className="page-root page-com-bottom-nav"
      onTouchStart={swipeHandlers.onTouchStart}
      onTouchEnd={swipeHandlers.onTouchEnd}
    >
      {abaAtiva === "inicio" ? (
      <>
      <header style={styles.header}>
        <div style={styles.brand}>
          <div style={styles.logo}>
            <Wallet size={22} color="var(--accent)" strokeWidth={2.2} />
          </div>
          <div>
            <h1 style={styles.title} className="app-title">Minhas Finanças</h1>
            <p style={styles.user}>{email}</p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <MonthPicker
            mes={mes}
            ano={ano}
            onChange={(m, a) => {
              setMes(m);
              setAno(a);
            }}
          />
          <button
            style={styles.sair}
            onClick={() => supabase.auth.signOut()}
            aria-label="Sair"
            title="Sair"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <div style={styles.cards}>
        <Card
          label="Renda"
          valor={renda}
          icon={<TrendingUp size={18} />}
          cor="var(--green)"
        />
        <Card
          label="Gastos"
          valor={gastos}
          icon={<TrendingDown size={18} />}
          cor="var(--red)"
        />
        <Card
          label="Saldo atual"
          valor={saldoAcumulado}
          icon={<Wallet size={18} />}
          cor={saldoAcumulado >= 0 ? "var(--accent)" : "var(--red)"}
          destaque
          pendente={pendentes}
          saldoProjetado={
            pendentes.entradas.quantidade > 0 || pendentes.saidas.quantidade > 0
              ? saldoProjetado
              : undefined
          }
        />
      </div>

      <div style={styles.grid}>
        <div style={styles.panel} className="panel-mobile">
          <div style={styles.panelHead}>
            <h2 style={styles.panelTitleInline}>
              {tipoGrafico === "entrada" ? "Entradas por categoria" : "Gastos por categoria"}
            </h2>
            <div style={styles.toggle}>
              <button
                style={{
                  ...styles.toggleBtn,
                  ...(tipoGrafico === "saida" ? styles.toggleBtnAtivo : {}),
                }}
                onClick={() => setTipoGrafico("saida")}
              >
                Saídas
              </button>
              <button
                style={{
                  ...styles.toggleBtn,
                  ...(tipoGrafico === "entrada" ? styles.toggleBtnAtivo : {}),
                }}
                onClick={() => setTipoGrafico("entrada")}
              >
                Entradas
              </button>
            </div>
          </div>
          {porCategoria.length === 0 ? (
            <div style={{ minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <EmptyState
                compacto
                icon={<PieIcon size={22} />}
                titulo={
                  tipoGrafico === "entrada"
                    ? "Sem entradas lançadas neste mês."
                    : "Sem gastos lançados neste mês."
                }
              />
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={porCategoria}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {porCategoria.map((e) => (
                      <Cell key={e.name} fill={e.cor} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => brl(v)}
                    contentStyle={tooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={styles.legend}>
                {porCategoria.map((c) => (
                  <span key={c.name} style={styles.legendItem}>
                    <span style={{ ...styles.dot, background: c.cor }} />
                    {c.name} · {brl(c.value)}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={styles.panel} className="panel-mobile">
          <h2 style={styles.panelTitle}>Quanto sobrou no ano</h2>
          <ResponsiveContainer width="100%" height={290}>
            <BarChart
              data={anual}
              margin={{ top: 10, right: 6, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="mes"
                tick={{ fill: "var(--text-faint)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--text-faint)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v: number) => brl(v)}
                contentStyle={tooltipStyle}
                cursor={{ fill: "rgba(0,0,0,0.03)" }}
              />
              <Bar dataKey="sobra" radius={[5, 5, 0, 0]}>
                {anual.map((e) => (
                  <Cell
                    key={e.mes}
                    fill={e.sobra >= 0 ? "var(--green)" : "var(--red)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={styles.panel} className="panel-mobile">
        <div style={styles.listHead}>
          <h2 style={styles.panelTitle}>Lançamentos de {MESES[mes]}</h2>
          <button style={styles.add} onClick={() => setModal(true)}>
            <Plus size={16} /> Novo
          </button>
        </div>
        {carregando ? (
          <SkeletonLista linhas={4} />
        ) : erroCarregar ? (
          <div style={styles.erroBox}>
            <div style={styles.erroIcone}>
              <AlertTriangle size={22} />
            </div>
            <p style={styles.erroTitulo}>
              Não foi possível carregar seus lançamentos.
            </p>
            <button style={styles.retry} onClick={carregar}>
              <RotateCw size={14} /> Tentar novamente
            </button>
          </div>
        ) : doMes.length === 0 ? (
          <EmptyState
            icon={<Receipt size={24} />}
            titulo="Nenhum lançamento ainda."
            sugestao="Clique em 'Novo' para adicionar seu primeiro lançamento."
          />
        ) : (
          <div style={styles.list}>
            {doMes.map((l, idx) => {
              const lista =
                l.tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
              const cat = lista.find((c) => c.nome === l.categoria);
              const cor =
                cat?.cor ??
                (l.tipo === "entrada" ? "var(--green)" : "#9aa3b0");
              const dia = Number(dataOrdenacao(l).slice(8, 10));
              const futuro = !!l.data && l.data > hojeLocal();
              const dataFmt = futuro
                ? `${l.data!.slice(8, 10)}/${l.data!.slice(5, 7)}`
                : "";
              const titleFuturo = futuro
                ? `Será contabilizado em ${dataFmt} · ${brl(l.valor)}`
                : undefined;
              const corBorda =
                l.tipo === "entrada" ? "var(--green)" : "var(--red)";
              const itemStyle: React.CSSProperties = futuro
                ? {
                    ...styles.item,
                    background: "var(--bg)",
                    boxShadow: "none",
                    position: "relative",
                  }
                : {
                    ...styles.item,
                    background: "var(--surface)",
                    boxShadow: "var(--shadow)",
                    borderLeft: `3px solid ${corBorda}`,
                    position: "relative",
                  };
              return (
                <div
                  key={l.id}
                  style={itemStyle}
                  title={futuro ? undefined : titleFuturo}
                  onTouchStart={
                    futuro
                      ? () => {
                          limparLongPress();
                          longPressTimer.current = window.setTimeout(() => {
                            abrirTooltipFuturo(l.id);
                            longPressTimer.current = null;
                          }, 500);
                        }
                      : undefined
                  }
                  onTouchEnd={futuro ? limparLongPress : undefined}
                  onTouchMove={futuro ? limparLongPress : undefined}
                  onTouchCancel={futuro ? limparLongPress : undefined}
                  onMouseEnter={
                    futuro
                      ? () => {
                          limparHoverDelay();
                          hoverDelayTimer.current = window.setTimeout(() => {
                            setTooltipFuturoId(l.id);
                            hoverDelayTimer.current = null;
                          }, 700);
                        }
                      : undefined
                  }
                  onMouseLeave={
                    futuro
                      ? () => {
                          limparHoverDelay();
                          setTooltipFuturoId(null);
                        }
                      : undefined
                  }
                >
                  {futuro && tooltipFuturoId === l.id && (
                    <div
                      style={
                        idx === 0
                          ? styles.tooltipFuturoAbaixo
                          : styles.tooltipFuturo
                      }
                    >
                      Será contabilizado em {dataFmt} · {brl(l.valor)}
                      <span
                        style={
                          idx === 0
                            ? styles.tooltipSetaCima
                            : styles.tooltipSetaBaixo
                        }
                      />
                    </div>
                  )}
                  <div style={styles.itemTopo}>
                    {futuro ? (
                      <span
                        style={{
                          ...styles.dia,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Clock size={13} color="var(--text-faint)" />
                        {dia}
                      </span>
                    ) : (
                      <span style={styles.dia}>{dia}</span>
                    )}
                    <span
                      style={{
                        ...styles.tag,
                        background: cor + "1f",
                        color: cor,
                      }}
                    >
                      {l.categoria}
                    </span>
                    <span
                      style={{
                        ...styles.valor,
                        color: l.tipo === "entrada" ? "var(--green)" : "var(--red)",
                      }}
                    >
                      {l.tipo === "entrada" ? "+" : "−"} {brl(l.valor)}
                    </span>
                  </div>
                  <div style={styles.itemBase}>
                    <span style={styles.desc}>{l.descricao || "—"}</span>
                    <div style={styles.acoes}>
                      <button
                        style={styles.acao}
                        onClick={() => setEditando(l)}
                        aria-label="Editar lançamento"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        style={styles.acao}
                        onClick={() => setConfirmarId(l.id)}
                        aria-label="Excluir lançamento"
                        title="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>
      ) : (
        <ContasAPagar />
      )}

      {modal && (
        <ModalNovo
          onFechar={() => setModal(false)}
          onSalvar={adicionar}
          dataInicial={dataInicialNovoLancamento(mes, ano)}
        />
      )}

      {editando && (
        <ModalNovo
          lancamentoParaEditar={editando}
          onFechar={() => setEditando(null)}
          onSalvar={editar}
        />
      )}

      {toast && <Toast toast={toast} onFechar={() => setToast(null)} />}

      {confirmarId && (
        <ConfirmModal
          titulo="Excluir lançamento"
          mensagem="Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita."
          textoConfirmar="Excluir"
          textoCancelar="Cancelar"
          onConfirmar={confirmarRemocao}
          onCancelar={() => setConfirmarId(null)}
        />
      )}

      <BottomNav
        abaAtiva={abaAtiva}
        onNavegar={(aba) => {
          setModal(false);
          setEditando(null);
          setConfirmarId(null);
          setAbaAtiva(aba);
        }}
        onNovo={() => setModal(true)}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1060, margin: "0 auto", padding: "28px 20px 60px" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 26,
    flexWrap: "wrap",
    gap: 14,
  },
  brand: { display: "flex", alignItems: "center", gap: 12 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "var(--accent-soft)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontWeight: 700 },
  user: { fontSize: 12.5, color: "var(--text-faint)" },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  sair: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-soft)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 14,
    marginBottom: 16,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
    gap: 16,
    marginBottom: 16,
  },
  panel: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 22,
    boxShadow: "var(--shadow)",
  },
  panelTitle: { fontSize: 16, fontWeight: 600, marginBottom: 14 },
  panelHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  panelTitleInline: { fontSize: 16, fontWeight: 600 },
  toggle: {
    display: "flex",
    gap: 3,
    background: "var(--bg)",
    padding: 3,
    borderRadius: 9,
  },
  toggleBtn: {
    padding: "4px 10px",
    border: "none",
    borderRadius: 7,
    background: "transparent",
    color: "var(--text-faint)",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
  },
  toggleBtnAtivo: {
    background: "var(--surface)",
    color: "var(--text)",
    boxShadow: "var(--shadow)",
  },
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 16px",
    marginTop: 8,
    fontSize: 12.5,
    color: "var(--text-soft)",
  },
  legendItem: { display: "flex", alignItems: "center", gap: 6 },
  dot: { width: 9, height: 9, borderRadius: "50%" },
  listHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  add: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    padding: "9px 16px",
    borderRadius: 11,
    fontWeight: 600,
    fontSize: 14,
  },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  item: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    background: "var(--bg)",
    padding: "12px 14px",
    borderRadius: 12,
    minWidth: 0,
  },
  itemTopo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  itemBase: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  erroBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    padding: "30px 16px",
    gap: 10,
  },
  erroIcone: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: "var(--red-soft)",
    color: "var(--red)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  erroTitulo: {
    fontSize: 14,
    color: "var(--text-soft)",
    fontWeight: 500,
  },
  retry: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    padding: "8px 14px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    marginTop: 4,
  },
  acoes: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    marginLeft: "auto",
    flexShrink: 0,
  },
  dia: {
    fontFamily: "'Sora', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-faint)",
    minWidth: 22,
    textAlign: "center",
  },
  tag: {
    fontSize: 12,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 7,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0,
  },
  desc: {
    fontSize: 14,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
    minWidth: 0,
  },
  valor: {
    fontFamily: "'Sora', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    whiteSpace: "nowrap",
    marginLeft: "auto",
    flexShrink: 0,
  },
  acao: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
    padding: 4,
    cursor: "pointer",
  },
  tooltipFuturo: {
    position: "absolute",
    bottom: "calc(100% + 6px)",
    left: 8,
    background: "#0d0d0d",
    color: "#fff",
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 8,
    padding: "6px 10px",
    whiteSpace: "nowrap",
    boxShadow: "0 6px 18px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)",
    zIndex: 200,
    pointerEvents: "none",
    opacity: 1,
    lineHeight: 1.35,
  },
  tooltipFuturoAbaixo: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 8,
    background: "#0d0d0d",
    color: "#fff",
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 8,
    padding: "6px 10px",
    whiteSpace: "nowrap",
    boxShadow: "0 6px 18px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)",
    zIndex: 200,
    pointerEvents: "none",
    opacity: 1,
    lineHeight: 1.35,
  },
  tooltipSetaBaixo: {
    position: "absolute",
    top: "100%",
    left: 18,
    width: 0,
    height: 0,
    borderLeft: "6px solid transparent",
    borderRight: "6px solid transparent",
    borderTop: "6px solid #0d0d0d",
  },
  tooltipSetaCima: {
    position: "absolute",
    bottom: "100%",
    left: 18,
    width: 0,
    height: 0,
    borderLeft: "6px solid transparent",
    borderRight: "6px solid transparent",
    borderBottom: "6px solid #0d0d0d",
  },
};
