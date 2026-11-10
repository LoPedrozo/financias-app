import { useId, useState } from "react";
import type { CSSProperties } from "react";
import { Check, Trash2 } from "lucide-react";
import type { Cartao, Frequencia, NovoPrevistoCartao, PrevistoCartao } from "../types";
import { CATEGORIAS_SAIDA } from "../types";
import { erroDoValor, lerValor } from "../lib/format";
import { CATEGORIAS_ESSENCIAIS } from "../lib/fatura";
import Folha from "./Folha";
import {
  BotaoLink,
  BotaoPrincipal,
  CampoValor,
  Chips,
  GradeCategorias,
  Segmentado,
  campoComErro,
  estiloErro,
  estiloRotulo,
} from "./campos";

// Um gasto que se repete no cartão — o lanche de toda sexta, a gasolina de
// todo mês. Ele não vira compra sozinho: só entra na previsão da fatura, nos
// dias que ainda vão chegar até o fechamento. Quando o dia passa, quem conta
// é a compra lançada.

interface Props {
  cartao: Cartao;
  previsto?: PrevistoCartao;
  onSalvar: (dados: NovoPrevistoCartao) => Promise<boolean>;
  onApagar?: () => void;
  onFechar: () => void;
}

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"].map((nome, valor) => ({
  valor,
  nome,
  curto: nome.slice(0, 3),
}));

interface Erros {
  valor?: string;
  descricao?: string;
  dia?: string;
}

export default function ModalPrevisto({ cartao, previsto, onSalvar, onApagar, onFechar }: Props) {
  const ids = useId();
  const [valor, setValor] = useState(previsto ? previsto.valor.toFixed(2).replace(".", ",") : "");
  const [descricao, setDescricao] = useState(previsto?.descricao ?? "");
  const [categoria, setCategoria] = useState(() =>
    previsto && CATEGORIAS_SAIDA.some((c) => c.nome === previsto.categoria) ? previsto.categoria : CATEGORIAS_SAIDA[0].nome
  );
  const [frequencia, setFrequencia] = useState<Frequencia>(previsto?.frequencia ?? "semanal");
  const [diaSemana, setDiaSemana] = useState(previsto?.dia_semana ?? 5);
  const [diaMes, setDiaMes] = useState(String(previsto?.dia_mes ?? 10));
  const [essencialEscolhido, setEssencialEscolhido] = useState<boolean | null>(previsto?.essencial ?? null);
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);

  const essencialPelaCategoria = CATEGORIAS_ESSENCIAIS.has(categoria);
  const essencial = essencialEscolhido ?? essencialPelaCategoria;

  function validar(): Erros {
    const novos: Erros = {};
    const erroValor = erroDoValor(valor);
    if (erroValor) novos.valor = erroValor;
    if (descricao.trim().length < 2) novos.descricao = "Dê um nome (ex: lanche de sexta).";
    const d = Number(diaMes);
    if (frequencia === "mensal" && (!Number.isInteger(d) || d < 1 || d > 31)) novos.dia = "O dia do mês vai de 1 a 31.";
    return novos;
  }

  async function submit() {
    if (salvando) return;
    const novos = validar();
    setErros(novos);
    if (Object.keys(novos).length > 0) return;
    setSalvando(true);
    try {
      await onSalvar({
        cartao_id: cartao.id,
        descricao: descricao.trim(),
        valor: lerValor(valor)!,
        categoria,
        frequencia,
        dia_semana: frequencia === "semanal" ? diaSemana : null,
        dia_mes: frequencia === "mensal" ? Number(diaMes) : null,
        essencial: essencialEscolhido === essencialPelaCategoria ? null : essencialEscolhido,
        ativo: previsto?.ativo ?? true,
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Folha
      titulo={previsto ? "Editar previsto" : "Gasto previsto"}
      onFechar={onFechar}
      zIndex={70}
      rodape={
        <>
          <BotaoPrincipal onClick={submit} desligado={salvando} icone={<Check size={19} aria-hidden="true" />}>
            {salvando ? "Salvando..." : previsto ? "Salvar alterações" : "Salvar previsto"}
          </BotaoPrincipal>
          {previsto && onApagar && (
            <BotaoLink icone={<Trash2 size={14} />} onClick={onApagar}>
              Apagar previsto
            </BotaoLink>
          )}
        </>
      }
    >
      <p style={estilos.explica}>
        Entra só na previsão da fatura, nos dias que ainda vão chegar. Quando o dia passa, conta a compra que você lançar.
      </p>
      <CampoValor
        id={`${ids}-valor`}
        valor={valor}
        tipo="saida"
        erro={erros.valor}
        onEnter={submit}
        onMudar={(v) => {
          setValor(v);
          if (erros.valor) setErros((er) => ({ ...er, valor: undefined }));
        }}
      />

      <label htmlFor={`${ids}-descricao`} style={estiloRotulo}>Descrição</label>
      <input
        id={`${ids}-descricao`}
        maxLength={120}
        enterKeyHint="done"
        style={campoComErro(erros.descricao)}
        value={descricao}
        placeholder="ex: lanche de sexta"
        aria-invalid={!!erros.descricao}
        onChange={(e) => {
          setDescricao(e.target.value);
          if (erros.descricao) setErros((er) => ({ ...er, descricao: undefined }));
        }}
      />
      {erros.descricao && <p style={estiloErro}>{erros.descricao}</p>}

      <p style={estiloRotulo}>Repete</p>
      <Segmentado
        rotulo="Repete"
        papel="radio"
        opcoes={[
          { valor: "semanal", nome: "Toda semana" },
          { valor: "mensal", nome: "Todo mês" },
        ]}
        valor={frequencia}
        onMudar={setFrequencia}
      />
      {frequencia === "semanal" ? (
        <>
          <p style={estiloRotulo}>Dia da semana</p>
          <Chips rotulo="Dia da semana" opcoes={DIAS_SEMANA} valor={diaSemana} onMudar={setDiaSemana} />
        </>
      ) : (
        <>
          <label htmlFor={`${ids}-dia`} style={estiloRotulo}>Dia do mês</label>
          <input
            id={`${ids}-dia`}
            inputMode="numeric"
            maxLength={2}
            style={{ ...campoComErro(erros.dia), width: 96 }}
            value={diaMes}
            onChange={(e) => setDiaMes(e.target.value.replace(/\D/g, ""))}
          />
          {erros.dia && <p style={estiloErro}>{erros.dia}</p>}
        </>
      )}

      <GradeCategorias id={`${ids}-categoria`} tipo="saida" categoria={categoria} onEscolher={setCategoria} />

      <p style={estiloRotulo}>Na meta, conta como</p>
      <Segmentado
        rotulo="Na meta, conta como"
        papel="radio"
        opcoes={[
          { valor: "essencial", nome: "Essencial" },
          { valor: "livre", nome: "Livre" },
        ]}
        valor={essencial ? "essencial" : "livre"}
        onMudar={(v) => setEssencialEscolhido(v === "essencial")}
      />
    </Folha>
  );
}

const estilos: Record<string, CSSProperties> = {
  explica: { fontSize: 13, color: "var(--text-soft)", lineHeight: 1.45, margin: "0 0 4px" },
};
