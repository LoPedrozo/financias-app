import { useState } from "react";
import { X } from "lucide-react";
import { CATEGORIAS_SAIDA, CATEGORIAS_ENTRADA } from "../types";
import type { Lancamento, NovoLancamento, Tipo } from "../types";

interface Props {
  onFechar: () => void;
  onSalvar: (item: NovoLancamento) => void;
  lancamentoParaEditar?: Lancamento;
  dataInicial?: string;
}

interface Erros {
  valor?: string;
  descricao?: string;
  categoria?: string;
  data?: string;
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function categoriasDe(tipo: Tipo) {
  return tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
}

export default function ModalNovo({
  onFechar,
  onSalvar,
  lancamentoParaEditar,
  dataInicial,
}: Props) {
  const editando = !!lancamentoParaEditar;

  const [tipo, setTipo] = useState<Tipo>(lancamentoParaEditar?.tipo ?? "saida");
  const [valor, setValor] = useState(
    lancamentoParaEditar ? String(lancamentoParaEditar.valor).replace(".", ",") : ""
  );
  const [descricao, setDescricao] = useState(
    lancamentoParaEditar?.descricao ?? ""
  );
  const [categoria, setCategoria] = useState(() => {
    if (lancamentoParaEditar) {
      const lista = categoriasDe(lancamentoParaEditar.tipo);
      const existe = lista.some((c) => c.nome === lancamentoParaEditar.categoria);
      return existe ? lancamentoParaEditar.categoria : lista[0].nome;
    }
    return CATEGORIAS_SAIDA[0].nome;
  });
  const [data, setData] = useState<string>(() => {
    if (lancamentoParaEditar?.data) return lancamentoParaEditar.data;
    if (lancamentoParaEditar?.created_at) {
      return lancamentoParaEditar.created_at.slice(0, 10);
    }
    return dataInicial ?? hoje();
  });
  const [erros, setErros] = useState<Erros>({});

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

  function validar(): Erros {
    const novos: Erros = {};
    const v = parseFloat(valor.replace(",", "."));
    if (!valor.trim() || isNaN(v) || v <= 0) {
      novos.valor = "Informe um valor numérico maior que zero.";
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

  function submit() {
    const novosErros = validar();
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const v = parseFloat(valor.replace(",", "."));
    const [yyyy, mm] = data.split("-");
    const ano = Number(yyyy);
    const mes = Number(mm) - 1;
    onSalvar({
      tipo,
      valor: v,
      descricao: descricao.trim(),
      categoria,
      mes,
      ano,
      data,
    });
  }

  function inputStyle(invalido?: boolean): React.CSSProperties {
    return {
      ...styles.input,
      borderColor: invalido ? "var(--red)" : "var(--border)",
      marginBottom: invalido ? 4 : 14,
    };
  }

  const lista = categoriasDe(tipo);

  return (
    <div style={styles.overlay} onClick={onFechar}>
      <div style={styles.modal} className="modal-mobile" onClick={(e) => e.stopPropagation()}>
        <div style={styles.head}>
          <h3 style={styles.titulo}>
            {editando ? "Editar lançamento" : "Novo lançamento"}
          </h3>
          <button style={styles.fechar} onClick={onFechar}>
            <X size={18} />
          </button>
        </div>

        <div style={styles.toggle}>
          {(["saida", "entrada"] as Tipo[]).map((t) => (
            <button
              key={t}
              onClick={() => trocarTipo(t)}
              style={{
                ...styles.toggleBtn,
                ...(tipo === t
                  ? {
                      background:
                        t === "entrada" ? "var(--green)" : "var(--red)",
                      color: "#fff",
                    }
                  : {}),
              }}
            >
              {t === "entrada" ? "Entrada" : "Saída"}
            </button>
          ))}
        </div>

        <label style={styles.lbl}>Data</label>
        <input
          type="date"
          style={inputStyle(!!erros.data)}
          value={data}
          onChange={(e) => {
            setData(e.target.value);
            if (erros.data) setErros((er) => ({ ...er, data: undefined }));
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {erros.data && <p style={styles.erro}>{erros.data}</p>}

        <label style={styles.lbl}>Valor (R$)</label>
        <input
          style={inputStyle(!!erros.valor)}
          value={valor}
          inputMode="decimal"
          placeholder="0,00"
          autoFocus
          onChange={onValorChange}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {erros.valor && <p style={styles.erro}>{erros.valor}</p>}

        <label style={styles.lbl}>Descrição</label>
        <input
          style={inputStyle(!!erros.descricao)}
          value={descricao}
          placeholder={
            tipo === "entrada" ? "ex: salário de outubro" : "ex: almoço no RU"
          }
          onChange={(e) => {
            setDescricao(e.target.value);
            if (erros.descricao)
              setErros((er) => ({ ...er, descricao: undefined }));
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {erros.descricao && <p style={styles.erro}>{erros.descricao}</p>}

        <label style={styles.lbl}>Categoria</label>
        <select
          style={inputStyle(!!erros.categoria)}
          value={categoria}
          onChange={(e) => {
            setCategoria(e.target.value);
            if (erros.categoria)
              setErros((er) => ({ ...er, categoria: undefined }));
          }}
        >
          {lista.map((c) => (
            <option key={c.nome} value={c.nome}>
              {c.nome}
            </option>
          ))}
        </select>
        {erros.categoria && <p style={styles.erro}>{erros.categoria}</p>}

        <button style={styles.salvar} onClick={submit}>
          {editando ? "Salvar alterações" : "Salvar lançamento"}
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
    zIndex: 50,
  },
  modal: {
    background: "var(--surface)",
    borderRadius: 20,
    padding: 26,
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 20px 60px rgba(16,24,40,0.18)",
    animation: "fadeUp 0.25s ease",
  },
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  titulo: { fontSize: 19, fontWeight: 700 },
  fechar: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
  },
  toggle: {
    display: "flex",
    gap: 6,
    marginBottom: 18,
    background: "var(--bg)",
    padding: 4,
    borderRadius: 12,
  },
  toggleBtn: {
    flex: 1,
    padding: 10,
    border: "none",
    borderRadius: 9,
    background: "transparent",
    color: "var(--text-soft)",
    fontWeight: 600,
    fontSize: 14,
  },
  lbl: {
    fontSize: 13,
    color: "var(--text-soft)",
    marginBottom: 6,
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
    marginBottom: 14,
    outline: "none",
  },
  erro: {
    fontSize: 12.5,
    color: "var(--red)",
    marginTop: 0,
    marginBottom: 12,
  },
  salvar: {
    width: "100%",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    padding: 13,
    borderRadius: 12,
    fontWeight: 600,
    fontSize: 15,
    marginTop: 4,
  },
};
