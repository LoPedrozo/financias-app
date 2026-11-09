import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";
import { useAreaVisivel } from "../hooks/useAreaVisivel";

// A casca de todo modal do app.
//
// No celular, uma folha que sobe de baixo — perto do polegar; no computador,
// uma caixa no centro. Cabeçalho com o título e o X, um corpo que rola e, se
// houver, um rodapé fixo com o botão principal, sempre à vista. A folha
// acompanha a área visível da tela (useAreaVisivel): com o teclado aberto no
// iPhone, ela termina logo acima dele, e o botão não fica escondido atrás.
//
// Fecha pelo X, tocando fora e com Esc.

interface Props {
  titulo: ReactNode;
  onFechar: () => void;
  children: ReactNode;
  /** Fixo embaixo, sempre à vista: é onde mora o botão principal. */
  rodape?: ReactNode;
  /** Largura máxima no computador; no celular a folha ocupa a tela toda. */
  largura?: number;
  /** Para uma folha que abre por cima de outra (a confirmação). */
  zIndex?: number;
}

export default function Folha({ titulo, onFechar, children, rodape, largura = 440, zIndex }: Props) {
  const id = useId();
  const area = useAreaVisivel();
  const corpoRef = useRef<HTMLDivElement>(null);
  const folhaRef = useRef<HTMLDivElement>(null);

  // O foco entra na folha ao abrir e volta para quem a abriu ao fechar. Sem
  // isso o Esc não fechava nada no computador: a tecla vai para quem tem o
  // foco, e o foco ficava no botão de trás (a engrenagem, o Exportar). O Tab
  // também passeava pela tela coberta. Quem abriu é lido no primeiro render,
  // antes de um campo com autoFocus lá dentro tomar o foco para si.
  const [quemAbriu] = useState(() => document.activeElement);
  useEffect(() => {
    const folha = folhaRef.current;
    if (folha && !folha.contains(document.activeElement)) folha.focus({ preventScroll: true });
    return () => {
      if (quemAbriu instanceof HTMLElement && quemAbriu.isConnected) quemAbriu.focus({ preventScroll: true });
    };
  }, [quemAbriu]);

  // O teclado do iPhone abre depois do foco e encolhe a área visível: o campo
  // que estava à vista pode acabar atrás dele. Com a área nova, ele volta.
  useEffect(() => {
    const foco = document.activeElement;
    if (foco instanceof HTMLElement && corpoRef.current?.contains(foco)) {
      foco.scrollIntoView?.({ block: "nearest" });
    }
  }, [area?.height]);

  // Teclado aberto: a área visível ficou bem menor que a janela. Aí a folga
  // da barra de gestos do iPhone, embaixo do rodapé, é só espaço perdido.
  const tecladoAberto = area !== null && window.innerHeight - area.height > 120;

  return (
    <div
      className="folha-overlay"
      data-modal
      data-teclado={tecladoAberto ? "" : undefined}
      style={{ top: area?.top ?? 0, height: area?.height ?? "100%", zIndex }}
      onClick={onFechar}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onFechar();
        }
      }}
    >
      <div
        ref={folhaRef}
        tabIndex={-1}
        className="folha"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        style={{ "--folha-largura": `${largura}px` } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="folha-corpo" ref={corpoRef}>
          <div style={estilos.cabeca}>
            <h3 id={`${id}-titulo`} style={estilos.titulo}>
              {titulo}
            </h3>
            <button type="button" style={estilos.fechar} onClick={onFechar} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
        {rodape && <div className="folha-rodape">{rodape}</div>}
      </div>
    </div>
  );
}

const estilos: Record<string, CSSProperties> = {
  cabeca: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  titulo: { fontSize: 16, fontWeight: 700, minWidth: 0 },
  fechar: {
    flexShrink: 0,
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
    padding: 6,
    margin: -6,
    cursor: "pointer",
  },
};
