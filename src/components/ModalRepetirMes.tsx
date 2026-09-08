import { useMemo, useState } from "react";
import { CopyCheck, Repeat, X } from "lucide-react";
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, MESES } from "../types";
import type { Lancamento, NovoLancamento } from "../types";
import { mesmoDiaNoMes } from "../lib/calculos";
import { normalizar } from "../lib/categorias";
import { brl } from "../lib/format";

// A lista do mês passado colada no mês novo, que é o que se fazia à mão no
// WhatsApp: quase tudo se repete, muda só o valor de um ou outro.
//
// Duas coisas o app sabe e o copiar-e-colar não sabia:
// - lançamento gerado por recorrência não vem junto. Ele se materializa
//   sozinho na virada, e trazer de novo criaria a conta em dobro.
// - o que já existe no mês de destino chega desmarcado, para reabrir a tela
//   uma segunda vez não duplicar o que a primeira já trouxe.

interface Props {
  /** Competência de destino — o mês que a tela está mostrando. */
  mes: number;
  ano: number;
  /** Lançamentos do mês anterior, inclusive os de recorrência. */
  origem: Lancamento[];
  /** Lançamentos que o mês de destino já tem. */
  jaNoMes: Lancamento[];
  mesOrigemNome: string;
  onFechar: () => void;
  onSalvar: (itens: NovoLancamento[]) => Promise<void> | void;
}

function dataDe(l: Lancamento): string {
  return l.data ?? l.created_at.slice(0, 10);
}

function corDaCategoria(l: Lancamento): string {
  const lista = l.tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
  return lista.find((c) => c.nome === l.categoria)?.cor ?? "#9aa3b0";
}

function paraTexto(valor: number): string {
  return valor.toFixed(2).replace(".", ",");
}

function lerNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export default function ModalRepetirMes({
  mes,
  ano,
  origem,
  jaNoMes,
  mesOrigemNome,
  onFechar,
  onSalvar,
}: Props) {
  const geradas = useMemo(
    () => origem.filter((l) => l.recorrencia_id),
    [origem]
  );

  const candidatos = useMemo(
    () =>
      origem
        .filter((l) => !l.recorrencia_id)
        .slice()
        .sort((a, b) => dataDe(a).localeCompare(dataDe(b))),
    [origem]
  );

  // Mesma descrição e mesmo tipo já no destino contam como repetido. O valor
  // fica de fora da comparação de propósito: a conta de luz de setembro é a
  // mesma conta de agosto ainda que venha dez reais mais cara.
  const jaExistem = useMemo(() => {
    const chaves = new Set(
      jaNoMes.map((l) => `${l.tipo}|${normalizar(l.descricao)}`)
    );
    return new Set(
      candidatos
        .filter((l) => chaves.has(`${l.tipo}|${normalizar(l.descricao)}`))
        .map((l) => l.id)
    );
  }, [candidatos, jaNoMes]);

  const [selecionados, setSelecionados] = useState<Set<string>>(
    () => new Set(candidatos.filter((l) => !jaExistem.has(l.id)).map((l) => l.id))
  );
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(candidatos.map((l) => [l.id, paraTexto(l.valor)]))
  );
  const [salvando, setSalvando] = useState(false);

  function alternar(id: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  const escolhidos = candidatos.filter((l) => selecionados.has(l.id));
  const algumInvalido = escolhidos.some(
    (l) => lerNumero(valores[l.id] ?? "") === null
  );

  const saldo = escolhidos.reduce((s, l) => {
    const valor = lerNumero(valores[l.id] ?? "") ?? 0;
    return s + (l.tipo === "entrada" ? valor : -valor);
  }, 0);

  async function submit() {
    if (salvando || escolhidos.length === 0 || algumInvalido) return;
    setSalvando(true);
    try {
      await onSalvar(
        escolhidos.map((l) => ({
          tipo: l.tipo,
          valor: lerNumero(valores[l.id] ?? "")!,
          descricao: l.descricao,
          categoria: l.categoria,
          mes,
          ano,
          data: mesmoDiaNoMes(dataDe(l), mes, ano),
        }))
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      style={styles.overlay}
      className="overlay-sheet"
      data-modal
      onClick={onFechar}
    >
      <div
        style={styles.modal}
        className="modal-mobile modal-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.head}>
          <h3 style={styles.titulo}>
            Repetir {mesOrigemNome} em {MESES[mes]}
          </h3>
          <button style={styles.fechar} onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <p style={styles.explicacao}>
          Desmarque o que não se repete e ajuste os valores que mudaram. As
          datas vão para o mesmo dia de {MESES[mes]}.
        </p>

        {candidatos.length === 0 ? (
          <p style={styles.vazio}>
            {mesOrigemNome} não tem lançamentos para repetir.
          </p>
        ) : (
          <>
            <div style={styles.lista}>
              {candidatos.map((l) => {
                const marcado = selecionados.has(l.id);
                const texto = valores[l.id] ?? "";
                const invalido = marcado && lerNumero(texto) === null;
                const cor =
                  l.tipo === "entrada" ? "var(--green)" : "var(--red)";
                return (
                  <div
                    key={l.id}
                    style={{ ...styles.linha, opacity: marcado ? 1 : 0.5 }}
                  >
                    <label style={styles.alvo}>
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternar(l.id)}
                        style={styles.checkbox}
                      />
                      <span style={styles.textos}>
                        <span style={styles.descricao}>{l.descricao}</span>
                        <span style={styles.meta}>
                          <span
                            style={{
                              ...styles.pontoCategoria,
                              background: corDaCategoria(l),
                            }}
                          />
                          {l.categoria} · dia {dataDe(l).slice(8, 10)}
                        </span>
                      </span>
                    </label>
                    <span style={{ ...styles.sinal, color: cor }}>
                      {l.tipo === "entrada" ? "+" : "−"}
                    </span>
                    <input
                      value={texto}
                      inputMode="decimal"
                      disabled={!marcado}
                      onChange={(e) =>
                        setValores((atual) => ({
                          ...atual,
                          [l.id]: e.target.value.replace(/[^0-9.,]/g, ""),
                        }))
                      }
                      style={{
                        ...styles.valor,
                        borderColor: invalido
                          ? "var(--red)"
                          : "var(--border)",
                        color: cor,
                      }}
                      aria-label={`Valor de ${l.descricao}`}
                    />
                  </div>
                );
              })}
            </div>

            {(geradas.length > 0 || jaExistem.size > 0) && (
              <div style={styles.notas}>
                {geradas.length > 0 && (
                  <p style={styles.nota}>
                    <Repeat size={13} style={{ flexShrink: 0 }} />
                    <span>
                      {geradas.length}{" "}
                      {geradas.length === 1
                        ? "lançamento de recorrência ficou"
                        : "lançamentos de recorrência ficaram"}{" "}
                      de fora — {geradas.length === 1 ? "ele se gera" : "eles se geram"}{" "}
                      sozinho{geradas.length === 1 ? "" : "s"}.
                    </span>
                  </p>
                )}
                {jaExistem.size > 0 && (
                  <p style={styles.nota}>
                    <CopyCheck size={13} style={{ flexShrink: 0 }} />
                    <span>
                      {jaExistem.size}{" "}
                      {jaExistem.size === 1 ? "já existe" : "já existem"} em{" "}
                      {MESES[mes]} e {jaExistem.size === 1 ? "veio" : "vieram"}{" "}
                      desmarcado{jaExistem.size === 1 ? "" : "s"}.
                    </span>
                  </p>
                )}
              </div>
            )}

            <div style={styles.resumo}>
              <span style={styles.resumoRotulo}>
                {escolhidos.length} de {candidatos.length}
              </span>
              <span
                style={{
                  ...styles.resumoValor,
                  color: saldo >= 0 ? "var(--green)" : "var(--red)",
                }}
              >
                {saldo >= 0 ? "+" : "−"} {brl(Math.abs(saldo))}
              </span>
            </div>
          </>
        )}

        <button
          type="button"
          style={{
            ...styles.salvar,
            opacity:
              escolhidos.length === 0 || algumInvalido || salvando ? 0.5 : 1,
            cursor:
              escolhidos.length === 0 || algumInvalido || salvando
                ? "not-allowed"
                : "pointer",
          }}
          onClick={submit}
          disabled={escolhidos.length === 0 || algumInvalido || salvando}
        >
          {salvando
            ? "Trazendo..."
            : algumInvalido
              ? "Confira os valores em vermelho"
              : escolhidos.length === 0
                ? "Escolha o que repetir"
                : `Trazer ${escolhidos.length} para ${MESES[mes]}`}
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
    gap: 10,
    marginBottom: 10,
  },
  titulo: { fontSize: 18, fontWeight: 700 },
  fechar: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
    flexShrink: 0,
  },
  explicacao: {
    fontSize: 13,
    color: "var(--text-soft)",
    lineHeight: 1.5,
    marginBottom: 14,
  },
  vazio: {
    fontSize: 13.5,
    color: "var(--text-faint)",
    padding: "18px 0",
    textAlign: "center",
  },
  lista: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  linha: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 0",
    borderBottom: "1px solid var(--border)",
    minWidth: 0,
  },
  alvo: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    cursor: "pointer",
  },
  checkbox: {
    width: 19,
    height: 19,
    flexShrink: 0,
    accentColor: "var(--accent)",
  },
  textos: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  descricao: {
    fontSize: 13.5,
    color: "var(--text)",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  meta: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 11.5,
    color: "var(--text-faint)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  pontoCategoria: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    flexShrink: 0,
  },
  sinal: {
    fontSize: 15,
    fontWeight: 700,
    flexShrink: 0,
  },
  valor: {
    width: 84,
    flexShrink: 0,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 9,
    padding: "8px 8px",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Sora', sans-serif",
    textAlign: "right",
    outline: "none",
  },
  notas: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginTop: 12,
  },
  nota: {
    display: "flex",
    alignItems: "flex-start",
    gap: 7,
    fontSize: 12,
    color: "var(--text-faint)",
    lineHeight: 1.45,
  },
  resumo: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 10,
    borderTop: "1px solid var(--border)",
  },
  resumoRotulo: { fontSize: 13, color: "var(--text-soft)", fontWeight: 600 },
  resumoValor: {
    fontFamily: "'Sora', sans-serif",
    fontSize: 20,
    fontWeight: 700,
  },
  salvar: {
    width: "100%",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    padding: 14,
    borderRadius: 12,
    fontWeight: 600,
    fontSize: 15,
    marginTop: 18,
  },
};
