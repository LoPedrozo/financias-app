import { useRegisterSW } from "virtual:pwa-register/react";
import { ArrowUpCircle, X } from "lucide-react";

// Aviso de que existe versão nova esperando para entrar.
//
// Antes o service worker trocava sozinho, mas o app só passava a usar a versão
// nova no carregamento seguinte — então toda correção exigia abrir, fechar e
// abrir de novo, ou um refresh forçado, sem nada na tela dizendo isso. Agora a
// versão nova fica esperando e a troca é um toque, no momento que a pessoa
// escolher.
//
// Fica no topo de propósito: a barra de baixo é do botão de lançar, e cobrir
// ela seria trocar um incômodo por outro. E entra no fluxo da página, não
// flutuando por cima: fixo, a faixa tapava o nome do app e o e-mail no
// cabeçalho enquanto estivesse na tela.
export default function AvisoNovaVersao() {
  const {
    needRefresh: [precisaAtualizar, setPrecisaAtualizar],
    updateServiceWorker,
  } = useRegisterSW();

  if (!precisaAtualizar) return null;

  return (
    <div style={estilos.faixa} role="status">
      <ArrowUpCircle size={15} />
      <span style={estilos.texto}>Tem uma versão nova do app.</span>
      <button
        style={estilos.atualizar}
        onClick={() => updateServiceWorker(true)}
      >
        Atualizar
      </button>
      <button
        style={estilos.dispensar}
        onClick={() => setPrecisaAtualizar(false)}
        aria-label="Agora não"
      >
        <X size={15} />
      </button>
    </div>
  );
}

const estilos: Record<string, React.CSSProperties> = {
  faixa: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    paddingTop: "max(10px, env(safe-area-inset-top))",
    position: "relative",
    zIndex: 60,
    background: "var(--accent)",
    color: "#fff",
    fontSize: 13.5,
    boxShadow: "0 2px 12px rgba(16,24,40,0.12)",
  },
  texto: { flex: 1, fontWeight: 500 },
  atualizar: {
    background: "#fff",
    color: "var(--accent)",
    border: "none",
    borderRadius: 9,
    padding: "7px 14px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },
  dispensar: {
    background: "none",
    border: "none",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    padding: 2,
    cursor: "pointer",
    opacity: 0.85,
  },
};
