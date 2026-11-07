import { AlertTriangle } from "lucide-react";
import Folha from "./Folha";
import { BotaoPrincipal, BotaoSecundario } from "./campos";

// Pergunta antes de uma ação que não tem volta (excluir uma recorrência).
// Lançamento não passa por aqui: ele se apaga com "Desfazer".
//
// Na mesma folha dos outros modais, com os dois botões lado a lado no
// rodapé — Cancelar e a ação, em vermelho. Por cima de qualquer outra folha.

interface Props {
  titulo: string;
  mensagem: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export default function ConfirmModal({
  titulo,
  mensagem,
  textoConfirmar = "Excluir",
  textoCancelar = "Cancelar",
  onConfirmar,
  onCancelar,
}: Props) {
  return (
    <Folha
      titulo={titulo}
      onFechar={onCancelar}
      largura={380}
      zIndex={70}
      rodape={
        <div style={styles.acoes}>
          <BotaoSecundario onClick={onCancelar}>{textoCancelar}</BotaoSecundario>
          <BotaoPrincipal onClick={onConfirmar} perigo>
            {textoConfirmar}
          </BotaoPrincipal>
        </div>
      }
    >
      <div style={styles.corpo}>
        <span style={styles.icone} aria-hidden="true">
          <AlertTriangle size={20} strokeWidth={2.2} />
        </span>
        <p style={styles.mensagem}>{mensagem}</p>
      </div>
    </Folha>
  );
}

const styles: Record<string, React.CSSProperties> = {
  corpo: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    paddingBottom: 6,
  },
  icone: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "var(--red-soft)",
    color: "var(--red)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  mensagem: {
    fontSize: 14.5,
    color: "var(--text-soft)",
    lineHeight: 1.5,
    paddingTop: 9,
  },
  acoes: {
    display: "flex",
    gap: 10,
  },
};
