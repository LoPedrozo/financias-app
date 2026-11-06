import { useEffect, useRef, useState } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import type { BarraMes, FatiaCategoria } from "../lib/calculos";
import { useDinheiro, usePreferencias } from "../hooks/usePreferencias";
import { podeAnimar } from "../lib/movimento";
import { formatarEixo } from "../lib/format";
import { itemDoBalaoAnual, mesPorExtenso } from "../lib/graficos";

// Os dois gráficos vivem aqui só para o recharts sair do pacote principal —
// ele responde por metade do bundle e nem é usado na aba Contas. O Dashboard
// carrega este arquivo sob demanda com React.lazy.

// As barras e as fatias crescem no mesmo ritmo da barra do cartão do saldo
// (1,2s), começando na hora — o padrão do recharts era rápido demais nas
// barras (0,4s) e esperava 0,4s para começar a pizza. Com "reduzir
// movimento" ligado, aparecem prontos.
const ANIMACAO = {
  animationBegin: 0,
  animationDuration: 1200,
  animationEasing: "ease-out" as const,
};

// O balão dos dois gráficos. Sem cor de texto definida, o recharts usava a
// cor da série — que no gráfico do ano, pintado barra a barra, não existe, e
// caía num cinza escuro sobre o fundo escuro do tema: ilegível.
const balao = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    fontSize: 13,
    boxShadow: "var(--shadow)",
    color: "var(--text)",
  } as React.CSSProperties,
  labelStyle: { color: "var(--text)", fontWeight: 600, marginBottom: 2 } as React.CSSProperties,
  itemStyle: { color: "var(--text-soft)", padding: 0 } as React.CSSProperties,
  separator: ": ",
};

// No celular o balão não tem "tirar o mouse de cima": aparecia com o toque e
// ficava grudado na tela até tocar em outro lugar do gráfico. Agora some
// sozinho um pouco depois de o dedo sair. No computador nada muda — lá quem
// esconde é o mouse saindo, como sempre.
//
// O `active` do Tooltip do recharts aceita controle de fora: false esconde,
// undefined devolve o comportamento normal.
const BALAO_SOME_EM_MS = 2500;

function useBalaoQueSome() {
  const [escondido, setEscondido] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return {
    active: escondido ? false : undefined,
    aoTocar: {
      onTouchStart: () => {
        window.clearTimeout(timer.current);
        setEscondido(false);
      },
      onTouchEnd: () => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setEscondido(true), BALAO_SOME_EM_MS);
      },
    },
  };
}

export function GraficoCategorias({ dados }: { dados: FatiaCategoria[] }) {
  const dinheiro = useDinheiro();
  const { active, aoTocar } = useBalaoQueSome();
  return (
    <div {...aoTocar}>
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
            // O contorno padrão é branco: no tema escuro desenhava um aro
            // claro em volta de cada fatia. Na cor do card, ele só separa.
            stroke="var(--surface)"
            strokeWidth={2}
            isAnimationActive={podeAnimar()}
            {...ANIMACAO}
          >
            {dados.map((e) => (
              <Cell key={e.name} fill={e.cor} />
            ))}
          </Pie>
          <Tooltip
            active={active}
            formatter={(v: number) => dinheiro(v)}
            {...balao}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GraficoAnual({ dados }: { dados: BarraMes[] }) {
  const dinheiro = useDinheiro();
  const { preferencias } = usePreferencias();
  const { active, aoTocar } = useBalaoQueSome();
  return (
    <div {...aoTocar}>
      <ResponsiveContainer width="100%" height={290}>
        <BarChart data={dados} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          {/* minTickGap 0: os doze meses cabem lado a lado num celular de
              360px, mas a folga mínima padrão (5px) fazia o recharts
              esconder meses alternados. */}
          <XAxis
            dataKey="mes"
            tick={{ fill: "var(--text-faint)", fontSize: 10.5 }}
            axisLine={false}
            tickLine={false}
            minTickGap={0}
          />
          {/* O eixo é a régua dos valores — com eles escondidos, a régua
              também sai. As barras ficam: mostram se sobrou ou faltou, não
              quanto. */}
          <YAxis
            tick={
              preferencias.ocultarValores
                ? false
                : { fill: "var(--text-faint)", fontSize: 11 }
            }
            tickFormatter={formatarEixo}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            active={active}
            labelFormatter={mesPorExtenso}
            formatter={(v: number) => itemDoBalaoAnual(v, dinheiro)}
            // A faixa atrás da barra apontada. Preta a 3%, não aparecia no
            // tema escuro; na cor do texto a 6%, aparece nos dois.
            cursor={{ fill: "var(--text)", fillOpacity: 0.06 }}
            {...balao}
          />
          <Bar
            dataKey="sobra"
            radius={[5, 5, 0, 0]}
            isAnimationActive={podeAnimar()}
            {...ANIMACAO}
          >
            {dados.map((e) => (
              <Cell
                key={e.mes}
                fill={e.sobra >= 0 ? "var(--green)" : "var(--red)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
