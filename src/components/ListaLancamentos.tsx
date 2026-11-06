import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { Lancamento } from "../types";
import { agruparPorDia, ehFuturo, rotuloCurto } from "../lib/agruparPorDia";
import { lerValor } from "../lib/format";
import { useDinheiro } from "../hooks/usePreferencias";
import { useToque } from "../hooks/useToque";
import { vibrar } from "../lib/movimento";
import IconeCategoria from "./IconeCategoria";

// A lista de lançamentos do mês, agrupada por dia (opção A dos protótipos).
//
// - Cabeçalho de cada dia com o total: "HOJE  − R$ 176,30".
// - O que ainda vai acontecer fica em "Agendados", no topo, com a data
//   escrita na linha — no lugar do balão que só aparecia segurando o dedo.
// - Cada linha: ícone da categoria, descrição, categoria e o valor (tocar no
//   valor continua abrindo a correção rápida).
// - No celular, deslizar a linha para a esquerda mostra Editar e Apagar. No
//   computador, lápis e lixeira ficam à vista, porque mouse não desliza.

interface Props {
  lancamentos: Lancamento[];
  /** "AAAA-MM-DD" de hoje, de quem chama — a lista não lê o relógio. */
  hoje: string;
  onEditar: (l: Lancamento) => void;
  onExcluir: (l: Lancamento) => void;
  onCorrigirValor: (l: Lancamento, novoValor: number) => void;
}

// Largura dos dois botões que aparecem ao deslizar.
const LARGURA_ACOES = 152;

export default function ListaLancamentos({ lancamentos, hoje, onEditar, onExcluir, onCorrigirValor }: Props) {
  const dinheiro = useDinheiro();
  const toque = useToque();
  const grupos = useMemo(() => agruparPorDia(lancamentos, hoje), [lancamentos, hoje]);
  // Uma linha aberta por vez: abrir outra fecha a anterior.
  const [aberta, setAberta] = useState<string | null>(null);
  const [editandoValor, setEditandoValor] = useState<string | null>(null);

  // Trocou o mês ou o filtro: nenhuma linha fica aberta mostrando botões de
  // um lançamento que talvez nem esteja mais na tela.
  useEffect(() => setAberta(null), [lancamentos]);

  return (
    <div className="lista-lancamentos" style={estilos.lista}>
      {grupos.map((g) => (
        <section key={g.chave} aria-label={g.rotulo} style={estilos.grupo}>
          <div className="lista-dia" style={estilos.cabecalhoDia}>
            <span style={estilos.rotuloDia}>
              {g.rotulo}
              {g.futuro && <span style={estilos.subDia}> · ainda vão acontecer</span>}
            </span>
            <span style={estilos.totalDia}>
              {g.total < 0 ? "− " : "+ "}
              {dinheiro(Math.abs(g.total))}
            </span>
          </div>
          {g.itens.map((l) => (
            <Linha
              key={l.id}
              l={l}
              futuro={ehFuturo(l, hoje)}
              toque={toque}
              aberta={aberta === l.id}
              onAbrir={() => {
                if (aberta !== l.id) vibrar(6);
                setAberta(l.id);
              }}
              onFechar={() => setAberta((a) => (a === l.id ? null : a))}
              onEditar={() => {
                setAberta(null);
                onEditar(l);
              }}
              onExcluir={() => {
                setAberta(null);
                onExcluir(l);
              }}
              editando={editandoValor === l.id}
              onEditarValor={() => setEditandoValor(l.id)}
              onFimEdicaoValor={(novo) => {
                setEditandoValor(null);
                if (novo !== null && novo !== l.valor) onCorrigirValor(l, novo);
              }}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

interface LinhaProps {
  l: Lancamento;
  futuro: boolean;
  toque: boolean;
  aberta: boolean;
  onAbrir: () => void;
  onFechar: () => void;
  onEditar: () => void;
  onExcluir: () => void;
  editando: boolean;
  onEditarValor: () => void;
  onFimEdicaoValor: (novo: number | null) => void;
}

function Linha({
  l, futuro, toque, aberta, onAbrir, onFechar, onEditar, onExcluir,
  editando, onEditarValor, onFimEdicaoValor,
}: LinhaProps) {
  const dinheiro = useDinheiro();
  const corValor = l.tipo === "entrada" ? "var(--green)" : "var(--red)";

  // Deslizar. A direção se decide nos primeiros 8px: na horizontal a linha
  // acompanha o dedo; na vertical, é rolagem da página e a linha não mexe
  // (o CSS `touch-action: pan-y` deixa a rolagem com o navegador).
  const [arrasto, setArrasto] = useState<number | null>(null);
  const gesto = useRef<{ x: number; y: number; base: number; dir: "h" | "v" | null; ultimo: number } | null>(null);
  const conteudoRef = useRef<HTMLDivElement | null>(null);
  const abertaRef = useRef(aberta);
  abertaRef.current = aberta;

  // Início e movimento do dedo ficam em ouvintes nativos, e não nos do
  // React, por um motivo: o movimento precisa cancelar a rolagem do
  // navegador quando o arrasto é horizontal. O React registra o touchmove
  // como "passivo", e ouvinte passivo não pode cancelar nada. Sem cancelar, o
  // navegador tratava o arrasto como início de rolagem, e o toque seguinte —
  // justamente no "Apagar" — servia só para parar essa rolagem, sem virar
  // clique. (Achado no Chromium em modo celular; o jsdom não reproduz.)
  useEffect(() => {
    const el = conteudoRef.current;
    if (!toque || !el) return;
    const aoTocar = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const base = abertaRef.current ? -LARGURA_ACOES : 0;
      gesto.current = { x: t.clientX, y: t.clientY, base, dir: null, ultimo: base };
    };
    const aoMover = (e: TouchEvent) => {
      const g = gesto.current;
      const t = e.touches[0];
      if (!g || !t) return;
      const dx = t.clientX - g.x;
      const dy = t.clientY - g.y;
      if (!g.dir) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        g.dir = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      }
      if (g.dir !== "h") return;
      if (e.cancelable) e.preventDefault();
      // Um pouco de folga além dos botões, como nos apps do iPhone.
      g.ultimo = Math.max(-LARGURA_ACOES - 24, Math.min(0, g.base + dx));
      setArrasto(g.ultimo);
    };
    el.addEventListener("touchstart", aoTocar, { passive: true });
    el.addEventListener("touchmove", aoMover, { passive: false });
    return () => {
      el.removeEventListener("touchstart", aoTocar);
      el.removeEventListener("touchmove", aoMover);
    };
  }, [toque]);

  // O fim do gesto fica no React: é por ele que o stopPropagation impede a
  // página (que também escuta pelo React) de ler o arrasto como "trocar de
  // mês".
  const deslizar = toque
    ? {
        onTouchEnd: (e: React.TouchEvent) => {
          const g = gesto.current;
          gesto.current = null;
          if (!g || g.dir !== "h") return;
          e.stopPropagation();
          setArrasto(null);
          if (g.ultimo < -LARGURA_ACOES / 2) onAbrir();
          else onFechar();
        },
        onTouchCancel: () => {
          gesto.current = null;
          setArrasto(null);
        },
      }
    : {};
  const posicao = arrasto ?? (toque && aberta ? -LARGURA_ACOES : 0);

  const valor = editando ? (
    <CampoValor l={l} cor={corValor} onFim={onFimEdicaoValor} />
  ) : (
    <button
      type="button"
      onClick={onEditarValor}
      title="Tocar para corrigir o valor"
      className="valor-lancamento"
      style={{ ...estilos.valor, color: corValor }}
    >
      {l.tipo === "entrada" ? "+" : "−"} {dinheiro(l.valor)}
    </button>
  );

  return (
    <div className="item-lancamento" style={estilos.item}>
      {toque && (
        // Invisíveis com a linha fechada: o vermelho e o dourado vazavam
        // como um risco pelo canto arredondado. Opacidade, e não display:none,
        // para seguirem alcançáveis pelo VoiceOver.
        <div
          className="acoes-deslizar"
          style={{ ...estilos.acoesFundo, opacity: aberta || arrasto !== null ? 1 : 0 }}
        >
          {/* Sempre no DOM e alcançáveis pelo VoiceOver: focar um deles abre a
              linha, para quem navega sem deslizar ver o que está tocando. */}
          <button type="button" aria-label="Editar lançamento" onFocus={onAbrir} onClick={onEditar}
            style={{ ...estilos.acaoFundo, background: "var(--accent)" }}>
            <Pencil size={18} />
            Editar
          </button>
          <button type="button" aria-label="Excluir lançamento" onFocus={onAbrir} onClick={onExcluir}
            style={{ ...estilos.acaoFundo, background: "var(--red)" }}>
            <Trash2 size={18} />
            Apagar
          </button>
        </div>
      )}
      <div
        ref={conteudoRef}
        className="linha-conteudo"
        {...deslizar}
        // Aberta, um toque na linha só fecha — não abre a correção do valor
        // nem nada embaixo do dedo.
        onClickCapture={
          toque && aberta
            ? (e) => {
                e.stopPropagation();
                e.preventDefault();
                onFechar();
              }
            : undefined
        }
        style={{
          ...estilos.conteudo,
          transform: `translateX(${posicao}px)`,
          transition: arrasto === null ? "transform 0.22s ease" : "none",
          touchAction: toque ? "pan-y" : undefined,
        }}
      >
        <span style={{ display: "flex", opacity: futuro ? 0.72 : 1 }}>
          <IconeCategoria tipo={l.tipo} categoria={l.categoria} />
        </span>
        <span style={{ ...estilos.textos, opacity: futuro ? 0.72 : 1 }}>
          <span className="descricao-lancamento" style={estilos.descricao}>
            {l.descricao || "—"}
          </span>
          <span className="tag-categoria" style={estilos.categoria}>
            {futuro && l.data ? `${rotuloCurto(l.data)} · ` : ""}
            {l.categoria}
          </span>
        </span>
        {valor}
        {!toque && (
          <span style={estilos.acoesMouse}>
            <button type="button" style={estilos.acaoMouse} onClick={onEditar} aria-label="Editar lançamento" title="Editar">
              <Pencil size={15} />
            </button>
            <button type="button" style={estilos.acaoMouse} onClick={onExcluir} aria-label="Excluir lançamento" title="Excluir">
              <Trash2 size={15} />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

// A correção rápida do valor, igual à de antes: Enter salva, Esc desiste,
// tocar fora salva. Valor inválido ou igual não vira ida ao servidor.
function CampoValor({ l, cor, onFim }: { l: Lancamento; cor: string; onFim: (novo: number | null) => void }) {
  const [texto, setTexto] = useState(l.valor.toFixed(2).replace(".", ","));
  const cancelando = useRef(false);
  return (
    <input
      value={texto}
      inputMode="decimal"
      autoFocus
      aria-label={`Valor de ${l.descricao}`}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setTexto(e.target.value.replace(/[^0-9.,]/g, ""))}
      onBlur={() => onFim(cancelando.current ? null : lerValor(texto))}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancelando.current = true;
          e.currentTarget.blur();
        }
      }}
      style={{ ...estilos.campoValor, color: cor }}
    />
  );
}

const estilos: Record<string, React.CSSProperties> = {
  lista: { display: "grid", gap: 4 },
  grupo: { display: "grid", gap: 2 },
  cabecalhoDia: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 2px 4px",
  },
  rotuloDia: {
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "var(--text-faint)",
  },
  subDia: { textTransform: "none", letterSpacing: 0, fontWeight: 500 },
  totalDia: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-faint)",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
  item: { position: "relative", overflow: "hidden", borderRadius: 12 },
  acoesFundo: {
    position: "absolute",
    inset: 0,
    display: "flex",
    justifyContent: "flex-end",
    transition: "opacity 0.15s ease",
  },
  acaoFundo: {
    width: LARGURA_ACOES / 2,
    border: "none",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    fontSize: 11.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  conteudo: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "9px 2px",
    background: "var(--surface)",
  },
  textos: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
  descricao: {
    fontSize: 15,
    fontWeight: 600,
    color: "var(--text)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  categoria: {
    fontSize: 12.5,
    color: "var(--text-faint)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  valor: {
    background: "none",
    border: "none",
    padding: "4px 0",
    fontFamily: "'Sora', sans-serif",
    fontWeight: 700,
    fontSize: 15,
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
    cursor: "pointer",
    flexShrink: 0,
  },
  campoValor: {
    width: 110,
    fontFamily: "'Sora', sans-serif",
    fontWeight: 700,
    fontSize: 15,
    textAlign: "right",
    padding: "4px 8px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    flexShrink: 0,
  },
  acoesMouse: { display: "flex", gap: 2, flexShrink: 0 },
  acaoMouse: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    padding: 6,
    borderRadius: 8,
    display: "flex",
    cursor: "pointer",
  },
};
