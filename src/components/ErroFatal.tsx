import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

// Rede de segurança para a exceção que escapa de um render.
//
// Sem isto, qualquer erro não tratado desmonta a árvore inteira do React e
// sobra uma tela branca. No navegador dá para desconfiar e apertar F5; no app
// instalado da tela de início, parece que o aplicativo simplesmente morreu —
// e o dado continua lá, intacto, sem ninguém saber.
//
// Precisa ser classe: capturar erro de render é a única coisa no React que
// ainda não tem equivalente em hook.

interface Props {
  children: ReactNode;
}

interface State {
  erro: Error | null;
}

export default class ErroFatal extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    // O console é o que sobra para investigar depois, já que não há
    // monitoramento de erro no projeto.
    console.error("Erro não tratado na interface:", erro, info.componentStack);
  }

  render() {
    const { erro } = this.state;
    if (!erro) return this.props.children;

    return (
      <div style={estilos.tela}>
        <div style={estilos.cartao}>
          <div style={estilos.icone}>
            <AlertTriangle size={24} color="var(--red)" />
          </div>
          <h1 style={estilos.titulo}>Algo quebrou nesta tela.</h1>
          <p style={estilos.texto}>
            Seus lançamentos estão salvos — o problema é só aqui na exibição.
            Recarregar costuma resolver.
          </p>
          <button
            style={estilos.botao}
            onClick={() => window.location.reload()}
          >
            <RotateCw size={15} /> Recarregar o app
          </button>
          {/* O detalhe fica escondido atrás de um toque: serve para você me
              mandar o print, não para assustar quem só quer usar. */}
          <details style={estilos.detalhes}>
            <summary style={estilos.resumo}>Detalhe técnico</summary>
            <pre style={estilos.pre}>{erro.message}</pre>
          </details>
        </div>
      </div>
    );
  }
}

const estilos: Record<string, React.CSSProperties> = {
  tela: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    background: "var(--bg)",
  },
  cartao: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 20,
    padding: 26,
    width: "100%",
    maxWidth: 420,
    textAlign: "center",
    boxShadow: "var(--shadow)",
  },
  icone: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    background: "var(--red-soft)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 14px",
  },
  titulo: { fontSize: 19, fontWeight: 700, marginBottom: 8 },
  texto: {
    fontSize: 14,
    color: "var(--text-soft)",
    lineHeight: 1.5,
    marginBottom: 20,
  },
  botao: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    padding: 13,
    borderRadius: 12,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
  },
  detalhes: { marginTop: 16, textAlign: "left" },
  resumo: {
    fontSize: 12,
    color: "var(--text-faint)",
    cursor: "pointer",
    listStyle: "none",
  },
  pre: {
    fontSize: 11,
    color: "var(--text-faint)",
    background: "var(--bg)",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
};
