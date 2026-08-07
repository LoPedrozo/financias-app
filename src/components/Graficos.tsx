import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import type { BarraMes, FatiaCategoria } from "../lib/calculos";
import { brl } from "../lib/format";

// Os dois gráficos vivem aqui só para o recharts sair do pacote principal —
// ele responde por metade do bundle e nem é usado na aba Contas. O Dashboard
// carrega este arquivo sob demanda com React.lazy.

const tooltipStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 13,
  boxShadow: "var(--shadow)",
};

export function GraficoCategorias({ dados }: { dados: FatiaCategoria[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={dados}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={85}
          paddingAngle={3}
        >
          {dados.map((e) => (
            <Cell key={e.name} fill={e.cor} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => brl(v)} contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function GraficoAnual({ dados }: { dados: BarraMes[] }) {
  return (
    <ResponsiveContainer width="100%" height={290}>
      <BarChart data={dados} margin={{ top: 10, right: 6, left: -20, bottom: 0 }}>
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
          {dados.map((e) => (
            <Cell
              key={e.mes}
              fill={e.sobra >= 0 ? "var(--green)" : "var(--red)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
