import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, SlidersHorizontal, Trash2, X } from "lucide-react";
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA } from "../types";
import type { Lancamento, NovoLancamento, Tipo } from "../types";
import type { LinhaLida } from "../lib/importarLancamentos";
import {
  interpretarLancamentos,
  paraLancamento,
  somarLinhas,
} from "../lib/importarLancamentos";
import { CATEGORIA_PADRAO, adivinharCategoria } from "../lib/categorias";
import { chaveExata, conjuntoExato } from "../lib/duplicatas";
import { brl } from "../lib/format";

// Um campo só para os dois casos que antes eram telas diferentes: digitar
// "almoço 25" e colar a lista inteira do mês. É a mesma gramática, e o número
// de linhas é que decide se aquilo é um lançamento ou uma leva — por isso não
// existe um botão "colar lista" em lugar nenhum: colar já é usar.
//
// Nada aqui salva às cegas. O palpite de tipo e de categoria aparece em uma
// prévia onde cada linha pode ser corrigida com um toque, porque errar a
// categoria em silêncio é pior do que perguntar.

interface Props {
  /** Data das linhas que não trouxerem a sua própria. */
  dataPadrao: string;
  /** Tudo que já está lançado, para avisar antes de duplicar. */
  jaLancados: Lancamento[];
  /** Texto que já chega escrito — hoje, o do atalho de compartilhamento. */
  textoInicial?: string;
  onFechar: () => void;
  onSalvar: (itens: NovoLancamento[]) => Promise<void> | void;
  /** Saída para o formulário de sempre, levando junto o que já foi digitado. */
  onFormularioCompleto: (
    valores: Partial<
      Pick<NovoLancamento, "tipo" | "valor" | "descricao" | "categoria">
    >,
    data: string
  ) => void;
}

const EXEMPLO = `almoço 25
uber 18
+ mesada 500
12/10 internet 120`;

interface Ajuste {
  tipo: Tipo;
  categoria: string;
}

// A prévia é reconstruída a cada tecla, então o índice da linha não serve de
// identidade: apagar a primeira linha jogaria o ajuste dela para a seguinte.
// Descrição + valor acompanham a linha enquanto o texto muda.
//
// A data fica de fora de propósito. Ela entra na chave e trocar a data do
// lote renomearia todas as linhas de uma vez, jogando fora as categorias que
// o usuário tinha acabado de corrigir à mão.
function chave(linha: LinhaLida): string {
  return `${linha.descricao}|${linha.valor}`;
}

function categoriasDe(tipo: Tipo) {
  return tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
}

function diaMes(data: string): string {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

export default function ModalAdicionar({
  dataPadrao,
  jaLancados,
  textoInicial,
  onFechar,
  onSalvar,
  onFormularioCompleto,
}: Props) {
  const [texto, setTexto] = useState(textoInicial ?? "");
  const [dataLote, setDataLote] = useState(dataPadrao);
  const [ajustes, setAjustes] = useState<Record<string, Ajuste>>({});
  const [removidos, setRemovidos] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const lida = useMemo(
    () => interpretarLancamentos(texto, dataLote),
    [texto, dataLote]
  );

  const linhas = useMemo(
    () =>
      lida.itens
        .map((linha) => {
          const ajuste = ajustes[chave(linha)];
          return ajuste ? { ...linha, ...ajuste } : linha;
        })
        .filter((linha) => !removidos.has(chave(linha))),
    [lida.itens, ajustes, removidos]
  );

  // Cresce com o conteúdo até um teto, para a lista colada não empurrar o
  // botão de salvar para fora da tela do celular.
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${Math.min(area.scrollHeight, 200)}px`;
  }, [texto]);

  // Recolar a mesma lista, ou salvar de novo depois de uma falha que na
  // verdade tinha entrado, são os dois jeitos de duplicar sem perceber.
  // O app não bloqueia — dois almoços de R$ 25 no mesmo dia existem —, mas
  // também não deixa passar calado.
  const existentes = useMemo(() => conjuntoExato(jaLancados), [jaLancados]);
  const repetidas = useMemo(
    () => linhas.filter((linha) => existentes.has(chaveExata(linha))),
    [linhas, existentes]
  );

  function tirarRepetidas() {
    setRemovidos((atual) => {
      const proximo = new Set(atual);
      for (const linha of repetidas) proximo.add(chave(linha));
      return proximo;
    });
  }

  // Quando a lista inteira trouxe a própria data, o campo de data vira
  // enfeite — some, e a folha encurta uma linha no celular.
  const precisaData =
    linhas.length === 0 || linhas.some((linha) => !linha.dataExplicita);

  const saldo = somarLinhas(linhas);
  const somaSaidas = linhas
    .filter((l) => l.tipo === "saida")
    .reduce((s, l) => s + l.valor, 0);
  const somaEntradas = linhas
    .filter((l) => l.tipo === "entrada")
    .reduce((s, l) => s + l.valor, 0);

  // O "Total = X" da lista do WhatsApp confere as contas, então é com as
  // saídas que ele tem que bater — a não ser que a leva só tenha entradas.
  const somaConferida = somaSaidas > 0 ? somaSaidas : somaEntradas;
  const divergencia =
    lida.totalInformado !== null &&
    linhas.length > 0 &&
    Math.abs(lida.totalInformado - somaConferida) > 0.001
      ? lida.totalInformado - somaConferida
      : null;

  function trocarTipo(linha: LinhaLida) {
    const tipo: Tipo = linha.tipo === "entrada" ? "saida" : "entrada";
    // A categoria antiga não existe na lista do outro tipo, então o palpite é
    // refeito em vez de deixar um valor órfão no select.
    setAjustes((atual) => ({
      ...atual,
      [chave(linha)]: {
        tipo,
        categoria: adivinharCategoria(linha.descricao, tipo) ?? CATEGORIA_PADRAO,
      },
    }));
  }

  function trocarCategoria(linha: LinhaLida, categoria: string) {
    setAjustes((atual) => ({
      ...atual,
      [chave(linha)]: { tipo: linha.tipo, categoria },
    }));
  }

  function remover(linha: LinhaLida) {
    setRemovidos((atual) => new Set(atual).add(chave(linha)));
  }

  async function submit() {
    if (salvando || linhas.length === 0) return;
    setSalvando(true);
    try {
      await onSalvar(linhas.map(paraLancamento));
    } finally {
      setSalvando(false);
    }
  }

  function abrirFormulario() {
    const unica = linhas.length === 1 ? linhas[0] : null;
    onFormularioCompleto(
      unica
        ? {
            tipo: unica.tipo,
            valor: unica.valor,
            descricao: unica.descricao,
            categoria: unica.categoria,
          }
        : {},
      unica?.data ?? dataLote
    );
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
          <h3 style={styles.titulo}>Adicionar</h3>
          <button style={styles.fechar} onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <textarea
          ref={areaRef}
          style={styles.textarea}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter quebra linha — é o que permite escrever a lista à mão.
            // Salvar com o teclado fica no Ctrl/Cmd+Enter, no desktop.
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder={EXEMPLO}
          rows={1}
          autoFocus
        />

        {linhas.length === 0 && (
          <p style={styles.ajuda}>
            Uma linha por lançamento, com o valor no fim ou no começo.{" "}
            <b>+</b> na frente é entrada, sem sinal é saída. Data no começo
            (12/10) manda naquela linha.
          </p>
        )}

        {linhas.length > 0 && (
          <>
            <div style={styles.resumo}>
              <span style={styles.resumoRotulo}>
                {linhas.length}{" "}
                {linhas.length === 1 ? "lançamento" : "lançamentos"}
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

            {divergencia !== null && (
              <div style={styles.aviso}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>
                  O total escrito é {brl(lida.totalInformado!)}, mas as linhas
                  somam {brl(somaConferida)} —{" "}
                  {divergencia > 0 ? "faltam" : "sobram"}{" "}
                  {brl(Math.abs(divergencia))}. Dá para salvar assim mesmo.
                </span>
              </div>
            )}

            {repetidas.length > 0 && (
              <div style={styles.avisoForte}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <div>
                  <span>
                    {repetidas.length === 1
                      ? "1 linha já está lançada"
                      : `${repetidas.length} linhas já estão lançadas`}{" "}
                    com a mesma descrição, valor e data. Salvar assim vai
                    duplicar.
                  </span>
                  <button
                    type="button"
                    onClick={tirarRepetidas}
                    style={styles.avisoAcao}
                  >
                    {repetidas.length === 1
                      ? "Tirar a repetida"
                      : `Tirar as ${repetidas.length} repetidas`}
                  </button>
                </div>
              </div>
            )}

            <div style={styles.previa}>
              {linhas.map((linha) => {
                const entrada = linha.tipo === "entrada";
                const cor = entrada ? "var(--green)" : "var(--red)";
                return (
                  <div key={chave(linha)} style={styles.linha}>
                    <div style={styles.linhaTopo}>
                      <button
                        type="button"
                        onClick={() => trocarTipo(linha)}
                        style={{
                          ...styles.sinal,
                          background: entrada
                            ? "var(--green-soft)"
                            : "var(--red-soft)",
                          color: cor,
                        }}
                        aria-label={`${linha.descricao}: ${
                          entrada ? "entrada" : "saída"
                        }. Tocar para trocar.`}
                        title="Trocar entre entrada e saída"
                      >
                        {entrada ? "+" : "−"}
                      </button>
                      <span style={styles.linhaDescricao}>
                        {linha.descricao}
                      </span>
                      <span style={{ ...styles.linhaValor, color: cor }}>
                        {brl(linha.valor)}
                      </span>
                    </div>
                    <div style={styles.linhaBase}>
                      <select
                        value={linha.categoria}
                        onChange={(e) =>
                          trocarCategoria(linha, e.target.value)
                        }
                        style={styles.selectCategoria}
                        aria-label={`Categoria de ${linha.descricao}`}
                      >
                        {categoriasDe(linha.tipo).map((c) => (
                          <option key={c.nome} value={c.nome}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                      {existentes.has(chaveExata(linha)) && (
                        <span style={styles.selo}>já existe</span>
                      )}
                      <span style={styles.linhaData}>{diaMes(linha.data)}</span>
                      <button
                        type="button"
                        style={styles.linhaRemover}
                        onClick={() => remover(linha)}
                        aria-label={`Tirar ${linha.descricao} da lista`}
                        title="Tirar da lista"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
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

        {precisaData && (
          <>
            <label htmlFor="adicionar-data" style={styles.lbl}>
              {linhas.length > 1 ? "Data das linhas sem data" : "Data"}
            </label>
            <input
              id="adicionar-data"
              type="date"
              style={styles.input}
              value={dataLote}
              onChange={(e) => setDataLote(e.target.value)}
            />
          </>
        )}

        <button
          type="button"
          style={{
            ...styles.salvar,
            opacity: linhas.length === 0 || salvando ? 0.5 : 1,
            cursor:
              linhas.length === 0 || salvando ? "not-allowed" : "pointer",
          }}
          onClick={submit}
          disabled={linhas.length === 0 || salvando}
        >
          {salvando
            ? "Salvando..."
            : linhas.length === 0
              ? "Escreva ou cole acima"
              : linhas.length === 1
                ? "Salvar lançamento"
                : `Salvar ${linhas.length} lançamentos`}
        </button>

        <button
          type="button"
          style={styles.formulario}
          onClick={abrirFormulario}
        >
          <SlidersHorizontal size={14} /> Abrir formulário completo
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
    marginBottom: 14,
  },
  titulo: { fontSize: 19, fontWeight: 700 },
  fechar: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
  },
  textarea: {
    width: "100%",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "12px 14px",
    color: "var(--text)",
    // 16px evita o zoom automático do Safari no iPhone ao focar o campo.
    fontSize: 16,
    lineHeight: 1.5,
    outline: "none",
    resize: "none",
    overflow: "auto",
    fontFamily: "inherit",
  },
  ajuda: {
    fontSize: 12,
    color: "var(--text-faint)",
    lineHeight: 1.5,
    marginTop: 8,
  },
  resumo: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 16,
    paddingBottom: 8,
    borderBottom: "1px solid var(--border)",
  },
  resumoRotulo: { fontSize: 13, color: "var(--text-soft)", fontWeight: 600 },
  resumoValor: {
    fontFamily: "'Sora', sans-serif",
    fontSize: 20,
    fontWeight: 700,
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
  avisoForte: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    background: "var(--red-soft)",
    color: "var(--text-soft)",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 12.5,
    lineHeight: 1.45,
    marginTop: 10,
  },
  avisoAcao: {
    display: "block",
    marginTop: 6,
    background: "none",
    border: "none",
    padding: 0,
    color: "var(--red)",
    fontSize: 12.5,
    fontWeight: 700,
    textDecoration: "underline",
  },
  selo: {
    background: "var(--red-soft)",
    color: "var(--red)",
    fontSize: 10.5,
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: 6,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  previa: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 12,
  },
  linha: {
    background: "var(--bg)",
    borderRadius: 12,
    padding: "9px 10px",
  },
  linhaTopo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  sinal: {
    flex: "0 0 auto",
    width: 30,
    height: 30,
    borderRadius: 9,
    border: "none",
    fontSize: 17,
    fontWeight: 700,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  linhaDescricao: {
    flex: 1,
    fontSize: 14,
    color: "var(--text)",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  linhaValor: {
    fontFamily: "'Sora', sans-serif",
    fontSize: 14,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  linhaBase: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 7,
    paddingLeft: 38,
    minWidth: 0,
  },
  selectCategoria: {
    flex: 1,
    minWidth: 0,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "5px 6px",
    color: "var(--text-soft)",
    fontSize: 12.5,
    outline: "none",
  },
  linhaData: {
    fontSize: 12,
    color: "var(--text-faint)",
    whiteSpace: "nowrap",
  },
  linhaRemover: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
    padding: 4,
  },
  ignoradas: {
    fontSize: 12,
    color: "var(--text-faint)",
    marginTop: 12,
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
    fontSize: 16,
    outline: "none",
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
  formulario: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: "none",
    border: "none",
    color: "var(--text-soft)",
    fontSize: 13,
    fontWeight: 500,
    padding: "12px 0 2px",
  },
};
