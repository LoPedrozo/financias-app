import { useId, useState } from "react";
import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import type { Cartao, NovoCartao } from "../types";
import { erroDoValor, lerValor } from "../lib/format";
import { cicloDaData, cicloSeguinte, diaEMes, nomeDaFatura, primeiroCiclo, somarDias } from "../lib/fatura";
import Folha from "./Folha";
import { BotaoPrincipal, campoComErro, estiloErro, estiloRotulo } from "./campos";

// Configurar o cartão: os dias de fechamento e vencimento, a meta e por qual
// fatura começar. Na primeira vez, também quanto já está na fatura aberta —
// o que foi comprado antes de começar a lançar aqui.

interface Props {
  cartao?: Cartao;
  hoje: string;
  /** `jaNaFatura`: só na primeira vez, o que já estava na fatura de início. */
  onSalvar: (dados: NovoCartao, jaNaFatura: number | null) => Promise<boolean>;
  onFechar: () => void;
}

interface Erros {
  fechamento?: string;
  vencimento?: string;
  meta?: string;
  essenciais?: string;
  jaNaFatura?: string;
}

const dinheiroDoCampo = (v: number | null | undefined) => (v == null ? "" : v.toFixed(2).replace(".", ","));

export default function ModalConfigCartao({ cartao, hoje, onSalvar, onFechar }: Props) {
  const ids = useId();
  const [nome, setNome] = useState(cartao?.nome ?? "Cartão de crédito");
  const [fecha, setFecha] = useState(String(cartao?.dia_fechamento ?? 3));
  const [vence, setVence] = useState(String(cartao?.dia_vencimento ?? 10));
  const [meta, setMeta] = useState(dinheiroDoCampo(cartao?.meta_total));
  const [essenciais, setEssenciais] = useState(dinheiroDoCampo(cartao?.meta_essenciais));
  const [jaNaFatura, setJaNaFatura] = useState("");
  // O vencimento da primeira fatura acompanhada. Sem escolha, a aberta.
  const [inicioEscolhido, setInicioEscolhido] = useState<string | null>(cartao?.inicio ?? null);
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);

  const diaValido = (t: string) => /^\d{1,2}$/.test(t) && Number(t) >= 1 && Number(t) <= 31;
  const dias = diaValido(fecha) && diaValido(vence) ? { dia_fechamento: Number(fecha), dia_vencimento: Number(vence) } : null;
  const atual = dias ? cicloDaData(hoje, dias) : null;
  const proxima = dias && atual ? cicloSeguinte(atual, dias) : null;
  const opcoesInicio = atual && proxima
    ? [...new Set([cartao?.inicio, atual.vencimento, proxima.vencimento].filter((v): v is string => !!v))].sort()
    : [];
  const inicio = inicioEscolhido && opcoesInicio.includes(inicioEscolhido) ? inicioEscolhido : atual?.vencimento;
  const nomeDoInicio = (venc: string) =>
    dias ? nomeDaFatura(primeiroCiclo({ ...dias, inicio: venc }), hoje) : "";

  function validar(): Erros {
    const novos: Erros = {};
    if (!diaValido(fecha)) novos.fechamento = "Um dia de 1 a 31.";
    if (!diaValido(vence)) novos.vencimento = "Um dia de 1 a 31.";
    if (meta.trim()) {
      const e = erroDoValor(meta);
      if (e) novos.meta = e;
    }
    if (essenciais.trim()) {
      const e = erroDoValor(essenciais);
      if (e) novos.essenciais = e;
      else if (!meta.trim()) novos.essenciais = "Defina antes a meta da fatura.";
      else if ((lerValor(essenciais) ?? 0) > (lerValor(meta) ?? 0)) novos.essenciais = "Não pode passar da meta da fatura.";
    }
    if (jaNaFatura.trim()) {
      const e = erroDoValor(jaNaFatura);
      if (e) novos.jaNaFatura = e;
    }
    return novos;
  }

  async function submit() {
    if (salvando) return;
    const novos = validar();
    setErros(novos);
    if (Object.keys(novos).length > 0 || !inicio) return;
    setSalvando(true);
    try {
      await onSalvar(
        {
          nome: nome.trim() || "Cartão de crédito",
          dia_fechamento: Number(fecha),
          dia_vencimento: Number(vence),
          meta_total: meta.trim() ? lerValor(meta) : null,
          meta_essenciais: essenciais.trim() ? lerValor(essenciais) : null,
          inicio,
        },
        !cartao && inicio === atual?.vencimento && jaNaFatura.trim() ? lerValor(jaNaFatura) : null
      );
    } finally {
      setSalvando(false);
    }
  }

  const opcaoInicio = (venc: string) => (
    <button
      key={venc}
      type="button"
      role="radio"
      aria-checked={inicio === venc}
      onClick={() => setInicioEscolhido(venc)}
      style={{ ...estilos.opcao, ...(inicio === venc ? estilos.opcaoAtiva : {}) }}
    >
      De {nomeDoInicio(venc)}
      {venc === atual?.vencimento ? " (aberta)" : ""}
      <span style={estilos.opcaoSub}> · vence {diaEMes(venc)}</span>
    </button>
  );

  const campoNumero = (id: string, valor: string, mudar: (v: string) => void, erro?: string) => (
    <input
      id={id}
      inputMode="numeric"
      maxLength={2}
      value={valor}
      aria-invalid={!!erro}
      onChange={(e) => mudar(e.target.value.replace(/\D/g, ""))}
      style={campoComErro(erro)}
    />
  );
  const campoValor = (id: string, valor: string, mudar: (v: string) => void, erro?: string) => (
    <input
      id={id}
      inputMode="decimal"
      placeholder="opcional"
      value={valor}
      aria-invalid={!!erro}
      onChange={(e) => mudar(e.target.value.replace(/[^0-9.,]/g, ""))}
      style={campoComErro(erro)}
    />
  );

  return (
    <Folha
      titulo={cartao ? "Datas e meta do cartão" : "Configurar o cartão"}
      onFechar={onFechar}
      zIndex={70}
      rodape={
        <BotaoPrincipal onClick={submit} desligado={salvando} icone={<Check size={19} aria-hidden="true" />}>
          {salvando ? "Salvando..." : cartao ? "Salvar" : "Começar"}
        </BotaoPrincipal>
      }
    >
      {!cartao && (
        <p style={estilos.explica}>
          A fatura passa a entrar no saldo sozinha, no dia do vencimento, somada das compras que você lançar aqui. Não
          lance mais a fatura à mão — senão ela conta duas vezes.
        </p>
      )}

      <label htmlFor={`${ids}-nome`} style={estiloRotulo}>Nome</label>
      <input id={`${ids}-nome`} maxLength={40} value={nome} onChange={(e) => setNome(e.target.value)} style={campoComErro()} />

      <div style={estilos.lado}>
        <div>
          <label htmlFor={`${ids}-fecha`} style={estiloRotulo}>Fecha no dia</label>
          {campoNumero(`${ids}-fecha`, fecha, setFecha, erros.fechamento)}
          {erros.fechamento && <p style={estiloErro}>{erros.fechamento}</p>}
        </div>
        <div>
          <label htmlFor={`${ids}-vence`} style={estiloRotulo}>Vence no dia</label>
          {campoNumero(`${ids}-vence`, vence, setVence, erros.vencimento)}
          {erros.vencimento && <p style={estiloErro}>{erros.vencimento}</p>}
        </div>
      </div>

      {atual && proxima && (
        <>
          <p style={estiloRotulo}>Começar pela fatura</p>
          <div role="radiogroup" aria-label="Começar pela fatura" style={estilos.opcoes}>
            {opcoesInicio.map(opcaoInicio)}
          </div>
          <p style={estilos.dica}>
            As faturas de antes continuam como você lançou. A aberta junta as compras de {diaEMes(atual.abre)} a{" "}
            {diaEMes(somarDias(atual.fechamento, -1))} — no dia do fechamento, a compra já vai para a próxima.
          </p>
        </>
      )}

      {!cartao && atual && inicio === atual.vencimento && (
        <>
          <label htmlFor={`${ids}-ja`} style={estiloRotulo}>Já está na fatura de {nomeDaFatura(atual, hoje)}</label>
          {campoValor(`${ids}-ja`, jaNaFatura, setJaNaFatura, erros.jaNaFatura)}
          {erros.jaNaFatura && <p style={estiloErro}>{erros.jaNaFatura}</p>}
          <p style={estilos.dica}>O total que o app do banco mostra hoje, comprado antes de você começar a lançar aqui.</p>
        </>
      )}

      <div style={estilos.lado}>
        <div>
          <label htmlFor={`${ids}-meta`} style={estiloRotulo}>Meta da fatura</label>
          {campoValor(`${ids}-meta`, meta, setMeta, erros.meta)}
          {erros.meta && <p style={estiloErro}>{erros.meta}</p>}
        </div>
        <div>
          <label htmlFor={`${ids}-essenciais`} style={estiloRotulo}>Dela, essenciais</label>
          {campoValor(`${ids}-essenciais`, essenciais, setEssenciais, erros.essenciais)}
          {erros.essenciais && <p style={estiloErro}>{erros.essenciais}</p>}
        </div>
      </div>
      <p style={estilos.dica}>
        Quanto você quer gastar por fatura, e quanto disso é o que não dá para cortar. O resto é o livre.
      </p>
    </Folha>
  );
}

const estilos: Record<string, CSSProperties> = {
  explica: { fontSize: 13.5, color: "var(--text-soft)", lineHeight: 1.5, margin: "0 0 4px" },
  dica: { fontSize: 12.5, color: "var(--text-faint)", lineHeight: 1.45, margin: "6px 2px 0" },
  lado: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  opcoes: { display: "grid", gap: 8 },
  opcao: {
    minHeight: 44,
    padding: "0 14px",
    textAlign: "left",
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "solid",
    borderColor: "transparent",
    background: "var(--bg)",
    color: "var(--text-soft)",
    fontSize: 14.5,
    fontWeight: 600,
  },
  opcaoAtiva: { background: "var(--accent-soft)", borderColor: "var(--accent)", color: "var(--text)" },
  opcaoSub: { fontWeight: 500, color: "var(--text-faint)" },
};
