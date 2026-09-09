import { useMemo, useState } from "react";
import { X, Info, AlertTriangle } from "lucide-react";
import { CATEGORIAS_SAIDA, CATEGORIAS_ENTRADA } from "../types";
import type {
  Frequencia,
  Lancamento,
  NovaRecorrencia,
  Recorrencia,
  Tipo,
} from "../types";
import { datasParaRecorrencia, podeGerarNaCompetencia } from "../lib/recorrencias";
import { chaveDaConta } from "../lib/duplicatas";
import { brl } from "../lib/format";

// O mês em que a regra vai materializar sua primeira ocorrência — é lá que
// aparece a cópia, se a conta já tiver sido lançada à mão.
export interface MesAlvo {
  mes: number;
  ano: number;
  nome: string;
  lancamentos: Lancamento[];
}

interface Props {
  onFechar: () => void;
  /** `datasParaPular` vem preenchida quando o usuário aceita não gerar no mês. */
  onSalvar: (
    dados: NovaRecorrencia,
    datasParaPular: string[]
  ) => Promise<void>;
  recorrenciaParaEditar?: Recorrencia;
  mesAlvo?: MesAlvo;
}

interface Erros {
  valor?: string;
  descricao?: string;
  categoria?: string;
  dia?: string;
}

const DIAS_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

function categoriasDe(tipo: Tipo) {
  return tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
}

export default function ModalRecorrencia({
  onFechar,
  onSalvar,
  recorrenciaParaEditar,
  mesAlvo,
}: Props) {
  const editando = !!recorrenciaParaEditar;

  const [tipo, setTipo] = useState<Tipo>(
    recorrenciaParaEditar?.tipo ?? "saida"
  );
  const [valor, setValor] = useState(
    recorrenciaParaEditar
      ? String(recorrenciaParaEditar.valor).replace(".", ",")
      : ""
  );
  const [descricao, setDescricao] = useState(
    recorrenciaParaEditar?.descricao ?? ""
  );
  const [categoria, setCategoria] = useState(() => {
    if (recorrenciaParaEditar) {
      const lista = categoriasDe(recorrenciaParaEditar.tipo);
      const existe = lista.some(
        (c) => c.nome === recorrenciaParaEditar.categoria
      );
      return existe ? recorrenciaParaEditar.categoria : lista[0].nome;
    }
    return CATEGORIAS_SAIDA[0].nome;
  });
  const [frequencia, setFrequencia] = useState<Frequencia>(
    recorrenciaParaEditar?.frequencia ?? "mensal"
  );
  const [diaSemana, setDiaSemana] = useState<number>(
    recorrenciaParaEditar?.dia_semana ?? 1
  );
  const [diaMes, setDiaMes] = useState<string>(
    recorrenciaParaEditar?.dia_mes != null
      ? String(recorrenciaParaEditar.dia_mes)
      : "1"
  );
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [pularMes, setPularMes] = useState(true);

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

  // Criar uma recorrência para algo que já está lançado à mão naquele mês era
  // o jeito mais fácil de ver valor dobrado: a geração casa por
  // (recorrencia_id, data) e não enxerga o lançamento manual, então as duas
  // cópias convivem e o saldo conta as duas.
  const conflito = useMemo(() => {
    if (editando || !mesAlvo) return null;

    const desc = descricao.trim();
    if (desc.length < 3) return null;

    // Mês fechado não gera nada, então não há o que avisar.
    if (
      !podeGerarNaCompetencia(new Date().toISOString(), {
        mes: mesAlvo.mes,
        ano: mesAlvo.ano,
      })
    ) {
      return null;
    }

    const dia = Number(diaMes);
    if (
      frequencia === "mensal" &&
      (!Number.isInteger(dia) || dia < 1 || dia > 31)
    ) {
      return null;
    }

    const alvo = chaveDaConta({ tipo, descricao: desc });
    const manual = mesAlvo.lancamentos.find(
      (l) => !l.recorrencia_id && chaveDaConta(l) === alvo
    );
    if (!manual) return null;

    const datas = datasParaRecorrencia(
      {
        frequencia,
        dia_semana: frequencia === "semanal" ? diaSemana : undefined,
        dia_mes: frequencia === "mensal" ? dia : undefined,
      },
      mesAlvo.mes,
      mesAlvo.ano
    );
    if (datas.length === 0) return null;

    return { manual, datas };
  }, [editando, mesAlvo, descricao, tipo, frequencia, diaSemana, diaMes]);

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
    if (frequencia === "mensal") {
      const d = Number(diaMes);
      if (!Number.isInteger(d) || d < 1 || d > 31) {
        novos.dia = "Dia do mês deve ser entre 1 e 31.";
      }
    }
    return novos;
  }

  async function submit() {
    if (salvando) return;
    const novosErros = validar();
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const v = parseFloat(valor.replace(",", "."));
    const dados: NovaRecorrencia = {
      tipo,
      valor: v,
      descricao: descricao.trim(),
      categoria,
      frequencia,
      ativo: recorrenciaParaEditar?.ativo ?? true,
      dia_semana: frequencia === "semanal" ? diaSemana : undefined,
      dia_mes: frequencia === "mensal" ? Number(diaMes) : undefined,
    };
    setSalvando(true);
    try {
      await onSalvar(dados, conflito && pularMes ? conflito.datas : []);
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

  const lista = categoriasDe(tipo);

  return (
    <div style={styles.overlay} data-modal onClick={onFechar}>
      <div
        style={styles.modal}
        className="modal-mobile"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.head}>
          <h3 style={styles.titulo}>
            {editando ? "Editar recorrência" : "Nova recorrência"}
          </h3>
          <button style={styles.fechar} onClick={onFechar} aria-label="Fechar">
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

        <label htmlFor="rec-valor" style={styles.lbl}>
          Valor (R$)
        </label>
        <input
          id="rec-valor"
          style={inputStyle(!!erros.valor)}
          value={valor}
          inputMode="decimal"
          placeholder="0,00"
          autoFocus
          onChange={onValorChange}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {erros.valor && <p style={styles.erro}>{erros.valor}</p>}

        <label htmlFor="rec-descricao" style={styles.lbl}>
          Descrição
        </label>
        <input
          id="rec-descricao"
          maxLength={120}
          style={inputStyle(!!erros.descricao)}
          value={descricao}
          placeholder={
            tipo === "entrada" ? "ex: mesada" : "ex: Netflix"
          }
          onChange={(e) => {
            setDescricao(e.target.value);
            if (erros.descricao)
              setErros((er) => ({ ...er, descricao: undefined }));
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {erros.descricao && <p style={styles.erro}>{erros.descricao}</p>}

        <label htmlFor="rec-categoria" style={styles.lbl}>
          Categoria
        </label>
        <select
          id="rec-categoria"
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

        <label style={styles.lbl}>Frequência</label>
        <div style={styles.toggle}>
          {(["semanal", "mensal"] as Frequencia[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFrequencia(f);
                if (erros.dia) setErros((er) => ({ ...er, dia: undefined }));
              }}
              style={{
                ...styles.toggleBtn,
                ...(frequencia === f
                  ? {
                      background: "var(--accent)",
                      color: "#fff",
                    }
                  : {}),
              }}
            >
              {f === "semanal" ? "Semanal" : "Mensal"}
            </button>
          ))}
        </div>

        {frequencia === "semanal" ? (
          <>
            <label htmlFor="rec-dia-semana" style={styles.lbl}>
              Dia da semana
            </label>
            <select
              id="rec-dia-semana"
              style={inputStyle(false)}
              value={diaSemana}
              onChange={(e) => setDiaSemana(Number(e.target.value))}
            >
              {DIAS_SEMANA.map((nome, i) => (
                <option key={i} value={i}>
                  {nome}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label htmlFor="rec-dia-mes" style={styles.lbl}>
              Dia do mês
            </label>
            <input
              id="rec-dia-mes"
              type="number"
              min={1}
              max={31}
              style={inputStyle(!!erros.dia)}
              value={diaMes}
              onChange={(e) => {
                setDiaMes(e.target.value.replace(/[^0-9]/g, ""));
                if (erros.dia) setErros((er) => ({ ...er, dia: undefined }));
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            {erros.dia && <p style={styles.erro}>{erros.dia}</p>}
          </>
        )}

        {/* Sem isto, quem cria a primeira recorrência não tem como saber que
            meses fechados ficam de fora — e quem edita não sabe que os
            lançamentos já contabilizados não mudam. */}
        <p style={styles.nota}>
          <Info size={12} />
          {editando
            ? "Lançamentos futuros serão recriados com os novos valores. Lançamentos já contabilizados não são alterados."
            : "A recorrência será gerada a partir do mês atual. Meses anteriores não são afetados."}
        </p>

        {conflito && (
          <div style={styles.conflito}>
            <div style={styles.conflitoTopo}>
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>
                {mesAlvo!.nome} já tem{" "}
                <b>{conflito.manual.descricao}</b> ({brl(conflito.manual.valor)})
                lançado à mão. A recorrência criaria uma segunda cópia.
              </span>
            </div>
            <label style={styles.conflitoOpcao}>
              <input
                type="checkbox"
                checked={pularMes}
                onChange={(e) => setPularMes(e.target.checked)}
                style={styles.conflitoCheck}
              />
              <span>
                Não gerar em {mesAlvo!.nome} — mantenho o que já está lançado.
                A partir do mês seguinte, gera normal.
              </span>
            </label>
          </div>
        )}

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
            : "Salvar recorrência"}
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
    maxHeight: "calc(100vh - 40px)",
    overflowY: "auto",
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
  nota: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 6,
    fontSize: 12,
    color: "var(--text-faint)",
    textAlign: "center",
    lineHeight: 1.45,
    marginTop: 6,
    marginBottom: 2,
  },
  conflito: {
    background: "var(--red-soft)",
    borderRadius: 10,
    padding: "11px 12px",
    marginTop: 6,
    marginBottom: 4,
  },
  conflitoTopo: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    fontSize: 12.5,
    lineHeight: 1.45,
    color: "var(--text-soft)",
  },
  conflitoOpcao: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 10,
    fontSize: 12.5,
    lineHeight: 1.45,
    color: "var(--text)",
    fontWeight: 500,
    cursor: "pointer",
  },
  conflitoCheck: {
    width: 17,
    height: 17,
    flexShrink: 0,
    marginTop: 1,
    accentColor: "var(--accent)",
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
