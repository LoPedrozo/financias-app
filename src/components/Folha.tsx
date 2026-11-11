import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";
import { useAreaVisivel } from "../hooks/useAreaVisivel";
import { podeAnimar } from "../lib/movimento";

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
  const overlayRef = useRef<HTMLDivElement>(null);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  // Esc fecha a folha de cima, esteja o foco onde estiver. Ouvindo só a
  // própria folha, um toque fora dela (o Desfazer do aviso, por exemplo)
  // levava o foco embora e o Esc parava de funcionar.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const abertas = [...document.querySelectorAll<HTMLElement>(".folha-overlay[data-modal]")];
      const camada = (el: HTMLElement) => Number(getComputedStyle(el).zIndex) || 0;
      // A de cima: maior camada; empatando, a que veio por último.
      const topo = abertas.reduce<HTMLElement | null>((a, b) => (!a || camada(b) >= camada(a) ? b : a), null);
      if (topo !== overlayRef.current) return;
      e.preventDefault();
      fechar.current();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  // Ao fechar, a folha desce (no celular) ou some aos poucos (no computador).
  // Quem fecha é sempre o pai, que a tira da tela na hora — depois de salvar,
  // no X, no Esc. Em vez de ensinar cada modal a esperar a animação, a folha
  // deixa no lugar uma cópia de si, só imagem, que anima e some.
  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    return () => {
      if (!overlay || !podeAnimar()) return;
      const copia = overlay.cloneNode(true) as HTMLElement;
      const rolagem = overlay.querySelector(".folha-corpo")?.scrollTop ?? 0;
      // Sem papel de modal, sem ids repetidos, sem foco e sem toque: quem
      // procura "tem modal aberto?" não pode achar a cópia.
      copia.removeAttribute("data-modal");
      copia.setAttribute("aria-hidden", "true");
      copia.setAttribute("inert", "");
      copia.querySelectorAll("[role], [id]").forEach((el) => {
        el.removeAttribute("role");
        el.removeAttribute("id");
      });
      copia.classList.add("folha-saindo");
      // Só depois do commit dá para saber se a folha saiu mesmo: no modo
      // estrito do React, montar já simula uma desmontagem, e ela continua
      // na tela.
      queueMicrotask(() => {
        if (overlay.isConnected) return;
        document.body.appendChild(copia);
        const corpo = copia.querySelector(".folha-corpo");
        if (corpo) corpo.scrollTop = rolagem;
        window.setTimeout(() => copia.remove(), 260);
      });
    };
  }, []);
  useEffect(() => {
    const folha = folhaRef.current;
    if (folha && !folha.contains(document.activeElement)) folha.focus({ preventScroll: true });
    return () => {
      // Só quando a folha saiu mesmo. No modo estrito do React, montar já
      // simula uma desmontagem: devolver o foco ali tirava o foco do campo
      // de valor, e a folha, ao "voltar", ficava com ele.
      queueMicrotask(() => {
        if (folha?.isConnected) return;
        if (quemAbriu instanceof HTMLElement && quemAbriu.isConnected) quemAbriu.focus({ preventScroll: true });
      });
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
      ref={overlayRef}
      className="folha-overlay"
      data-modal
      data-teclado={tecladoAberto ? "" : undefined}
      style={{ top: area?.top ?? 0, height: area?.height ?? "100%", zIndex }}
      onClick={onFechar}
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
