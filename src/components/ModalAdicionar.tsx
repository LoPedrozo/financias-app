import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, SlidersHorizontal, Trash2 } from "lucide-react";
import type { Lancamento, NovoLancamento, Tipo } from "../types";
import type { LinhaLida } from "../lib/importarLancamentos";
import {
  interpretarLancamentos,
  paraLancamento,
  somarLinhas,
} from "../lib/importarLancamentos";
import { CATEGORIA_PADRAO, adivinharCategoria } from "../lib/categorias";
import { chaveExata, conjuntoExato } from "../lib/duplicatas";
import { lerRascunho, limparRascunho, salvarRascunho } from "../lib/rascunho";
import { brl } from "../lib/format";
import Folha from "./Folha";
import { AtalhosData, BORDA, BotaoLink, BotaoPrincipal, categoriasDe, estiloCampo } from "./campos";

// Um campo só para os dois casos que antes eram telas diferentes: digitar
// "almoço 25" e colar a lista inteira do mês. É a mesma gramática, e o número
// de linhas é que decide se aquilo é um lançamento ou uma leva.
//
// Não é mais o que o + abre: quem toca em adicionar cai no formulário, e
// chega aqui pelo "Escrever ou colar vários" de lá. Lançar um por um é o
// comum; a leva é a exceção, e exceção não merece a porta da frente.
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
//
// O sufixo separa linhas idênticas: dois ubers de R$ 18 no mesmo dia são dois
// lançamentos, e sem ele os dois dividiam chave — tirar um tirava os dois, e
// o React ainda reclamava de key repetida.
function chavearLinhas(itens: LinhaLida[]): string[] {
  const vistas = new Map<string, number>();
  return itens.map((linha) => {
    const base = `${linha.descricao}|${linha.valor}`;
    const quantas = vistas.get(base) ?? 0;
    vistas.set(base, quantas + 1);
    return quantas === 0 ? base : `${base}#${quantas}`;
  });
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
  // O texto do atalho de compartilhamento manda; sem ele, o que sobrou da
  // última vez que a aba foi descarregada no meio.
  const [texto, setTexto] = useState(() => textoInicial || lerRascunho());
  const [veioDeRascunho] = useState(
    () => !textoInicial && lerRascunho().trim().length > 0
  );
  const [dataLote, setDataLote] = useState(dataPadrao);
  const [ajustes, setAjustes] = useState<Record<string, Ajuste>>({});
  const [removidos, setRemovidos] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const ids = useId();

  const lida = useMemo(
    () => interpretarLancamentos(texto, dataLote),
    [texto, dataLote]
  );

  // A chave é calculada sobre a lista inteira, antes de filtrar: tirar uma
  // linha não pode renumerar as que sobraram.
  const visiveis = useMemo(() => {
    const chaves = chavearLinhas(lida.itens);
    return lida.itens
      .map((linha, i) => {
        const chave = chaves[i];
        const ajuste = ajustes[chave];
        return { chave, linha: ajuste ? { ...linha, ...ajuste } : linha };
      })
      .filter(({ chave }) => !removidos.has(chave));
  }, [lida.itens, ajustes, removidos]);

  const linhas = useMemo(() => visiveis.map((v) => v.linha), [visiveis]);

  useEffect(() => {
    salvarRascunho(texto);
  }, [texto]);

  // Cresce com o conteúdo até um teto, para a lista colada não empurrar o
  // botão de salvar para fora da tela do celular.
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = "auto";
    // O scrollHeight não conta a borda; sem somá-la, o campo ficava 2px mais
    // baixo que o texto e aparecia uma barra de rolagem à toa.
    const borda = area.offsetHeight - area.clientHeight;
    area.style.height = `${Math.min(area.scrollHeight + borda, 200)}px`;
  }, [texto]);

  // Recolar a mesma lista, ou salvar de novo depois de uma falha que na
  // verdade tinha entrado, são os dois jeitos de duplicar sem perceber.
  // O app não bloqueia — dois almoços de R$ 25 no mesmo dia existem —, mas
  // também não deixa passar calado.
  const existentes = useMemo(() => conjuntoExato(jaLancados), [jaLancados]);
  const repetidas = useMemo(
    () => visiveis.filter(({ linha }) => existentes.has(chaveExata(linha))),
    [visiveis, existentes]
  );

  function tirarRepetidas() {
    setRemovidos((atual) => {
      const proximo = new Set(atual);
      for (const { chave } of repetidas) proximo.add(chave);
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

  function trocarTipo(chave: string, linha: LinhaLida) {
    const tipo: Tipo = linha.tipo === "entrada" ? "saida" : "entrada";
    // A categoria antiga não existe na lista do outro tipo, então o palpite é
    // refeito em vez de deixar um valor órfão no select.
    setAjustes((atual) => ({
      ...atual,
      [chave]: {
        tipo,
        categoria: adivinharCategoria(linha.descricao, tipo) ?? CATEGORIA_PADRAO,
      },
    }));
  }

  function trocarCategoria(chave: string, linha: LinhaLida, categoria: string) {
    setAjustes((atual) => ({
      ...atual,
      [chave]: { tipo: linha.tipo, categoria },
    }));
  }

  function remover(chave: string) {
    setRemovidos((atual) => new Set(atual).add(chave));
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
    // O texto já está indo para o formulário; deixá-lo no rascunho o traria
    // de volta depois, e ele poderia ser salvo uma segunda vez.
    limparRascunho();
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
    // O mesmo nome do botão que traz até aqui: "Adicionar" parecia outra
    // tela, e não o "Escrever ou colar vários" que se acabou de tocar.
    <Folha
      titulo="Escrever ou colar vários"
      onFechar={onFechar}
      largura={460}
      rodape={
        <>
          <BotaoPrincipal
            onClick={submit}
            desligado={linhas.length === 0 || salvando}
            icone={linhas.length > 0 && !salvando ? <Check size={19} aria-hidden="true" /> : undefined}
          >
            {salvando
              ? "Salvando..."
              : linhas.length === 0
                ? "Escreva ou cole acima"
                : linhas.length === 1
                  ? "Salvar lançamento"
                  : `Salvar ${linhas.length} lançamentos`}
          </BotaoPrincipal>
          <BotaoLink icone={<SlidersHorizontal size={14} />} onClick={abrirFormulario}>
            Abrir formulário completo
          </BotaoLink>
        </>
      }
    >
      <textarea
        ref={areaRef}
        style={styles.textarea}
        value={texto}
        aria-label="Lançamentos, um por linha"
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

      {veioDeRascunho && texto.trim().length > 0 && (
        <p style={styles.rascunho}>
          Recuperei o que você tinha escrito.{" "}
          <button type="button" onClick={() => setTexto("")} style={styles.rascunhoAcao}>
            Limpar
          </button>
        </p>
      )}

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
              {linhas.length} {linhas.length === 1 ? "lançamento" : "lançamentos"}
            </span>
            <span style={{ ...styles.resumoValor, color: saldo >= 0 ? "var(--green)" : "var(--red)" }}>
              {saldo >= 0 ? "+" : "−"} {brl(Math.abs(saldo))}
            </span>
          </div>

          {divergencia !== null && (
            <div style={styles.aviso}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
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
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1, color: "var(--red)" }} />
              <div>
                <span>
                  {repetidas.length === 1
                    ? "1 linha já está lançada"
                    : `${repetidas.length} linhas já estão lançadas`}{" "}
                  com a mesma descrição, valor e data. Salvar assim vai
                  duplicar.
                </span>
                <button type="button" onClick={tirarRepetidas} style={styles.avisoAcao}>
                  {repetidas.length === 1 ? "Tirar a repetida" : `Tirar as ${repetidas.length} repetidas`}
                </button>
              </div>
            </div>
          )}

          <div style={styles.previa}>
            {visiveis.map(({ chave, linha }) => {
              const entrada = linha.tipo === "entrada";
              const cor = entrada ? "var(--green)" : "var(--red)";
              return (
                <div key={chave} style={styles.linha}>
                  <div style={styles.linhaTopo}>
                    <button
                      type="button"
                      onClick={() => trocarTipo(chave, linha)}
                      style={{
                        ...styles.sinal,
                        background: entrada ? "var(--green-soft)" : "var(--red-soft)",
                        color: cor,
                      }}
                      aria-label={`${linha.descricao}: ${entrada ? "entrada" : "saída"}. Tocar para trocar.`}
                      title="Trocar entre entrada e saída"
                    >
                      {entrada ? "+" : "−"}
                    </button>
                    <span style={styles.linhaDescricao}>{linha.descricao}</span>
                    <span style={{ ...styles.linhaValor, color: cor }}>{brl(linha.valor)}</span>
                  </div>
                  <div style={styles.linhaBase}>
                    <select
                      value={linha.categoria}
                      onChange={(e) => trocarCategoria(chave, linha, e.target.value)}
                      style={styles.selectCategoria}
                      aria-label={`Categoria de ${linha.descricao}`}
                    >
                      {categoriasDe(linha.tipo).map((c) => (
                        <option key={c.nome} value={c.nome}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                    {existentes.has(chaveExata(linha)) && <span style={styles.selo}>já existe</span>}
                    <span style={styles.linhaData}>{diaMes(linha.data)}</span>
                    <button
                      type="button"
                      style={styles.linhaRemover}
                      onClick={() => remover(chave)}
                      aria-label={`Tirar ${linha.descricao} da lista`}
                      title="Tirar da lista"
                    >
                      <Trash2 size={16} />
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
          {lida.ignoradas.length > 3 && ` e mais ${lida.ignoradas.length - 3}`}
        </p>
      )}

      {precisaData && (
        <AtalhosData
          id={`${ids}-data`}
          rotulo={linhas.length > 1 ? "Data das linhas sem data" : "Quando"}
          data={dataLote}
          onData={setDataLote}
        />
      )}
    </Folha>
  );
}

const styles: Record<string, React.CSSProperties> = {
  textarea: {
    ...estiloCampo,
    height: "auto",
    minHeight: 48,
    padding: "12px 14px",
    lineHeight: 1.5,
    resize: "none",
    overflow: "auto",
    fontFamily: "inherit",
  },
  rascunho: {
    fontSize: 12.5,
    color: "var(--text-soft)",
    lineHeight: 1.5,
    marginTop: 8,
  },
  rascunhoAcao: {
    background: "none",
    border: "none",
    padding: 0,
    color: "var(--destaque-texto)",
    fontSize: 12.5,
    fontWeight: 700,
    textDecoration: "underline",
    cursor: "pointer",
  },
  ajuda: {
    fontSize: 12.5,
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
    fontVariantNumeric: "tabular-nums",
  },
  aviso: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    background: "var(--accent-soft)",
    color: "var(--text-soft)",
    borderRadius: 12,
    padding: "11px 13px",
    fontSize: 13,
    lineHeight: 1.45,
    marginTop: 10,
  },
  avisoForte: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    background: "var(--red-soft)",
    color: "var(--text-soft)",
    borderRadius: 12,
    padding: "11px 13px",
    fontSize: 13,
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
    fontSize: 13,
    fontWeight: 700,
    textDecoration: "underline",
    cursor: "pointer",
  },
  selo: {
    background: "var(--red-soft)",
    color: "var(--red)",
    fontSize: 11,
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
    padding: "10px 10px 8px",
  },
  linhaTopo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  sinal: {
    flex: "0 0 auto",
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "none",
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  linhaDescricao: {
    flex: 1,
    fontSize: 14,
    color: "var(--text)",
    fontWeight: 600,
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
    fontVariantNumeric: "tabular-nums",
  },
  linhaBase: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    paddingLeft: 42,
    minWidth: 0,
  },
  selectCategoria: {
    flex: 1,
    minWidth: 0,
    height: 34,
    background: "var(--surface)",
    ...BORDA,
    borderRadius: 9,
    padding: "0 8px",
    color: "var(--text-soft)",
    // 16px: abaixo disso o iPhone dá zoom na página ao tocar na lista.
    fontSize: 16,
    outline: "none",
  },
  linhaData: {
    fontSize: 12.5,
    color: "var(--text-faint)",
    whiteSpace: "nowrap",
  },
  linhaRemover: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
    padding: 6,
    margin: -2,
    cursor: "pointer",
  },
  ignoradas: {
    fontSize: 12.5,
    color: "var(--text-faint)",
    marginTop: 12,
    lineHeight: 1.45,
  },
};
