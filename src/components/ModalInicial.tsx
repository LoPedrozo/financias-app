import { useId, useState } from "react";
import type { CSSProperties } from "react";
import { Check, X } from "lucide-react";
import { erroDoValor, lerValor } from "../lib/format";
import { useDinheiro } from "../hooks/usePreferencias";
import Folha from "./Folha";
import { BotaoLink, BotaoPrincipal, campoComErro, estiloErro, estiloRotulo } from "./campos";

// Quanto a fatura começou: a parte que outra pessoa (a mãe) paga direto ao
// banco. Muda de fatura para fatura, então se informa em cada uma. Ocupa a
// meta, mas não sai do saldo.

interface Props {
  nomeDaFatura: string;
  /** O valor já informado nesta fatura, se houver. */
  atual: number | null;
  /** O da fatura anterior, como referência. */
  anterior: number | null;
  /** null: voltar a "não informado". */
  onSalvar: (valor: number | null) => Promise<boolean>;
  onFechar: () => void;
}

export default function ModalInicial({ nomeDaFatura, atual, anterior, onSalvar, onFechar }: Props) {
  const ids = useId();
  const dinheiro = useDinheiro();
  const [valor, setValor] = useState(atual == null ? "" : atual.toFixed(2).replace(".", ","));
  const [erro, setErro] = useState<string | undefined>();
  const [salvando, setSalvando] = useState(false);

  async function salvar(v: number | null) {
    if (salvando) return;
    setSalvando(true);
    try {
      await onSalvar(v);
    } finally {
      setSalvando(false);
    }
  }

  function submit() {
    // Zero vale: "esta fatura começou sem nada de outra pessoa".
    if (valor.trim() && /^[0,.\s]+$/.test(valor.trim())) return salvar(0);
    const e = erroDoValor(valor);
    if (e) return setErro(e);
    return salvar(lerValor(valor));
  }

  return (
    <Folha
      titulo={`Fatura de ${nomeDaFatura}`}
      onFechar={onFechar}
      zIndex={70}
      largura={400}
      rodape={
        <>
          <BotaoPrincipal onClick={submit} desligado={salvando} icone={<Check size={19} aria-hidden="true" />}>
            {salvando ? "Salvando..." : "Salvar"}
          </BotaoPrincipal>
          {atual != null && (
            <BotaoLink icone={<X size={14} />} onClick={() => salvar(null)}>
              Não sei ainda
            </BotaoLink>
          )}
        </>
      }
    >
      <p style={estilos.explica}>
        A parte que já vem na fatura e outra pessoa paga direto ao banco. Ela ocupa a meta da fatura, mas não sai do seu
        saldo.
      </p>
      <label htmlFor={`${ids}-valor`} style={estiloRotulo}>Começou com</label>
      <input
        id={`${ids}-valor`}
        inputMode="decimal"
        autoFocus
        value={valor}
        placeholder="0,00"
        aria-invalid={!!erro}
        onChange={(e) => {
          setValor(e.target.value.replace(/[^0-9.,]/g, ""));
          setErro(undefined);
        }}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        style={campoComErro(erro)}
      />
      {erro && <p style={estiloErro}>{erro}</p>}
      {anterior != null && (
        <p style={estilos.dica}>
          Na fatura anterior:{" "}
          <button type="button" style={estilos.usar} onClick={() => setValor(anterior.toFixed(2).replace(".", ","))}>
            {dinheiro(anterior)}
          </button>
        </p>
      )}
    </Folha>
  );
}

const estilos: Record<string, CSSProperties> = {
  explica: { fontSize: 13.5, color: "var(--text-soft)", lineHeight: 1.5, margin: "0 0 4px" },
  dica: { fontSize: 13, color: "var(--text-faint)", margin: "8px 2px 0" },
  usar: {
    background: "none",
    borderWidth: 0,
    borderStyle: "solid",
    padding: "6px 0",
    color: "var(--destaque-texto)",
    fontSize: 13,
    fontWeight: 700,
    textDecoration: "underline",
  },
};
