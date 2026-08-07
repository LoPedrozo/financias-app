import { useState } from "react";
import { X } from "lucide-react";
import { CATEGORIAS_SAIDA } from "../types";
import type { ItemLista, NovoItemLista } from "../types";

interface Props {
  onFechar: () => void;
  onSalvar: (dados: NovoItemLista) => Promise<void> | void;
  itemParaEditar?: ItemLista;
  vencimentoInicial: string;
}

interface Erros {
  valor?: string;
  descricao?: string;
  categoria?: string;
  vencimento?: string;
}

export default function ModalItem({
  onFechar,
  onSalvar,
  itemParaEditar,
  vencimentoInicial,
}: Props) {
  const editando = !!itemParaEditar;

  const [valor, setValor] = useState(
    itemParaEditar ? String(itemParaEditar.valor).replace(".", ",") : ""
  );
  const [descricao, setDescricao] = useState(itemParaEditar?.descricao ?? "");
  const [categoria, setCategoria] = useState(() => {
    if (!itemParaEditar) return CATEGORIAS_SAIDA[0].nome;
    const existe = CATEGORIAS_SAIDA.some(
      (c) => c.nome === itemParaEditar.categoria
    );
    return existe ? itemParaEditar.categoria : CATEGORIAS_SAIDA[0].nome;
  });
  const [vencimento, setVencimento] = useState(
    itemParaEditar?.vencimento ?? vencimentoInicial
  );
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);

  function onValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValor(e.target.value.replace(/[^0-9.,]/g, ""));
    if (erros.valor) setErros((er) => ({ ...er, valor: undefined }));
  }

  // Mesmas regras do ModalNovo: um valor que o banco recusaria deve ser barrado
  // aqui, com explicação, em vez de virar erro genérico depois.
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
    if (!categoria) novos.categoria = "Selecione uma categoria.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) {
      novos.vencimento = "Informe uma data de vencimento válida.";
    }
    return novos;
  }

  async function submit() {
    if (salvando) return;
    const novosErros = validar();
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setSalvando(true);
    try {
      await onSalvar({
        descricao: descricao.trim(),
        valor: parseFloat(valor.replace(",", ".")),
        categoria,
        vencimento,
      });
    } finally {
      setSalvando(false);
    }
  }

  function inputStyle(invalido?: boolean): React.CSSProperties {
    return {
      ...styles.input,
      borderColor: invalido ? "var(--red)" : "var(--border)",
      marginBottom: invalido ? 4 : 14,
    };
  }

  return (
    <div style={styles.overlay} data-modal onClick={onFechar}>
      <div
        style={styles.modal}
        className="modal-mobile"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.head}>
          <h3 style={styles.titulo}>{editando ? "Editar conta" : "Nova conta"}</h3>
          <button style={styles.fechar} onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <label htmlFor="item-vencimento" style={styles.lbl}>
          Vencimento
        </label>
        <input
          id="item-vencimento"
          type="date"
          style={inputStyle(!!erros.vencimento)}
          value={vencimento}
          onChange={(e) => {
            setVencimento(e.target.value);
            if (erros.vencimento)
              setErros((er) => ({ ...er, vencimento: undefined }));
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {erros.vencimento && <p style={styles.erro}>{erros.vencimento}</p>}

        <label htmlFor="item-valor" style={styles.lbl}>
          Valor (R$)
        </label>
        <input
          id="item-valor"
          style={inputStyle(!!erros.valor)}
          value={valor}
          inputMode="decimal"
          placeholder="0,00"
          autoFocus
          onChange={onValorChange}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {erros.valor && <p style={styles.erro}>{erros.valor}</p>}

        <label htmlFor="item-descricao" style={styles.lbl}>
          Descrição
        </label>
        <input
          id="item-descricao"
          maxLength={120}
          style={inputStyle(!!erros.descricao)}
          value={descricao}
          placeholder="ex: cartão de crédito"
          onChange={(e) => {
            setDescricao(e.target.value);
            if (erros.descricao)
              setErros((er) => ({ ...er, descricao: undefined }));
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {erros.descricao && <p style={styles.erro}>{erros.descricao}</p>}

        <label htmlFor="item-categoria" style={styles.lbl}>
          Categoria
        </label>
        <select
          id="item-categoria"
          style={inputStyle(!!erros.categoria)}
          value={categoria}
          onChange={(e) => {
            setCategoria(e.target.value);
            if (erros.categoria)
              setErros((er) => ({ ...er, categoria: undefined }));
          }}
        >
          {CATEGORIAS_SAIDA.map((c) => (
            <option key={c.nome} value={c.nome}>
              {c.nome}
            </option>
          ))}
        </select>
        {erros.categoria && <p style={styles.erro}>{erros.categoria}</p>}

        <button
          style={{
            ...styles.salvar,
            opacity: salvando ? 0.7 : 1,
            cursor: salvando ? "not-allowed" : "pointer",
          }}
          onClick={submit}
          disabled={salvando}
        >
          {salvando
            ? "Salvando..."
            : editando
              ? "Salvar alterações"
              : "Adicionar conta"}
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
  erro: { fontSize: 12.5, color: "var(--red)", marginTop: 0, marginBottom: 12 },
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
