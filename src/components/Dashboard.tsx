import { useEffect, useMemo, useState } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  Plus, Trash2, Pencil, Wallet, TrendingUp, TrendingDown, Calendar, LogOut,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  listarLancamentos, criarLancamento, atualizarLancamento, removerLancamento,
} from "../lib/lancamentos";
import { CATEGORIAS_SAIDA, CATEGORIAS_ENTRADA, MESES } from "../types";
import type { Lancamento, NovoLancamento } from "../types";
import { brl } from "../lib/format";
import Card from "./Card";
import ModalNovo from "./ModalNovo";
import ConfirmModal from "./ConfirmModal";

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
  const ano = new Date().getFullYear();
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [confirmarId, setConfirmarId] = useState<string | null>(null);

  useEffect(() => {
    listarLancamentos()
      .then(setLancamentos)
      .catch((e) => console.error(e))
      .finally(() => setCarregando(false));
  }, []);

  async function adicionar(item: NovoLancamento) {
    const novo = await criarLancamento(item);
    setLancamentos((atual) => [novo, ...atual]);
    setModal(false);
  }

  async function editar(item: NovoLancamento) {
    if (!editando) return;
    const atualizado = await atualizarLancamento(editando.id, item);
    setLancamentos((atual) =>
      atual.map((l) => (l.id === atualizado.id ? atualizado : l))
    );
    setEditando(null);
  }

  async function confirmarRemocao() {
    if (!confirmarId) return;
    const id = confirmarId;
    setConfirmarId(null);
    await removerLancamento(id);
    setLancamentos((atual) => atual.filter((l) => l.id !== id));
  }

  function dataOrdenacao(l: Lancamento): string {
    return l.data ?? l.created_at.slice(0, 10);
  }

  const doMes = useMemo(
    () =>
      lancamentos
        .filter((l) => l.mes === mes && l.ano === ano)
        .slice()
        .sort((a, b) => {
          const cmp = dataOrdenacao(b).localeCompare(dataOrdenacao(a));
          if (cmp !== 0) return cmp;
          return b.created_at.localeCompare(a.created_at);
        }),
    [lancamentos, mes, ano]
  );

  const renda = doMes
    .filter((l) => l.tipo === "entrada")
    .reduce((s, l) => s + l.valor, 0);
  const gastos = doMes
    .filter((l) => l.tipo === "saida")
    .reduce((s, l) => s + l.valor, 0);

  const saldoAcumulado = useMemo(() => {
    return lancamentos
      .filter((l) => l.ano < ano || (l.ano === ano && l.mes <= mes))
      .reduce((s, l) => s + (l.tipo === "entrada" ? l.valor : -l.valor), 0);
  }, [lancamentos, mes, ano]);

  const porCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    doMes
      .filter((l) => l.tipo === "saida")
      .forEach((l) => (map[l.categoria] = (map[l.categoria] || 0) + l.valor));
    return CATEGORIAS_SAIDA.map((c) => ({
      name: c.nome,
      value: map[c.nome] || 0,
      cor: c.cor,
    })).filter((c) => c.value > 0);
  }, [doMes]);

  const anual = useMemo(
    () =>
      MESES.map((m, i) => {
        const ls = lancamentos.filter((l) => l.mes === i && l.ano === ano);
        const r = ls
          .filter((l) => l.tipo === "entrada")
          .reduce((s, l) => s + l.valor, 0);
        const g = ls
          .filter((l) => l.tipo === "saida")
          .reduce((s, l) => s + l.valor, 0);
        return { mes: m.slice(0, 3), sobra: r - g };
      }),
    [lancamentos, ano]
  );

  const email = session.user.email ?? "";

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <div style={styles.logo}>
            <Wallet size={22} color="var(--accent)" strokeWidth={2.2} />
          </div>
          <div>
            <h1 style={styles.title}>Minhas Finanças</h1>
            <p style={styles.user}>{email}</p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.mesSel}>
            <Calendar size={15} color="var(--text-faint)" />
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              style={styles.select}
            >
              {MESES.map((m, i) => (
                <option key={i} value={i}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <button
            style={styles.sair}
            onClick={() => supabase.auth.signOut()}
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
        />
      </div>

      <div style={styles.grid}>
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Gastos por categoria</h2>
          {porCategoria.length === 0 ? (
            <p style={styles.vazio}>Sem gastos lançados neste mês.</p>
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
                    {porCategoria.map((e, i) => (
                      <Cell key={i} fill={e.cor} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => brl(v)}
                    contentStyle={tooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={styles.legend}>
                {porCategoria.map((c, i) => (
                  <span key={i} style={styles.legendItem}>
                    <span style={{ ...styles.dot, background: c.cor }} />
                    {c.name} · {brl(c.value)}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={styles.panel}>
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
                {anual.map((e, i) => (
                  <Cell
                    key={i}
                    fill={e.sobra >= 0 ? "var(--green)" : "var(--red)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={styles.panel}>
        <div style={styles.listHead}>
          <h2 style={styles.panelTitle}>Lançamentos de {MESES[mes]}</h2>
          <button style={styles.add} onClick={() => setModal(true)}>
            <Plus size={16} /> Novo
          </button>
        </div>
        {carregando ? (
          <p style={styles.vazio}>Carregando...</p>
        ) : doMes.length === 0 ? (
          <p style={styles.vazio}>
            Nenhum lançamento ainda. Clique em "Novo" para começar.
          </p>
        ) : (
          <div style={styles.list}>
            {doMes.map((l) => {
              const lista =
                l.tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
              const cat = lista.find((c) => c.nome === l.categoria);
              const cor =
                cat?.cor ??
                (l.tipo === "entrada" ? "var(--green)" : "#9aa3b0");
              const dia = Number(dataOrdenacao(l).slice(8, 10));
              return (
                <div key={l.id} style={styles.item}>
                  <span style={styles.dia}>{dia}</span>
                  <span
                    style={{
                      ...styles.tag,
                      background: cor + "1f",
                      color: cor,
                    }}
                  >
                    {l.categoria}
                  </span>
                  <span style={styles.desc}>{l.descricao || "—"}</span>
                  <span
                    style={{
                      ...styles.valor,
                      color: l.tipo === "entrada" ? "var(--green)" : "var(--red)",
                    }}
                  >
                    {l.tipo === "entrada" ? "+" : "−"} {brl(l.valor)}
                  </span>
                  <button
                    style={styles.acao}
                    onClick={() => setEditando(l)}
                    title="Editar"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    style={styles.acao}
                    onClick={() => setConfirmarId(l.id)}
                    title="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && (
        <ModalNovo
          onFechar={() => setModal(false)}
          onSalvar={adicionar}
        />
      )}

      {editando && (
        <ModalNovo
          lancamentoParaEditar={editando}
          onFechar={() => setEditando(null)}
          onSalvar={editar}
        />
      )}

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
  mesSel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    padding: "9px 14px",
    borderRadius: 12,
  },
  select: {
    border: "none",
    background: "transparent",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
    outline: "none",
  },
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
  vazio: {
    textAlign: "center",
    color: "var(--text-faint)",
    padding: "30px 0",
    fontSize: 14,
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
    display: "grid",
    gridTemplateColumns: "auto auto 1fr auto auto auto",
    alignItems: "center",
    gap: 12,
    background: "var(--bg)",
    padding: "12px 14px",
    borderRadius: 12,
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
  },
  desc: {
    fontSize: 14,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  valor: {
    fontFamily: "'Sora', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  del: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
    padding: 4,
  },
  acao: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
    padding: 4,
    cursor: "pointer",
  },
};
