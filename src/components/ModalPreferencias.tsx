import { Check, EyeOff, Layers, LogOut, Moon, Rows3 } from "lucide-react";
import type { ReactNode } from "react";
import { usePreferencias } from "../hooks/usePreferencias";
import { DESTAQUES, temaEfetivo } from "../lib/preferencias";
import type { Tema } from "../lib/preferencias";
import Folha from "./Folha";
import { Segmentado, estiloRotulo } from "./campos";

// Tudo o que é personalização mora aqui, atrás da engrenagem do cabeçalho —
// e o Sair veio junto, porque o cabeçalho não tinha lugar para mais um ícone
// e sair é a coisa que menos se faz.
//
// Cada mudança vale na hora, sem botão de salvar: é ver como fica e decidir.

interface Props {
  email: string;
  onSair: () => void;
  onFechar: () => void;
}

const TEMAS: Array<{ valor: Tema; nome: string }> = [
  { valor: "auto", nome: "Automático" },
  { valor: "claro", nome: "Claro" },
  { valor: "escuro", nome: "Escuro" },
];

function sistemaEscuro(): boolean {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

function Interruptor({
  ligado,
  onMudar,
  titulo,
  descricao,
  icone,
}: {
  ligado: boolean;
  onMudar: (ligado: boolean) => void;
  titulo: string;
  descricao: string;
  icone: ReactNode;
}) {
  return (
    <button
      role="switch"
      aria-checked={ligado}
      onClick={() => onMudar(!ligado)}
      style={estilos.linha}
    >
      <span style={estilos.linhaIcone}>{icone}</span>
      <span style={estilos.linhaTextos}>
        <span style={estilos.linhaTitulo}>{titulo}</span>
        <span style={estilos.linhaDescricao}>{descricao}</span>
      </span>
      <span
        aria-hidden="true"
        style={{
          ...estilos.trilho,
          background: ligado ? "var(--accent)" : "var(--border)",
        }}
      >
        <span
          style={{
            ...estilos.bolinha,
            transform: ligado ? "translateX(18px)" : "translateX(0)",
          }}
        />
      </span>
    </button>
  );
}

export default function ModalPreferencias({ email, onSair, onFechar }: Props) {
  const { preferencias, mudar } = usePreferencias();
  // A amostra mostra a cor como ela vai aparecer agora — no escuro, a versão
  // mais clara de cada uma.
  const variante = temaEfetivo(preferencias.tema, sistemaEscuro());

  return (
    <Folha titulo="Preferências" onFechar={onFechar} largura={420}>
      <p style={{ ...estiloRotulo, marginTop: 4 }}>Tema</p>
      <Segmentado
        rotulo="Tema"
        papel="radio"
        opcoes={TEMAS}
        valor={preferencias.tema}
        onMudar={(tema) => mudar({ tema })}
      />

      <p style={estiloRotulo} id="rotulo-cor">
        Cor de destaque
      </p>
      <div
        style={{ ...estilos.amostras, gridTemplateColumns: `repeat(${DESTAQUES.length}, 1fr)` }}
        role="radiogroup"
        aria-labelledby="rotulo-cor"
      >
        {DESTAQUES.map((d) => {
          const ativo = preferencias.destaque === d.id;
          return (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={ativo}
              aria-label={d.nome}
              title={d.nome}
              onClick={() => mudar({ destaque: d.id })}
              style={{
                ...estilos.amostra,
                background: d[variante],
                boxShadow: ativo
                  ? `0 0 0 3px var(--surface), 0 0 0 5px ${d[variante]}`
                  : "none",
              }}
            >
              {ativo && <Check size={16} color="#fff" strokeWidth={3} />}
            </button>
          );
        })}
      </div>

      <p style={estiloRotulo}>Estilo</p>
      <div style={estilos.grupo}>
        <Interruptor
          ligado={preferencias.preto}
          onMudar={(v) => mudar({ preto: v })}
          titulo="Preto total"
          descricao="No tema escuro, fundo preto de verdade: a tela do iPhone apaga esses pontos e gasta menos bateria."
          icone={<Moon size={17} />}
        />
        <Interruptor
          ligado={preferencias.vidro}
          onMudar={(v) => mudar({ vidro: v })}
          titulo="Vidro"
          descricao="Cards e barras de vidro fosco sobre um fundo na cor de destaque. Vale no claro e no escuro."
          icone={<Layers size={17} />}
        />
      </div>

      <p style={estiloRotulo}>Uso</p>
      <div style={estilos.grupo}>
        <Interruptor
          ligado={preferencias.ocultarValores}
          onMudar={(v) => mudar({ ocultarValores: v })}
          titulo="Esconder valores"
          descricao="Troca os valores por R$ ••••• na tela principal. Bom para abrir o app em público."
          icone={<EyeOff size={17} />}
        />
        <Interruptor
          ligado={preferencias.listaCompacta}
          onMudar={(v) => mudar({ listaCompacta: v })}
          titulo="Lista compacta"
          descricao="Linhas mais baixas: cabe mais lançamento na tela."
          icone={<Rows3 size={17} />}
        />
      </div>

      <p style={estiloRotulo}>Conta</p>
      <div style={estilos.conta}>
        <span style={estilos.email}>{email}</span>
        <button type="button" style={estilos.sair} onClick={onSair}>
          <LogOut size={15} /> Sair
        </button>
      </div>

      <p style={estilos.rodape}>As preferências ficam salvas neste aparelho.</p>
    </Folha>
  );
}

const estilos: Record<string, React.CSSProperties> = {
  // Uma coluna por cor, todas numa linha: em 320px cada bolinha encolhe
  // (até sobrar 10px em volta, para o anel da escolhida não encostar na
  // vizinha); em tela larga fica nos 36px.
  amostras: { display: "grid", justifyItems: "center", padding: "6px 0" },
  amostra: {
    width: "min(36px, 100% - 10px)",
    aspectRatio: "1",
    borderRadius: "50%",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "box-shadow 0.15s ease",
  },
  grupo: {
    display: "flex",
    flexDirection: "column",
    background: "var(--bg)",
    borderRadius: 14,
    overflow: "hidden",
  },
  linha: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: "none",
    padding: "12px 14px",
    color: "var(--text)",
    cursor: "pointer",
  },
  linhaIcone: {
    color: "var(--text-soft)",
    display: "flex",
    flexShrink: 0,
  },
  linhaTextos: { display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 },
  linhaTitulo: { fontSize: 14.5, fontWeight: 600 },
  linhaDescricao: {
    fontSize: 12.5,
    color: "var(--text-soft)",
    lineHeight: 1.4,
  },
  trilho: {
    width: 42,
    height: 24,
    borderRadius: 12,
    padding: 3,
    flexShrink: 0,
    transition: "background 0.15s ease",
  },
  bolinha: {
    display: "block",
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
    transition: "transform 0.15s ease",
  },
  conta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "var(--bg)",
    borderRadius: 14,
    padding: "10px 10px 10px 14px",
  },
  email: {
    fontSize: 13.5,
    color: "var(--text-soft)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  sair: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 38,
    background: "var(--surface)",
    border: "none",
    color: "var(--red)",
    borderRadius: 10,
    padding: "0 12px",
    fontSize: 14,
    fontWeight: 600,
    flexShrink: 0,
    cursor: "pointer",
  },
  rodape: {
    fontSize: 12.5,
    color: "var(--text-faint)",
    textAlign: "center",
    marginTop: 16,
  },
};
