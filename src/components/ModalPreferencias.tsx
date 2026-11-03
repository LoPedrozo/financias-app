import { Check, EyeOff, LogOut, Rows3, X } from "lucide-react";
import type { ReactNode } from "react";
import { usePreferencias } from "../hooks/usePreferencias";
import { DESTAQUES, temaEfetivo } from "../lib/preferencias";
import type { Tema } from "../lib/preferencias";

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

const TEMAS: Array<{ id: Tema; nome: string }> = [
  { id: "auto", nome: "Automático" },
  { id: "claro", nome: "Claro" },
  { id: "escuro", nome: "Escuro" },
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
    <div style={estilos.overlay} data-modal onClick={onFechar}>
      <div
        style={estilos.modal}
        className="modal-mobile"
        role="dialog"
        aria-labelledby="titulo-preferencias"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={estilos.cabeca}>
          <h3 id="titulo-preferencias" style={estilos.titulo}>
            Preferências
          </h3>
          <button style={estilos.fechar} onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <h4 style={estilos.secao}>Aparência</h4>

        <span style={estilos.rotulo} id="rotulo-tema">
          Tema
        </span>
        <div style={estilos.segmentado} role="radiogroup" aria-labelledby="rotulo-tema">
          {TEMAS.map((t) => {
            const ativo = preferencias.tema === t.id;
            return (
              <button
                key={t.id}
                role="radio"
                aria-checked={ativo}
                onClick={() => mudar({ tema: t.id })}
                style={{
                  ...estilos.segmento,
                  ...(ativo ? estilos.segmentoAtivo : {}),
                }}
              >
                {t.nome}
              </button>
            );
          })}
        </div>

        <span style={estilos.rotulo} id="rotulo-cor">
          Cor de destaque
        </span>
        <div style={estilos.amostras} role="radiogroup" aria-labelledby="rotulo-cor">
          {DESTAQUES.map((d) => {
            const ativo = preferencias.destaque === d.id;
            return (
              <button
                key={d.id}
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

        <h4 style={estilos.secao}>Uso</h4>
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

        <h4 style={estilos.secao}>Conta</h4>
        <div style={estilos.conta}>
          <span style={estilos.email}>{email}</span>
          <button style={estilos.sair} onClick={onSair}>
            <LogOut size={15} /> Sair
          </button>
        </div>

        <p style={estilos.rodape}>As preferências ficam salvas neste aparelho.</p>
      </div>
    </div>
  );
}

const estilos: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(16, 24, 40, 0.35)",
    backdropFilter: "blur(3px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 60,
  },
  modal: {
    background: "var(--surface)",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    // Mesmo teto do formulário: em aparelho baixo, rola em vez de passar da
    // tela com o Sair inalcançável.
    maxHeight: "calc(100vh - 40px)",
    overflowY: "auto",
    boxShadow: "0 20px 60px rgba(16,24,40,0.18)",
    animation: "fadeUp 0.25s ease",
  },
  cabeca: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  titulo: { fontSize: 19, fontWeight: 700 },
  fechar: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
    padding: 4,
  },
  secao: {
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-faint)",
    margin: "18px 0 10px",
    fontFamily: "inherit",
  },
  rotulo: {
    display: "block",
    fontSize: 13,
    color: "var(--text-soft)",
    marginBottom: 8,
  },
  segmentado: {
    display: "flex",
    gap: 4,
    background: "var(--bg)",
    padding: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  segmento: {
    flex: 1,
    padding: "9px 4px",
    border: "none",
    borderRadius: 9,
    background: "transparent",
    color: "var(--text-soft)",
    fontWeight: 600,
    fontSize: 13.5,
  },
  segmentoAtivo: {
    background: "var(--surface)",
    color: "var(--text)",
    boxShadow: "var(--shadow)",
  },
  amostras: { display: "flex", gap: 14, padding: "4px 2px" },
  amostra: {
    width: 34,
    height: 34,
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
  },
  linhaIcone: {
    color: "var(--text-soft)",
    display: "flex",
    flexShrink: 0,
  },
  linhaTextos: { display: "flex", flexDirection: "column", gap: 2, flex: 1 },
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
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--red)",
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 13.5,
    fontWeight: 600,
    flexShrink: 0,
  },
  rodape: {
    fontSize: 12,
    color: "var(--text-faint)",
    textAlign: "center",
    marginTop: 16,
  },
};
