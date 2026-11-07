import type { CSSProperties, ReactNode } from "react";
import { ArrowDown, ArrowUp, CalendarDays } from "lucide-react";
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, MESES } from "../types";
import type { Tipo } from "../types";
import { hojeLocal } from "../lib/calculos";
import IconeCategoria from "./IconeCategoria";

// As peças de formulário de todos os modais, no estilo do formulário de
// lançamento: rótulo em caixa alta, campo sem borda sobre o fundo, valor
// grande, atalhos de data, categorias em grade e botão principal no rodapé.
// Um lugar só, para os modais não divergirem de novo.

// A borda sempre em três propriedades, nunca o atalho `border`. Com o atalho
// mais um `borderColor` por cima, o React, ao tirar a cor de quem deixou de
// estar selecionado, deixava a borda sem cor nenhuma — e ela virava a cor do
// texto: um contorno branco no tema escuro.
export const BORDA: CSSProperties = {
  borderWidth: 1.5,
  borderStyle: "solid",
  borderColor: "transparent",
};

export const estiloRotulo: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-faint)",
  margin: "14px 0 8px",
};

export const estiloCampo: CSSProperties = {
  width: "100%",
  height: 48,
  background: "var(--bg)",
  ...BORDA,
  borderRadius: 12,
  padding: "0 14px",
  color: "var(--text)",
  // 16px: abaixo disso o iPhone dá zoom na página ao tocar no campo.
  fontSize: 16,
  outline: "none",
};

export const estiloErro: CSSProperties = {
  fontSize: 12.5,
  color: "var(--red)",
  margin: "6px 0 0",
};

export function campoComErro(erro?: string): CSSProperties {
  return { ...estiloCampo, borderColor: erro ? "var(--red)" : "transparent" };
}

// ---------------------------------------------------------------------------
// Datas

function ontemLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "6 nov"; de outro ano, "6 nov 2025".
function dataCurta(iso: string, anoAtual: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const texto = `${dia} ${MESES[mes - 1].slice(0, 3).toLowerCase()}`;
  return ano === anoAtual ? texto : `${texto} ${ano}`;
}

// No computador, clicar no campo de data só seleciona o dia/mês/ano: o
// calendário abre pelo showPicker. No celular, o toque já abre o seletor do
// sistema — chamar de novo ali não ajuda.
function abrirCalendario(e: React.MouseEvent<HTMLInputElement>) {
  if (!window.matchMedia?.("(pointer: fine)").matches) return;
  try {
    e.currentTarget.showPicker?.();
  } catch {
    // Navegador sem showPicker: fica o campo nativo, que funciona igual.
  }
}

/** Hoje, Ontem e Outra (o calendário do aparelho). */
export function AtalhosData({
  id,
  rotulo = "Quando",
  data,
  onData,
  erro,
}: {
  id: string;
  rotulo?: string;
  data: string;
  onData: (data: string) => void;
  erro?: string;
}) {
  const hoje = hojeLocal();
  const ontem = ontemLocal();
  const anoAtual = Number(hoje.slice(0, 4));
  const outra = data !== hoje && data !== ontem && data !== "";
  const chip = (ativo: boolean): CSSProperties => ({ ...estilos.chip, ...(ativo ? estilos.chipAtivo : {}) });
  return (
    <>
      <p id={id} style={estiloRotulo}>{rotulo}</p>
      <div role="group" aria-labelledby={id} style={estilos.chips}>
        <button type="button" aria-pressed={data === hoje} onClick={() => onData(hoje)} style={chip(data === hoje)}>
          Hoje <span className="chip-data" style={estilos.chipData}>{dataCurta(hoje, anoAtual)}</span>
        </button>
        <button type="button" aria-pressed={data === ontem} onClick={() => onData(ontem)} style={chip(data === ontem)}>
          Ontem <span className="chip-data" style={estilos.chipData}>{dataCurta(ontem, anoAtual)}</span>
        </button>
        {/* O campo de data de verdade fica por cima do chip, transparente:
            tocar no chip é tocar nele, e o aparelho abre o seletor dele. */}
        <span className="chip-outra" style={{ ...chip(outra), position: "relative" }}>
          <CalendarDays size={15} aria-hidden="true" />
          {outra ? dataCurta(data, anoAtual) : "Outra"}
          <input
            type="date"
            aria-label="Outra data"
            value={data}
            onClick={abrirCalendario}
            onChange={(e) => onData(e.target.value)}
            style={estilos.dataPorCima}
          />
        </span>
      </div>
      {erro && <p style={estiloErro}>{erro}</p>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Tipo, valor e categoria

/** Entrada | Saída, com a seta de cada um. */
export function AlternarTipo({ tipo, onTrocar }: { tipo: Tipo; onTrocar: (tipo: Tipo) => void }) {
  return (
    <div style={estilos.segmentado} role="group" aria-label="Tipo">
      {(["entrada", "saida"] as Tipo[]).map((t) => {
        const ativo = tipo === t;
        const Icone = t === "entrada" ? ArrowDown : ArrowUp;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={ativo}
            onClick={() => onTrocar(t)}
            style={{
              ...estilos.segmento,
              ...(ativo ? { ...estilos.segmentoAtivo, color: t === "entrada" ? "var(--green)" : "var(--red)" } : {}),
            }}
          >
            <Icone size={15} aria-hidden="true" />
            {t === "entrada" ? "Entrada" : "Saída"}
          </button>
        );
      })}
    </div>
  );
}

// O valor encolhe conforme cresce, para caber num celular de 320px: na Sora,
// cada algarismo ocupa uns 0,62 da fonte.
function tamanhoDoValor(caracteres: number): number {
  return caracteres <= 6 ? 44 : caracteres <= 9 ? 36 : 30;
}

/** O valor grande, centralizado, na cor do tipo. Aceita só algarismos, vírgula e ponto. */
export function CampoValor({
  id,
  valor,
  onMudar,
  tipo,
  erro,
  onEnter,
}: {
  id: string;
  valor: string;
  onMudar: (valor: string) => void;
  tipo: Tipo;
  erro?: string;
  onEnter?: () => void;
}) {
  const tamanho = tamanhoDoValor(valor.length);
  return (
    <div style={estilos.valorBloco}>
      <label htmlFor={id} style={{ ...estiloRotulo, margin: 0, textAlign: "center" }}>
        Valor
      </label>
      <div style={estilos.valorLinha}>
        <span aria-hidden="true" style={{ ...estilos.moeda, fontSize: Math.round(tamanho * 0.5) }}>
          R$
        </span>
        {/* O campo tem a largura exata do que está escrito: um espelho
            invisível do texto (ou do "0,00") dá o tamanho, e o campo ocupa
            esse espaço. Assim o "R$" fica colado no número e o conjunto, no
            centro. */}
        <span style={{ ...estilos.valorCaixa, fontSize: tamanho }}>
          <span aria-hidden="true" style={estilos.valorEspelho}>
            {valor || "0,00"}
          </span>
          <input
            id={id}
            className="campo-valor"
            value={valor}
            inputMode="decimal"
            placeholder="0,00"
            autoComplete="off"
            autoFocus
            aria-invalid={!!erro}
            onChange={(e) => onMudar(e.target.value.replace(/[^0-9.,]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
            style={{ ...estilos.valorInput, color: tipo === "entrada" ? "var(--green)" : "var(--red)" }}
          />
        </span>
      </div>
      {erro && <p style={{ ...estiloErro, textAlign: "center" }}>{erro}</p>}
    </div>
  );
}

// Na grade não cabe "Cartão de Crédito / Contas". O nome curto vai na tela;
// o completo é o que o leitor de tela anuncia e o que se grava.
const NOME_CURTO: Record<string, string> = {
  "Cartão de Crédito / Contas": "Cartão / Contas",
  "Freelance / Bico": "Freela / Bico",
  "Empréstimo recebido": "Empréstimo",
  "Rendimentos / Investimentos": "Rendimentos",
};

export function categoriasDe(tipo: Tipo) {
  return tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
}

/** As categorias do tipo em grade, com ícone; escolhe num toque. */
export function GradeCategorias({
  id,
  tipo,
  categoria,
  onEscolher,
  erro,
}: {
  id: string;
  tipo: Tipo;
  categoria: string;
  onEscolher: (categoria: string) => void;
  erro?: string;
}) {
  return (
    <>
      <p id={id} style={estiloRotulo}>Categoria</p>
      <div role="radiogroup" aria-labelledby={id} style={estilos.grade}>
        {categoriasDe(tipo).map((c) => {
          const ativa = c.nome === categoria;
          return (
            <button
              key={c.nome}
              type="button"
              role="radio"
              aria-checked={ativa}
              aria-label={c.nome}
              onClick={() => onEscolher(c.nome)}
              style={{
                ...estilos.categoria,
                // Hex com alfa, como no ícone: "24" é ~14% da cor.
                ...(ativa ? { background: c.cor + "24", borderColor: c.cor } : {}),
              }}
            >
              <IconeCategoria tipo={tipo} categoria={c.nome} tamanho={32} />
              <span style={{ ...estilos.categoriaNome, color: ativa ? "var(--text)" : "var(--text-soft)" }}>
                {NOME_CURTO[c.nome] ?? c.nome}
              </span>
            </button>
          );
        })}
      </div>
      {erro && <p style={estiloErro}>{erro}</p>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Escolhas e botões

/**
 * Opções lado a lado numa barra (Semanal | Mensal; Automático | Claro |
 * Escuro). `papel` "radio" para quem é uma escolha entre várias; "botao"
 * (aria-pressed) para alternâncias.
 */
export function Segmentado<T extends string>({
  rotulo,
  opcoes,
  valor,
  onMudar,
  papel = "botao",
}: {
  rotulo: string;
  opcoes: Array<{ valor: T; nome: string }>;
  valor: T;
  onMudar: (valor: T) => void;
  papel?: "radio" | "botao";
}) {
  return (
    <div style={estilos.segmentado} role={papel === "radio" ? "radiogroup" : "group"} aria-label={rotulo}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            {...(papel === "radio" ? { role: "radio", "aria-checked": ativo } : { "aria-pressed": ativo })}
            onClick={() => onMudar(o.valor)}
            style={{ ...estilos.segmento, ...(ativo ? { ...estilos.segmentoAtivo, color: "var(--text)" } : {}) }}
          >
            {o.nome}
          </button>
        );
      })}
    </div>
  );
}

/** Opções em chips, cada uma com a sua borda (os dias da semana). */
export function Chips<T extends string | number>({
  rotulo,
  opcoes,
  valor,
  onMudar,
}: {
  rotulo: string;
  opcoes: Array<{ valor: T; curto: string; nome: string }>;
  valor: T;
  onMudar: (valor: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} style={estilos.chips}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={String(o.valor)}
            type="button"
            role="radio"
            aria-checked={ativo}
            aria-label={o.nome}
            onClick={() => onMudar(o.valor)}
            style={{ ...estilos.chip, padding: "0 2px", ...(ativo ? estilos.chipAtivo : {}) }}
          >
            {o.curto}
          </button>
        );
      })}
    </div>
  );
}

/** O botão do rodapé. `perigo` deixa vermelho (excluir). */
export function BotaoPrincipal({
  children,
  onClick,
  desligado,
  perigo,
  icone,
}: {
  children: ReactNode;
  onClick: () => void;
  desligado?: boolean;
  perigo?: boolean;
  icone?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desligado}
      style={{
        ...estilos.principal,
        background: perigo ? "var(--red)" : "var(--accent)",
        // No escuro o vermelho é claro, e branco em cima dava 2,5:1. A cor da
        // superfície é branca no claro e escura no escuro: ~4:1 e ~6:1.
        ...(perigo ? { color: "var(--surface)" } : {}),
        opacity: desligado ? 0.5 : 1,
        cursor: desligado ? "not-allowed" : "pointer",
      }}
    >
      {icone}
      {children}
    </button>
  );
}

/** O botão ao lado do principal (Cancelar), sem cor de destaque. */
export function BotaoSecundario({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={estilos.secundario}>
      {children}
    </button>
  );
}

/** O caminho alternativo, embaixo do principal ("Escrever ou colar vários"). */
export function BotaoLink({ children, onClick, icone }: { children: ReactNode; onClick: () => void; icone?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={estilos.link}>
      {icone}
      {children}
    </button>
  );
}

const estilos: Record<string, CSSProperties> = {
  segmentado: {
    display: "grid",
    gridAutoColumns: "1fr",
    gridAutoFlow: "column",
    gap: 4,
    background: "var(--bg)",
    padding: 4,
    borderRadius: 12,
  },
  segmento: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minWidth: 0,
    height: 40,
    padding: "0 4px",
    border: "none",
    borderRadius: 9,
    background: "transparent",
    color: "var(--text-faint)",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  segmentoAtivo: { background: "var(--surface)", boxShadow: "var(--shadow)" },
  valorBloco: { margin: "16px 0 4px" },
  valorLinha: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 6,
    marginTop: 2,
  },
  moeda: { fontFamily: "'Sora', sans-serif", fontWeight: 700, color: "var(--text-faint)" },
  valorCaixa: {
    position: "relative",
    display: "inline-block",
    minWidth: 0,
    maxWidth: "100%",
    fontFamily: "'Sora', sans-serif",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    fontVariantNumeric: "tabular-nums",
  },
  valorEspelho: {
    visibility: "hidden",
    whiteSpace: "pre",
    // Folga para o cursor depois do último algarismo.
    paddingRight: 3,
  },
  valorInput: {
    position: "absolute",
    inset: 0,
    width: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    padding: 0,
    font: "inherit",
    letterSpacing: "inherit",
    fontVariantNumeric: "inherit",
    caretColor: "var(--accent)",
  },
  chips: { display: "flex", gap: 8 },
  chip: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 42,
    padding: "0 6px",
    borderRadius: 12,
    ...BORDA,
    background: "var(--bg)",
    color: "var(--text-soft)",
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: "nowrap",
    cursor: "pointer",
  },
  // O texto fica na cor normal: dourado sobre o bege do claro dá contraste
  // de 2:1, ilegível. O destaque vem do fundo e da borda.
  chipAtivo: {
    background: "var(--accent-soft)",
    color: "var(--text)",
    borderColor: "var(--accent)",
  },
  chipData: { fontWeight: 500, fontSize: 12, opacity: 0.75 },
  dataPorCima: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    opacity: 0,
    cursor: "pointer",
    // 16px: abaixo disso o iPhone dá zoom na página ao tocar no campo.
    fontSize: 16,
  },
  grade: {
    display: "grid",
    // 4 por linha num celular comum; 3 no de 320px, onde 4 apertariam os
    // nomes; 5 no computador.
    gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
    gap: 8,
    paddingBottom: 6,
  },
  categoria: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
    minWidth: 0,
    padding: "9px 2px 8px",
    borderRadius: 12,
    ...BORDA,
    background: "var(--bg)",
    cursor: "pointer",
  },
  categoriaNome: {
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.15,
    textAlign: "center",
    overflowWrap: "break-word",
    maxWidth: "100%",
  },
  principal: {
    flex: 1,
    width: "100%",
    minWidth: 0,
    height: 52,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    color: "#fff",
    border: "none",
    borderRadius: 14,
    fontWeight: 700,
    fontSize: 16,
    padding: "0 12px",
  },
  secundario: {
    flex: 1,
    minWidth: 0,
    height: 52,
    background: "var(--bg)",
    color: "var(--text)",
    border: "none",
    borderRadius: 14,
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
  },
  link: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    fontSize: 13,
    fontWeight: 500,
    // Área de toque de 40px para um texto de 13px: o que sobra embaixo cai
    // na folga que o rodapé já tem, sem empurrar nada.
    minHeight: 40,
    padding: "12px 0",
    marginBottom: -12,
    cursor: "pointer",
  },
};
