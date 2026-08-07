import { useMemo, useState } from "react";
import { X, ClipboardPaste, AlertTriangle, Trash2 } from "lucide-react";
import { CATEGORIAS_SAIDA } from "../types";
import type { NovoItemLista } from "../types";
import { interpretarLista, somar } from "../lib/importarLista";
import { brl } from "../lib/format";

interface Props {
  /** Usado para completar datas curtas do cabeçalho ("05/08" → 2026-08-05). */
  ano: number;
  vencimentoPadrao: string;
  onFechar: () => void;
  onSalvar: (itens: NovoItemLista[]) => Promise<void> | void;
}

const EXEMPLO = `Contas a Pagar 05/08:
Cartão crédito - 1.900
Estacionamento - 150
Empréstimo - 2800
Total = 4.850`;

// Cadastrar uma leva de contas uma a uma é o que fazia o usuário desistir e
// lançar um único card "Total de Tudo" — que duplicava o valor da pilha. Aqui
// ele cola o texto que já recebe pronto no WhatsApp.
export default function ModalColarLista({
  ano,
  vencimentoPadrao,
  onFechar,
  onSalvar,
}: Props) {
  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState("Cartão de Crédito / Contas");
  const [vencimento, setVencimento] = useState(vencimentoPadrao);
  const [removidos, setRemovidos] = useState<Set<number>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [tocouVencimento, setTocouVencimento] = useState(false);

  const lida = useMemo(() => interpretarLista(texto, ano), [texto, ano]);

  const itens = lida.itens.filter((_, i) => !removidos.has(i));
  const total = somar(itens);

  // A data do cabeçalho vira sugestão, mas nunca sobrescreve o que o usuário
  // já escolheu à mão.
  const vencimentoEfetivo =
    !tocouVencimento && lida.vencimentoDetectado
      ? lida.vencimentoDetectado
      : vencimento;

  const divergencia =
    lida.totalInformado !== null && Math.abs(lida.totalInformado - total) > 0.001
      ? lida.totalInformado - total
      : null;

  async function submit() {
    if (salvando || itens.length === 0) return;
    setSalvando(true);
    try {
      await onSalvar(
        itens.map((i) => ({
          descricao: i.descricao,
          valor: i.valor,
          categoria,
          vencimento: vencimentoEfetivo,
        }))
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={styles.overlay} data-modal onClick={onFechar}>
      <div
        style={styles.modal}
        className="modal-mobile"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.head}>
          <h3 style={styles.titulo}>Colar lista</h3>
          <button style={styles.fechar} onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <p style={styles.explicacao}>
          Cole o texto como você recebe. Uma conta por linha, com o valor no
          final. A linha de total não vira conta — serve para conferir.
        </p>

        <textarea
          style={styles.textarea}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={EXEMPLO}
          rows={7}
          autoFocus
        />

        {itens.length > 0 && (
          <>
            <div style={styles.blocoTotais}>
              <span style={styles.totalRotulo}>
                {itens.length} {itens.length === 1 ? "conta" : "contas"}
              </span>
              <span style={styles.totalValor}>{brl(total)}</span>
            </div>

            {divergencia !== null && (
              <div style={styles.aviso}>
                <AlertTriangle size={15} />
                <span>
                  O total escrito é {brl(lida.totalInformado!)}, mas as contas
                  somam {brl(total)} —{" "}
                  {divergencia > 0 ? "faltam" : "sobram"}{" "}
                  {brl(Math.abs(divergencia))}. Dá para seguir assim mesmo.
                </span>
              </div>
            )}

            <div style={styles.previa}>
              {lida.itens.map((item, i) =>
                removidos.has(i) ? null : (
                  <div key={i} style={styles.linha}>
                    <span style={styles.linhaDescricao}>{item.descricao}</span>
                    <span style={styles.linhaValor}>{brl(item.valor)}</span>
                    <button
                      style={styles.linhaRemover}
                      onClick={() =>
                        setRemovidos((atual) => new Set(atual).add(i))
                      }
                      aria-label={`Tirar ${item.descricao} da lista`}
                      title="Tirar da lista"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              )}
            </div>
          </>
        )}

        {lida.ignoradas.length > 0 && (
          <p style={styles.ignoradas}>
            Sem valor reconhecível, ficaram de fora:{" "}
            {lida.ignoradas.slice(0, 3).join(" · ")}
            {lida.ignoradas.length > 3 &&
              ` e mais ${lida.ignoradas.length - 3}`}
          </p>
        )}

        <label htmlFor="lote-vencimento" style={styles.lbl}>
          Vencimento de todas
        </label>
        <input
          id="lote-vencimento"
          type="date"
          style={styles.input}
          value={vencimentoEfetivo}
          onChange={(e) => {
            setTocouVencimento(true);
            setVencimento(e.target.value);
          }}
        />

        <label htmlFor="lote-categoria" style={styles.lbl}>
          Categoria de todas
        </label>
        <select
          id="lote-categoria"
          style={styles.input}
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
        >
          {CATEGORIAS_SAIDA.map((c) => (
            <option key={c.nome} value={c.nome}>
              {c.nome}
            </option>
          ))}
        </select>

        <button
          style={{
            ...styles.salvar,
            opacity: itens.length === 0 || salvando ? 0.5 : 1,
            cursor: itens.length === 0 || salvando ? "not-allowed" : "pointer",
          }}
          onClick={submit}
          disabled={itens.length === 0 || salvando}
        >
          <ClipboardPaste size={16} />
          {salvando
            ? "Adicionando..."
            : itens.length === 0
              ? "Cole a lista acima"
              : `Adicionar ${itens.length} ${itens.length === 1 ? "conta" : "contas"}`}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(16, 24, 40, 0.35)",
    backdropFilter: "blur(3px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 56,
  },
  modal: {
    background: "var(--surface)",
    borderRadius: 20,
    padding: 26,
    width: "100%",
    maxWidth: 460,
    maxHeight: "88vh",
    overflowY: "auto",
    boxShadow: "0 20px 60px rgba(16,24,40,0.18)",
    animation: "fadeUp 0.25s ease",
  },
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  titulo: { fontSize: 19, fontWeight: 700 },
  fechar: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
  },
  explicacao: {
    fontSize: 13,
    color: "var(--text-soft)",
    lineHeight: 1.5,
    marginBottom: 12,
  },
  textarea: {
    width: "100%",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 11,
    padding: "11px 14px",
    color: "var(--text)",
    fontSize: 14,
    lineHeight: 1.5,
    outline: "none",
    resize: "vertical",
    fontFamily: "inherit",
  },
  blocoTotais: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 16,
    paddingBottom: 8,
    borderBottom: "1px solid var(--border)",
  },
  totalRotulo: { fontSize: 13, color: "var(--text-soft)", fontWeight: 600 },
  totalValor: {
    fontFamily: "'Sora', sans-serif",
    fontSize: 20,
    fontWeight: 700,
    color: "var(--text)",
  },
  aviso: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    background: "var(--accent-soft)",
    color: "var(--text-soft)",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 12.5,
    lineHeight: 1.45,
    marginTop: 10,
  },
  previa: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    marginTop: 10,
  },
  linha: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "7px 2px",
    minWidth: 0,
  },
  linhaDescricao: {
    flex: 1,
    fontSize: 13.5,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  linhaValor: {
    fontFamily: "'Sora', sans-serif",
    fontSize: 13.5,
    fontWeight: 600,
    color: "var(--red)",
    whiteSpace: "nowrap",
  },
  linhaRemover: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
    padding: 2,
    cursor: "pointer",
  },
  ignoradas: {
    fontSize: 12,
    color: "var(--text-faint)",
    marginTop: 10,
    lineHeight: 1.45,
  },
  lbl: {
    fontSize: 13,
    color: "var(--text-soft)",
    marginBottom: 6,
    marginTop: 16,
    display: "block",
  },
  input: {
    width: "100%",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 11,
    padding: "11px 14px",
    color: "var(--text)",
    fontSize: 15,
    outline: "none",
  },
  salvar: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    padding: 13,
    borderRadius: 12,
    fontWeight: 600,
    fontSize: 15,
    marginTop: 20,
  },
};
