import { useMemo, useState } from "react";
import { CopyCheck, Repeat } from "lucide-react";
import { MESES } from "../types";
import type { Lancamento, NovoLancamento } from "../types";
import { mesmoDiaNoMes } from "../lib/calculos";
import { chaveDaConta, conjuntoDeContas } from "../lib/duplicatas";
import { brl, lerValor } from "../lib/format";
import Folha from "./Folha";
import IconeCategoria from "./IconeCategoria";
import { BORDA, BotaoPrincipal } from "./campos";

// A lista do mês passado colada no mês novo, que é o que se fazia à mão no
// WhatsApp: quase tudo se repete, muda só o valor de um ou outro.
//
// Duas coisas o app sabe e o copiar-e-colar não sabia:
// - lançamento gerado por recorrência não vem junto. Ele se materializa
//   sozinho na virada, e trazer de novo criaria a conta em dobro.
// - o que já existe no mês de destino chega desmarcado, para reabrir a tela
//   uma segunda vez não duplicar o que a primeira já trouxe.

interface Props {
  /** Competência de destino — o mês que a tela está mostrando. */
  mes: number;
  ano: number;
  /** Lançamentos do mês anterior, inclusive os de recorrência. */
  origem: Lancamento[];
  /** Lançamentos que o mês de destino já tem. */
  jaNoMes: Lancamento[];
  mesOrigemNome: string;
  onFechar: () => void;
  onSalvar: (itens: NovoLancamento[]) => Promise<void> | void;
}

function dataDe(l: Lancamento): string {
  return l.data ?? l.created_at.slice(0, 10);
}

function paraTexto(valor: number): string {
  return valor.toFixed(2).replace(".", ",");
}


export default function ModalRepetirMes({
  mes,
  ano,
  origem,
  jaNoMes,
  mesOrigemNome,
  onFechar,
  onSalvar,
}: Props) {
  const geradas = useMemo(
    () => origem.filter((l) => l.recorrencia_id),
    [origem]
  );

  const candidatos = useMemo(
    () =>
      origem
        .filter((l) => !l.recorrencia_id)
        .slice()
        .sort((a, b) => dataDe(a).localeCompare(dataDe(b))),
    [origem]
  );

  // Mesma descrição e mesmo tipo já no destino contam como repetido. O valor
  // fica de fora da comparação de propósito: a conta de luz de setembro é a
  // mesma conta de agosto ainda que venha dez reais mais cara.
  const jaExistem = useMemo(() => {
    const noDestino = conjuntoDeContas(jaNoMes);
    return new Set(
      candidatos.filter((l) => noDestino.has(chaveDaConta(l))).map((l) => l.id)
    );
  }, [candidatos, jaNoMes]);

  const [selecionados, setSelecionados] = useState<Set<string>>(
    () => new Set(candidatos.filter((l) => !jaExistem.has(l.id)).map((l) => l.id))
  );
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(candidatos.map((l) => [l.id, paraTexto(l.valor)]))
  );
  const [salvando, setSalvando] = useState(false);

  function alternar(id: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  const escolhidos = candidatos.filter((l) => selecionados.has(l.id));
  const algumInvalido = escolhidos.some(
    (l) => lerValor(valores[l.id] ?? "") === null
  );

  const saldo = escolhidos.reduce((s, l) => {
    const valor = lerValor(valores[l.id] ?? "") ?? 0;
    return s + (l.tipo === "entrada" ? valor : -valor);
  }, 0);

  async function submit() {
    if (salvando || escolhidos.length === 0 || algumInvalido) return;
    setSalvando(true);
    try {
      await onSalvar(
        escolhidos.map((l) => ({
          tipo: l.tipo,
          valor: lerValor(valores[l.id] ?? "")!,
          descricao: l.descricao,
          categoria: l.categoria,
          mes,
          ano,
          data: mesmoDiaNoMes(dataDe(l), mes, ano),
        }))
      );
    } finally {
      setSalvando(false);
    }
  }

  const desligado = escolhidos.length === 0 || algumInvalido || salvando;

  return (
    <Folha
      titulo={`Repetir ${mesOrigemNome} em ${MESES[mes]}`}
      onFechar={onFechar}
      largura={460}
      rodape={
        <>
          {candidatos.length > 0 && (
            <div style={styles.resumo}>
              <span style={styles.resumoRotulo}>
                {escolhidos.length} de {candidatos.length}
              </span>
              <span style={{ ...styles.resumoValor, color: saldo >= 0 ? "var(--green)" : "var(--red)" }}>
                {saldo >= 0 ? "+" : "−"} {brl(Math.abs(saldo))}
              </span>
            </div>
          )}
          <BotaoPrincipal onClick={submit} desligado={desligado}>
            {salvando
              ? "Trazendo..."
              : algumInvalido
                ? "Confira os valores em vermelho"
                : escolhidos.length === 0
                  ? "Escolha o que repetir"
                  : `Trazer ${escolhidos.length} para ${MESES[mes]}`}
          </BotaoPrincipal>
        </>
      }
    >
      <p style={styles.explicacao}>
        Desmarque o que não se repete e ajuste os valores que mudaram. As
        datas vão para o mesmo dia de {MESES[mes]}.
      </p>

      {candidatos.length === 0 ? (
        <p style={styles.vazio}>
          {mesOrigemNome} não tem lançamentos para repetir.
        </p>
      ) : (
        <>
          <div style={styles.lista}>
            {candidatos.map((l) => {
              const marcado = selecionados.has(l.id);
              const texto = valores[l.id] ?? "";
              const invalido = marcado && lerValor(texto) === null;
              const cor = l.tipo === "entrada" ? "var(--green)" : "var(--red)";
              return (
                <div key={l.id} style={{ ...styles.linha, opacity: marcado ? 1 : 0.5 }}>
                  <label style={styles.alvo}>
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => alternar(l.id)}
                      style={styles.checkbox}
                    />
                    <IconeCategoria tipo={l.tipo} categoria={l.categoria} tamanho={32} />
                    <span style={styles.textos}>
                      <span style={styles.descricao}>{l.descricao}</span>
                      <span style={styles.meta}>
                        {l.categoria} · dia {dataDe(l).slice(8, 10)}
                      </span>
                    </span>
                  </label>
                  <span style={{ ...styles.sinal, color: cor }}>
                    {l.tipo === "entrada" ? "+" : "−"}
                  </span>
                  <input
                    value={texto}
                    inputMode="decimal"
                    disabled={!marcado}
                    onChange={(e) =>
                      setValores((atual) => ({
                        ...atual,
                        [l.id]: e.target.value.replace(/[^0-9.,]/g, ""),
                      }))
                    }
                    style={{
                      ...styles.valor,
                      borderColor: invalido ? "var(--red)" : "transparent",
                      color: cor,
                    }}
                    aria-invalid={invalido}
                    aria-label={`Valor de ${l.descricao}`}
                  />
                </div>
              );
            })}
          </div>

          {(geradas.length > 0 || jaExistem.size > 0) && (
            <div style={styles.notas}>
              {geradas.length > 0 && (
                <p style={styles.nota}>
                  <Repeat size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    {geradas.length}{" "}
                    {geradas.length === 1
                      ? "lançamento de recorrência ficou"
                      : "lançamentos de recorrência ficaram"}{" "}
                    de fora — {geradas.length === 1 ? "ele se gera" : "eles se geram"}{" "}
                    sozinho{geradas.length === 1 ? "" : "s"}.
                  </span>
                </p>
              )}
              {jaExistem.size > 0 && (
                <p style={styles.nota}>
                  <CopyCheck size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    {jaExistem.size}{" "}
                    {jaExistem.size === 1 ? "já existe" : "já existem"} em{" "}
                    {MESES[mes]} e {jaExistem.size === 1 ? "veio" : "vieram"}{" "}
                    desmarcado{jaExistem.size === 1 ? "" : "s"}.
                  </span>
                </p>
              )}
            </div>
          )}
        </>
      )}
    </Folha>
  );
}

const styles: Record<string, React.CSSProperties> = {
  explicacao: {
    fontSize: 13.5,
    color: "var(--text-soft)",
    lineHeight: 1.5,
    marginBottom: 10,
  },
  vazio: {
    fontSize: 14,
    color: "var(--text-faint)",
    padding: "18px 0",
    textAlign: "center",
  },
  lista: {
    display: "flex",
    flexDirection: "column",
  },
  linha: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 0",
    borderBottom: "1px solid var(--border)",
    minWidth: 0,
  },
  alvo: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    cursor: "pointer",
  },
  checkbox: {
    width: 20,
    height: 20,
    flexShrink: 0,
    margin: 0,
    accentColor: "var(--accent)",
  },
  textos: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  descricao: {
    fontSize: 14,
    color: "var(--text)",
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  meta: {
    fontSize: 12,
    color: "var(--text-faint)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sinal: {
    fontSize: 15,
    fontWeight: 700,
    flexShrink: 0,
  },
  valor: {
    width: 96,
    height: 40,
    flexShrink: 0,
    background: "var(--bg)",
    ...BORDA,
    borderRadius: 10,
    padding: "0 10px",
    // 16px: abaixo disso o iPhone dá zoom na página ao tocar no campo.
    fontSize: 16,
    fontWeight: 700,
    fontFamily: "'Sora', sans-serif",
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
    outline: "none",
  },
  notas: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    margin: "12px 0 4px",
  },
  nota: {
    display: "flex",
    alignItems: "flex-start",
    gap: 7,
    fontSize: 12.5,
    color: "var(--text-faint)",
    lineHeight: 1.45,
  },
  resumo: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    margin: "0 2px 10px",
  },
  resumoRotulo: { fontSize: 13, color: "var(--text-soft)", fontWeight: 600 },
  resumoValor: {
    fontFamily: "'Sora', sans-serif",
    fontSize: 20,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },
};
