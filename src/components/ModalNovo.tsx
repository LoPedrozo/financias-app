import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, Check, ClipboardPaste, X } from "lucide-react";
import { CATEGORIAS_SAIDA, CATEGORIAS_ENTRADA, MESES } from "../types";
import type { Lancamento, NovoLancamento, Tipo } from "../types";
import { hojeLocal } from "../lib/calculos";
import { useAreaVisivel } from "../hooks/useAreaVisivel";
import IconeCategoria from "./IconeCategoria";

// O formulário de um lançamento: o que o + abre e o que se usa para editar.
//
// O valor vem grande, no topo — é o que se digita primeiro e o que mais se
// confere. A data tem atalhos (Hoje, Ontem) porque quase todo lançamento é de
// um dos dois; "Outra" abre o calendário do aparelho. As categorias ficam em
// grade, com ícone, para escolher num toque em vez de abrir uma lista. O
// Salvar fica no rodapé da folha, sempre à vista, inclusive com o teclado
// aberto (ver useAreaVisivel).

interface Props {
  onFechar: () => void;
  onSalvar: (item: NovoLancamento) => Promise<void> | void;
  lancamentoParaEditar?: Lancamento;
  dataInicial?: string;
  // Abre o formulário já preenchido sem entrar em modo de edição — usado
  // quando uma conta paga vira lançamento no financeiro pessoal.
  valoresIniciais?: Partial<Pick<NovoLancamento, "tipo" | "valor" | "descricao" | "categoria">>;
  // Saída para o Adicionar, onde se escreve várias linhas de uma vez ou se
  // cola a lista pronta. Leva junto o que já foi digitado aqui, porque
  // trocar de tela não é motivo para perder o que a pessoa escreveu.
  onColarLista?: (
    valores: Partial<
      Pick<NovoLancamento, "tipo" | "valor" | "descricao" | "categoria">
    >,
    data: string
  ) => void;
}

interface Erros {
  valor?: string;
  descricao?: string;
  categoria?: string;
  data?: string;
}

function categoriasDe(tipo: Tipo) {
  return tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
}

// Na grade não cabe "Cartão de Crédito / Contas". O nome curto vai na tela;
// o completo é o que o leitor de tela anuncia e o que se grava.
const NOME_CURTO: Record<string, string> = {
  "Cartão de Crédito / Contas": "Cartão / Contas",
  "Freelance / Bico": "Freela / Bico",
  "Empréstimo recebido": "Empréstimo",
  "Rendimentos / Investimentos": "Rendimentos",
};

// O campo aceita "10,50" e também texto pela metade. Vale só o que já é
// número; o resto vira undefined e não atrapalha quem está de saída.
function valorNumerico(valor: string): number | undefined {
  const limpo = valor.trim().replace(",", ".");
  if (!limpo) return undefined;
  const n = parseFloat(limpo);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

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

// O valor encolhe conforme cresce, para caber num celular de 320px: na Sora,
// cada algarismo ocupa uns 0,62 da fonte.
function tamanhoDoValor(caracteres: number): number {
  return caracteres <= 6 ? 44 : caracteres <= 9 ? 36 : 30;
}

export default function ModalNovo({
  onFechar,
  onSalvar,
  lancamentoParaEditar,
  dataInicial,
  valoresIniciais,
  onColarLista,
}: Props) {
  const editando = !!lancamentoParaEditar;
  const ids = useId();
  const area = useAreaVisivel();
  const corpoRef = useRef<HTMLDivElement>(null);

  const [tipo, setTipo] = useState<Tipo>(
    lancamentoParaEditar?.tipo ?? valoresIniciais?.tipo ?? "entrada"
  );
  const [valor, setValor] = useState(() => {
    const inicial = lancamentoParaEditar?.valor ?? valoresIniciais?.valor;
    // Sempre com os centavos: em letra grande, "40,5" parece valor pela metade.
    return inicial == null ? "" : inicial.toFixed(2).replace(".", ",");
  });
  const [descricao, setDescricao] = useState(
    lancamentoParaEditar?.descricao ?? valoresIniciais?.descricao ?? ""
  );
  const [categoria, setCategoria] = useState(() => {
    if (lancamentoParaEditar) {
      const lista = categoriasDe(lancamentoParaEditar.tipo);
      const existe = lista.some((c) => c.nome === lancamentoParaEditar.categoria);
      return existe ? lancamentoParaEditar.categoria : lista[0].nome;
    }
    const lista = categoriasDe(valoresIniciais?.tipo ?? "entrada");
    const sugerida = valoresIniciais?.categoria;
    if (sugerida && lista.some((c) => c.nome === sugerida)) return sugerida;
    return lista[0].nome;
  });
  const [data, setData] = useState<string>(() => {
    if (lancamentoParaEditar?.data) return lancamentoParaEditar.data;
    if (lancamentoParaEditar?.created_at) {
      return lancamentoParaEditar.created_at.slice(0, 10);
    }
    return dataInicial ?? hojeLocal();
  });
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);

  const hoje = hojeLocal();
  const ontem = ontemLocal();
  const anoAtual = Number(hoje.slice(0, 4));
  const outraData = data !== hoje && data !== ontem && data !== "";

  // O teclado do iPhone abre depois do foco e encolhe a área visível: o campo
  // que estava à vista pode acabar atrás dele. Com a área nova, ele volta.
  useEffect(() => {
    const foco = document.activeElement;
    if (foco instanceof HTMLElement && corpoRef.current?.contains(foco)) {
      foco.scrollIntoView?.({ block: "nearest" });
    }
  }, [area?.height]);

  function trocarTipo(novoTipo: Tipo) {
    if (novoTipo === tipo) return;
    setTipo(novoTipo);
    setCategoria(categoriasDe(novoTipo)[0].nome);
    if (erros.categoria) setErros((er) => ({ ...er, categoria: undefined }));
  }

  function onValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const limpo = e.target.value.replace(/[^0-9.,]/g, "");
    setValor(limpo);
    if (erros.valor) setErros((er) => ({ ...er, valor: undefined }));
  }

  function escolherData(nova: string) {
    setData(nova);
    if (erros.data) setErros((er) => ({ ...er, data: undefined }));
  }

  // No computador, clicar no campo de data só seleciona o dia/mês/ano: o
  // calendário abre pelo showPicker. No celular, o toque já abre o seletor
  // do sistema — chamar de novo ali não ajuda.
  function abrirCalendario(e: React.MouseEvent<HTMLInputElement>) {
    if (!window.matchMedia?.("(pointer: fine)").matches) return;
    try {
      e.currentTarget.showPicker?.();
    } catch {
      // Navegador sem showPicker: fica o campo nativo, que funciona igual.
    }
  }

  function validar(): Erros {
    const novos: Erros = {};
    const valorLimpo = valor.trim();
    const formatoValido = /^\d+([.,]\d{1,2})?$/.test(valorLimpo);
    const v = parseFloat(valorLimpo.replace(",", "."));
    if (!valorLimpo) {
      novos.valor = "Informe um valor numérico maior que zero.";
    } else if (!formatoValido) {
      novos.valor = "Formato inválido. Use ex: 10,50 ou 10.50";
    } else if (isNaN(v) || v <= 0) {
      novos.valor = "Informe um valor numérico maior que zero.";
    } else if (v > 1_000_000_000) {
      novos.valor = "Valor muito alto. Verifique se digitou corretamente.";
    }
    if (descricao.trim().length < 3) {
      novos.descricao = "Descrição obrigatória (mínimo 3 caracteres).";
    }
    if (!categoria) {
      novos.categoria = "Selecione uma categoria.";
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      novos.data = "Informe uma data válida.";
    }
    return novos;
  }

  async function submit() {
    if (salvando) return;
    const novosErros = validar();
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const v = parseFloat(valor.replace(",", "."));
    const [yyyy, mm] = data.split("-");
    const ano = Number(yyyy);
    const mes = Number(mm) - 1;
    setSalvando(true);
    try {
      await onSalvar({
        tipo,
        valor: v,
        descricao: descricao.trim(),
        categoria,
        mes,
        ano,
        data,
      });
    } finally {
      setSalvando(false);
    }
  }

  const lista = categoriasDe(tipo);
  const corDoTipo = tipo === "entrada" ? "var(--green)" : "var(--red)";
  const tamanho = tamanhoDoValor(valor.length);
  // Teclado aberto: a área visível ficou bem menor que a janela. Aí a folga
  // da barra de gestos do iPhone, embaixo do Salvar, é só espaço perdido.
  const tecladoAberto = area !== null && window.innerHeight - area.height > 120;

  const chip = (ativo: boolean): React.CSSProperties => ({
    ...styles.chip,
    ...(ativo ? styles.chipAtivo : {}),
  });

  return (
    <div
      className="form-overlay"
      data-modal
      data-teclado={tecladoAberto ? "" : undefined}
      style={{ top: area?.top ?? 0, height: area?.height ?? "100%" }}
      onClick={onFechar}
    >
      <div
        className="form-folha"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-titulo`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="form-corpo" ref={corpoRef}>
          <div style={styles.head}>
            <h3 id={`${ids}-titulo`} style={styles.titulo}>
              {editando ? "Editar lançamento" : "Novo lançamento"}
            </h3>
            <button type="button" style={styles.fechar} onClick={onFechar} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          <div style={styles.toggle} role="group" aria-label="Tipo">
            {(["entrada", "saida"] as Tipo[]).map((t) => {
              const ativo = tipo === t;
              const Icone = t === "entrada" ? ArrowDown : ArrowUp;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => trocarTipo(t)}
                  style={{
                    ...styles.toggleBtn,
                    ...(ativo
                      ? { ...styles.toggleAtivo, color: t === "entrada" ? "var(--green)" : "var(--red)" }
                      : {}),
                  }}
                >
                  <Icone size={15} aria-hidden="true" />
                  {t === "entrada" ? "Entrada" : "Saída"}
                </button>
              );
            })}
          </div>

          <div style={styles.valorBloco}>
            <label htmlFor="campo-valor" style={{ ...styles.rotulo, margin: 0, textAlign: "center" }}>
              Valor
            </label>
            <div style={styles.valorLinha}>
              <span aria-hidden="true" style={{ ...styles.moeda, fontSize: Math.round(tamanho * 0.5) }}>
                R$
              </span>
              {/* O campo tem a largura exata do que está escrito: um espelho
                  invisível do texto (ou do "0,00") dá o tamanho, e o campo
                  ocupa esse espaço. Assim o "R$" fica colado no número e o
                  conjunto, no centro. */}
              <span style={{ ...styles.valorCaixa, fontSize: tamanho }}>
                <span aria-hidden="true" style={styles.valorEspelho}>
                  {valor || "0,00"}
                </span>
                <input
                  id="campo-valor"
                  className="form-valor"
                  value={valor}
                  inputMode="decimal"
                  placeholder="0,00"
                  autoComplete="off"
                  autoFocus
                  aria-invalid={!!erros.valor}
                  onChange={onValorChange}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  style={{ ...styles.valorInput, color: corDoTipo }}
                />
              </span>
            </div>
            {erros.valor && <p style={{ ...styles.erro, textAlign: "center" }}>{erros.valor}</p>}
          </div>

          <p id={`${ids}-quando`} style={styles.rotulo}>Quando</p>
          <div role="group" aria-labelledby={`${ids}-quando`} style={styles.chips}>
            <button type="button" aria-pressed={data === hoje} onClick={() => escolherData(hoje)} style={chip(data === hoje)}>
              Hoje <span className="chip-data" style={styles.chipData}>{dataCurta(hoje, anoAtual)}</span>
            </button>
            <button type="button" aria-pressed={data === ontem} onClick={() => escolherData(ontem)} style={chip(data === ontem)}>
              Ontem <span className="chip-data" style={styles.chipData}>{dataCurta(ontem, anoAtual)}</span>
            </button>
            {/* O campo de data de verdade fica por cima do chip, transparente:
                tocar no chip é tocar nele, e o aparelho abre o seletor dele. */}
            <span className="form-chip-outra" style={{ ...chip(outraData), position: "relative" }}>
              <CalendarDays size={15} aria-hidden="true" />
              {outraData ? dataCurta(data, anoAtual) : "Outra"}
              <input
                type="date"
                aria-label="Outra data"
                value={data}
                onClick={abrirCalendario}
                onChange={(e) => escolherData(e.target.value)}
                style={styles.dataPorCima}
              />
            </span>
          </div>
          {erros.data && <p style={styles.erro}>{erros.data}</p>}

          <label htmlFor="campo-descricao" style={styles.rotulo}>Descrição</label>
          <input
            id="campo-descricao"
            maxLength={120}
            enterKeyHint="done"
            style={{ ...styles.input, borderColor: erros.descricao ? "var(--red)" : "transparent" }}
            value={descricao}
            placeholder={tipo === "entrada" ? "ex: salário de outubro" : "ex: almoço no RU"}
            aria-invalid={!!erros.descricao}
            onChange={(e) => {
              setDescricao(e.target.value);
              if (erros.descricao) setErros((er) => ({ ...er, descricao: undefined }));
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {erros.descricao && <p style={styles.erro}>{erros.descricao}</p>}

          <p id={`${ids}-categoria`} style={styles.rotulo}>Categoria</p>
          <div role="radiogroup" aria-labelledby={`${ids}-categoria`} style={styles.grade}>
            {lista.map((c) => {
              const ativa = c.nome === categoria;
              return (
                <button
                  key={c.nome}
                  type="button"
                  role="radio"
                  aria-checked={ativa}
                  aria-label={c.nome}
                  onClick={() => {
                    setCategoria(c.nome);
                    if (erros.categoria) setErros((er) => ({ ...er, categoria: undefined }));
                  }}
                  style={{
                    ...styles.categoria,
                    // Hex com alfa, como no ícone: "24" é ~14% da cor.
                    ...(ativa ? { background: c.cor + "24", borderColor: c.cor } : {}),
                  }}
                >
                  <IconeCategoria tipo={tipo} categoria={c.nome} tamanho={32} />
                  <span style={{ ...styles.categoriaNome, color: ativa ? "var(--text)" : "var(--text-soft)" }}>
                    {NOME_CURTO[c.nome] ?? c.nome}
                  </span>
                </button>
              );
            })}
          </div>
          {erros.categoria && <p style={styles.erro}>{erros.categoria}</p>}
        </div>

        <div className="form-rodape">
          <button
            type="button"
            style={{
              ...styles.salvar,
              opacity: salvando ? 0.7 : 1,
              cursor: salvando ? "not-allowed" : "pointer",
            }}
            onClick={submit}
            disabled={salvando}
          >
            <Check size={19} aria-hidden="true" />
            {salvando
              ? "Salvando..."
              : editando
              ? "Salvar alterações"
              : tipo === "entrada"
              ? "Salvar entrada"
              : "Salvar saída"}
          </button>

          {!editando && onColarLista && (
            <button
              type="button"
              style={styles.colarLista}
              onClick={() =>
                onColarLista(
                  {
                    tipo,
                    valor: valorNumerico(valor),
                    descricao: descricao.trim(),
                    categoria,
                  },
                  data
                )
              }
            >
              <ClipboardPaste size={14} /> Escrever ou colar vários
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// A borda sempre em três propriedades, nunca o atalho `border`. Com o atalho
// mais um `borderColor` por cima, o React, ao tirar a cor de quem deixou de
// estar selecionado, deixava a borda sem cor nenhuma — e ela virava a cor do
// texto: um contorno branco no tema escuro.
const BORDA: React.CSSProperties = {
  borderWidth: 1.5,
  borderStyle: "solid",
  borderColor: "transparent",
};

const styles: Record<string, React.CSSProperties> = {
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  titulo: { fontSize: 16, fontWeight: 700 },
  fechar: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
    padding: 6,
    margin: -6,
    cursor: "pointer",
  },
  toggle: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 4,
    background: "var(--bg)",
    padding: 4,
    borderRadius: 12,
  },
  toggleBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    border: "none",
    borderRadius: 9,
    background: "transparent",
    color: "var(--text-faint)",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  toggleAtivo: { background: "var(--surface)", boxShadow: "var(--shadow)" },
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
  rotulo: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-faint)",
    margin: "14px 0 8px",
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
  input: {
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
  erro: {
    fontSize: 12.5,
    color: "var(--red)",
    margin: "6px 0 0",
  },
  salvar: {
    width: "100%",
    height: 52,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    fontWeight: 700,
    fontSize: 16,
  },
  colarLista: {
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
    padding: "10px 0 0",
    cursor: "pointer",
  },
};
