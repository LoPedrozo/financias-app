import { useId, useState } from "react";
import type { CSSProperties } from "react";
import { Check, Globe, Nfc, Trash2 } from "lucide-react";
import type { Cartao, ComoPagou, CompraCartao, NovaCompraCartao } from "../types";
import { CATEGORIAS_SAIDA } from "../types";
import { hojeLocal } from "../lib/calculos";
import { erroDoValor, lerValor } from "../lib/format";
import { CATEGORIAS_ESSENCIAIS, cicloDaData, cicloSeguinte, diaEMes, nomeDaFatura, parcelasDaCompra } from "../lib/fatura";
import { useDinheiro } from "../hooks/usePreferencias";
import Folha from "./Folha";
import {
  AtalhosData,
  BotaoLink,
  BotaoPrincipal,
  CampoValor,
  GradeCategorias,
  Segmentado,
  campoComErro,
  estiloErro,
  estiloRotulo,
} from "./campos";

// Uma compra no cartão: o formulário de lançamento, sem Entrada/Saída (é
// sempre gasto) e com o que o cartão tem a mais — parcelas, como pagou e se
// é essencial. Embaixo do valor, a fatura em que ela vai cair: é a dúvida de
// quem compra perto do fechamento.

interface Props {
  cartao: Cartao;
  compra?: CompraCartao;
  onSalvar: (dados: NovaCompraCartao) => Promise<boolean>;
  onApagar?: () => void;
  onFechar: () => void;
}

const PARCELAS = [1, 2, 3, 4, 5, 6, 10, 12].map((n) => ({ valor: n, curto: `${n}x`, nome: n === 1 ? "À vista" : `${n} parcelas` }));

interface Erros {
  valor?: string;
  descricao?: string;
  data?: string;
}

export default function ModalCompra({ cartao, compra, onSalvar, onApagar, onFechar }: Props) {
  const ids = useId();
  const dinheiro = useDinheiro();
  const hoje = hojeLocal();
  const [valor, setValor] = useState(compra ? compra.valor.toFixed(2).replace(".", ",") : "");
  const [descricao, setDescricao] = useState(compra?.descricao ?? "");
  const [categoria, setCategoria] = useState(() =>
    compra && CATEGORIAS_SAIDA.some((c) => c.nome === compra.categoria) ? compra.categoria : CATEGORIAS_SAIDA[0].nome
  );
  const [data, setData] = useState(compra?.data ?? hoje);
  const [parcelas, setParcelas] = useState(compra?.parcelas ?? 1);
  const [como, setComo] = useState<ComoPagou>(compra?.como ?? "aproximacao");
  // null: segue a categoria. Só vira escolha da compra quando contraria a categoria.
  const [essencialEscolhido, setEssencialEscolhido] = useState<boolean | null>(compra?.essencial ?? null);
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);

  const essencialPelaCategoria = CATEGORIAS_ESSENCIAIS.has(categoria);
  const essencial = essencialEscolhido ?? essencialPelaCategoria;
  const limparErro = (campo: keyof Erros) => {
    if (erros[campo]) setErros((er) => ({ ...er, [campo]: undefined }));
  };

  // Onde a compra cai. Com o valor ainda incompleto, mostra só a fatura.
  const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(data);
  const ciclo = dataValida ? cicloDaData(data, cartao) : null;
  const numero = lerValor(valor);
  const divisao = numero && parcelas > 1 ? parcelasDaCompra({ valor: numero, data, parcelas }, cartao) : null;

  function validar(): Erros {
    const novos: Erros = {};
    const erroValor = erroDoValor(valor);
    if (erroValor) novos.valor = erroValor;
    if (descricao.trim().length < 2) novos.descricao = "Escreva o que foi (ex: mercado, Uber).";
    if (!dataValida) novos.data = "Escolha o dia da compra.";
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
        data,
        parcelas,
        essencial: essencialEscolhido === essencialPelaCategoria ? null : essencialEscolhido,
        como,
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Folha
      titulo={compra ? "Editar compra" : "Compra no cartão"}
      onFechar={onFechar}
      zIndex={70}
      rodape={
        <>
          <BotaoPrincipal onClick={submit} desligado={salvando} icone={<Check size={19} aria-hidden="true" />}>
            {salvando ? "Salvando..." : compra ? "Salvar alterações" : "Salvar compra"}
          </BotaoPrincipal>
          {compra && onApagar && (
            <BotaoLink icone={<Trash2 size={14} />} onClick={onApagar}>
              Apagar compra
            </BotaoLink>
          )}
        </>
      }
    >
      <CampoValor
        id={`${ids}-valor`}
        valor={valor}
        tipo="saida"
        erro={erros.valor}
        onEnter={submit}
        onMudar={(v) => {
          setValor(v);
          limparErro("valor");
        }}
      />
      {ciclo && (
        <p style={estilos.ondeCai}>
          {divisao
            ? `${parcelas}x de ${dinheiro(divisao[0].centavos / 100)}, de ${nomeDaFatura(ciclo, hoje)} a ${nomeDaFatura(cicloSeguinte(ciclo, cartao, parcelas - 1), hoje)}`
            : `Entra na fatura de ${nomeDaFatura(ciclo, hoje)} · vence ${diaEMes(ciclo.vencimento)}`}
        </p>
      )}

      <AtalhosData
        id={`${ids}-quando`}
        data={data}
        erro={erros.data}
        onData={(d) => {
          setData(d);
          limparErro("data");
        }}
      />

      <label htmlFor={`${ids}-descricao`} style={estiloRotulo}>Descrição</label>
      <input
        id={`${ids}-descricao`}
        maxLength={120}
        enterKeyHint="done"
        style={campoComErro(erros.descricao)}
        value={descricao}
        placeholder="ex: mercado, Uber, iFood"
        aria-invalid={!!erros.descricao}
        onChange={(e) => {
          setDescricao(e.target.value);
          limparErro("descricao");
        }}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {erros.descricao && <p style={estiloErro}>{erros.descricao}</p>}

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
      <p style={estilos.dica}>
        {essencialEscolhido === null || essencialEscolhido === essencialPelaCategoria
          ? `Pela categoria: ${categoria} é ${essencialPelaCategoria ? "essencial" : "livre"}.`
          : "Escolhido só para esta compra."}
      </p>

      <p style={estiloRotulo}>Parcelas</p>
      {/* Duas linhas de quatro: oito chips numa linha só não cabem em 320px. */}
      <div style={estilos.parcelas} role="radiogroup" aria-label="Parcelas">
        {PARCELAS.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={parcelas === o.valor}
            aria-label={o.nome}
            onClick={() => setParcelas(o.valor)}
            style={{ ...estilos.comoOpcao, height: 40, ...(parcelas === o.valor ? estilos.comoAtivo : {}) }}
          >
            {o.curto}
          </button>
        ))}
      </div>

      <p style={estiloRotulo}>Como pagou</p>
      <div style={estilos.como} role="radiogroup" aria-label="Como pagou">
        {([
          ["aproximacao", "Aproximação", Nfc],
          ["online", "Online", Globe],
        ] as const).map(([v, nome, Icone]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={como === v}
            onClick={() => setComo(v)}
            style={{ ...estilos.comoOpcao, ...(como === v ? estilos.comoAtivo : {}) }}
          >
            <Icone size={15} aria-hidden="true" />
            {nome}
          </button>
        ))}
      </div>
    </Folha>
  );
}

const estilos: Record<string, CSSProperties> = {
  ondeCai: {
    textAlign: "center",
    fontSize: 13,
    color: "var(--text-soft)",
    margin: "-4px 0 4px",
  },
  dica: { fontSize: 12.5, color: "var(--text-faint)", margin: "6px 2px 0" },
  como: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  parcelas: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 },
  comoOpcao: {
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "solid",
    borderColor: "transparent",
    background: "var(--bg)",
    color: "var(--text-soft)",
    fontSize: 14,
    fontWeight: 600,
  },
  comoAtivo: { background: "var(--accent-soft)", borderColor: "var(--accent)", color: "var(--text)" },
};
