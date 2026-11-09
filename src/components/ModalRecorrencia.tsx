import { useId, useMemo, useState } from "react";
import { AlertTriangle, Check, Info } from "lucide-react";
import { CATEGORIAS_SAIDA } from "../types";
import type {
  Frequencia,
  Lancamento,
  NovaRecorrencia,
  Recorrencia,
  Tipo,
} from "../types";
import { datasParaRecorrencia, podeGerarNaCompetencia } from "../lib/recorrencias";
import { chaveDaConta } from "../lib/duplicatas";
import { brl, erroDoValor, lerValor } from "../lib/format";
import Folha from "./Folha";
import {
  AlternarTipo,
  BotaoPrincipal,
  CampoValor,
  Chips,
  GradeCategorias,
  Segmentado,
  campoComErro,
  categoriasDe,
  estiloErro,
  estiloRotulo,
} from "./campos";

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

// Chips com o nome curto; o completo é o que o leitor de tela anuncia.
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"].map(
  (nome, valor) => ({ valor, nome, curto: nome.slice(0, 3) })
);

export default function ModalRecorrencia({
  onFechar,
  onSalvar,
  recorrenciaParaEditar,
  mesAlvo,
}: Props) {
  const editando = !!recorrenciaParaEditar;
  const ids = useId();

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

  const limparErro = (campo: keyof Erros) => {
    if (erros[campo]) setErros((er) => ({ ...er, [campo]: undefined }));
  };

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
    const erroValor = erroDoValor(valor);
    if (erroValor) novos.valor = erroValor;
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

    const v = lerValor(valor)!;
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

  return (
    <Folha
      titulo={editando ? "Editar recorrência" : "Nova recorrência"}
      onFechar={onFechar}
      rodape={
        <BotaoPrincipal onClick={submit} desligado={salvando} icone={<Check size={19} aria-hidden="true" />}>
          {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Salvar recorrência"}
        </BotaoPrincipal>
      }
    >
      <AlternarTipo tipo={tipo} onTrocar={trocarTipo} />

      <CampoValor
        id="rec-valor"
        valor={valor}
        tipo={tipo}
        erro={erros.valor}
        onEnter={submit}
        onMudar={(v) => {
          setValor(v);
          limparErro("valor");
        }}
      />

      <label htmlFor="rec-descricao" style={estiloRotulo}>Descrição</label>
      <input
        id="rec-descricao"
        maxLength={120}
        enterKeyHint="done"
        style={campoComErro(erros.descricao)}
        value={descricao}
        placeholder={tipo === "entrada" ? "ex: mesada" : "ex: Netflix"}
        aria-invalid={!!erros.descricao}
        onChange={(e) => {
          setDescricao(e.target.value);
          limparErro("descricao");
        }}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {erros.descricao && <p style={estiloErro}>{erros.descricao}</p>}

      {/* Logo abaixo da descrição, que é onde a coincidência aparece: com o
          Salvar fixo no rodapé, um aviso no fim da folha podia nunca ser
          visto. */}
      {conflito && (
        <div style={styles.conflito}>
          <div style={styles.conflitoTopo}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1, color: "var(--red)" }} />
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

      <GradeCategorias
        id={`${ids}-categoria`}
        tipo={tipo}
        categoria={categoria}
        erro={erros.categoria}
        onEscolher={(c) => {
          setCategoria(c);
          limparErro("categoria");
        }}
      />

      <p style={estiloRotulo}>Repete</p>
      <Segmentado
        rotulo="Frequência"
        valor={frequencia}
        opcoes={[
          { valor: "semanal", nome: "Semanal" },
          { valor: "mensal", nome: "Mensal" },
        ]}
        onMudar={(f) => {
          setFrequencia(f);
          limparErro("dia");
        }}
      />

      {frequencia === "semanal" ? (
        <>
          <p style={estiloRotulo}>Dia da semana</p>
          <Chips rotulo="Dia da semana" opcoes={DIAS_SEMANA} valor={diaSemana} onMudar={setDiaSemana} />
        </>
      ) : (
        <>
          <label htmlFor="rec-dia-mes" style={estiloRotulo}>Dia do mês</label>
          <input
            id="rec-dia-mes"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            style={{ ...campoComErro(erros.dia), width: 120 }}
            value={diaMes}
            aria-invalid={!!erros.dia}
            onChange={(e) => {
              setDiaMes(e.target.value.replace(/[^0-9]/g, ""));
              limparErro("dia");
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {erros.dia && <p style={estiloErro}>{erros.dia}</p>}
        </>
      )}

      {/* Sem isto, quem cria a primeira recorrência não tem como saber que
          meses fechados ficam de fora — e quem edita não sabe que os
          lançamentos já contabilizados não mudam. */}
      <p style={styles.nota}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
        {editando
          ? "Lançamentos futuros serão recriados com os novos valores. Lançamentos já contabilizados não são alterados."
          : "A recorrência será gerada a partir do mês atual. Meses anteriores não são afetados."}
      </p>

    </Folha>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nota: {
    display: "flex",
    alignItems: "flex-start",
    gap: 7,
    fontSize: 12.5,
    color: "var(--text-faint)",
    lineHeight: 1.45,
    margin: "16px 0 4px",
  },
  conflito: {
    background: "var(--red-soft)",
    borderRadius: 12,
    padding: "12px 14px",
    margin: "12px 0 6px",
  },
  conflitoTopo: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    fontSize: 13,
    lineHeight: 1.45,
    color: "var(--text-soft)",
  },
  conflitoOpcao: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 10,
    fontSize: 13,
    lineHeight: 1.45,
    color: "var(--text)",
    fontWeight: 500,
    cursor: "pointer",
  },
  conflitoCheck: {
    width: 20,
    height: 20,
    flexShrink: 0,
    marginTop: 0,
    accentColor: "var(--accent)",
  },
};
