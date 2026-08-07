import { useEffect, useRef } from "react";
import {
  Pencil, Users, LogOut, Archive, ArchiveRestore, Trash2, Crown,
  Wallet, WalletMinimal,
} from "lucide-react";
import type { Grupo } from "../types";

export type AcaoPilha =
  | "renomear"
  | "compartilhar"
  | "passarPosse"
  | "sair"
  | "arquivar"
  | "desarquivar"
  | "excluir"
  | "alternarSaldo";

interface Props {
  grupo: Grupo;
  ehDono: boolean;
  temOutrosMembros: boolean;
  onAcao: (acao: AcaoPilha) => void;
  onFechar: () => void;
}

interface Opcao {
  acao: AcaoPilha;
  rotulo: string;
  icone: React.ReactNode;
  perigo?: boolean;
  detalhe?: string;
}

// Tudo que diz respeito à pilha mora aqui, ao lado do nome dela. Antes essas
// ações estavam enterradas no modal de compartilhar — ninguém procura "sair da
// lista" dentro de "convidar alguém".
export default function MenuPilha({
  grupo,
  ehDono,
  temOutrosMembros,
  onAcao,
  onFechar,
}: Props) {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function cliqueFora(e: MouseEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) {
        onFechar();
      }
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    document.addEventListener("mousedown", cliqueFora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", cliqueFora);
      document.removeEventListener("keydown", esc);
    };
  }, [onFechar]);

  const opcoes: Opcao[] = [];

  if (ehDono) {
    opcoes.push(
      { acao: "compartilhar", rotulo: "Convidar alguém", icone: <Users size={15} /> },
      { acao: "renomear", rotulo: "Renomear", icone: <Pencil size={15} /> }
    );
    // Só faz sentido passar adiante se há para quem.
    if (temOutrosMembros) {
      opcoes.push({
        acao: "passarPosse",
        rotulo: "Passar a posse",
        icone: <Crown size={15} />,
      });
    }
  } else {
    opcoes.push(
      { acao: "compartilhar", rotulo: "Quem vê esta lista", icone: <Users size={15} /> },
      { acao: "sair", rotulo: "Sair da lista", icone: <LogOut size={15} />, perigo: true }
    );
  }

  // Vale para dono e participante: cada um decide se estas contas entram no
  // SEU saldo projetado. Numa lista dividida, quem paga o quê varia.
  opcoes.push(
    grupo.conta_no_saldo
      ? {
          acao: "alternarSaldo",
          rotulo: "Não contar no meu saldo",
          icone: <WalletMinimal size={15} />,
          detalhe: "Hoje entra no saldo projetado",
        }
      : {
          acao: "alternarSaldo",
          rotulo: "Contar no meu saldo",
          icone: <Wallet size={15} />,
          detalhe: "Soma as contas em aberto ao projetado",
        }
  );

  if (ehDono) {
    opcoes.push(
      grupo.arquivado
        ? { acao: "desarquivar", rotulo: "Desarquivar", icone: <ArchiveRestore size={15} /> }
        : { acao: "arquivar", rotulo: "Arquivar", icone: <Archive size={15} /> },
      { acao: "excluir", rotulo: "Excluir lista", icone: <Trash2 size={15} />, perigo: true }
    );
  }

  return (
    <div ref={caixa} style={styles.menu} role="menu">
      <p style={styles.cabecalho}>{grupo.nome}</p>
      {opcoes.map((o) => (
        <button
          key={o.acao}
          role="menuitem"
          style={{
            ...styles.item,
            color: o.perigo ? "var(--red)" : "var(--text)",
          }}
          onClick={() => onAcao(o.acao)}
        >
          {o.icone}
          <span style={styles.rotuloWrap}>
            {o.rotulo}
            {o.detalhe && <span style={styles.detalhe}>{o.detalhe}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  menu: {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    minWidth: 210,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 12px 40px rgba(16,24,40,0.16)",
    padding: 6,
    zIndex: 40,
    animation: "fadeUp 0.15s ease-out",
  },
  cabecalho: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-faint)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    padding: "6px 10px 8px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rotuloWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    minWidth: 0,
  },
  detalhe: {
    fontSize: 11.5,
    fontWeight: 400,
    color: "var(--text-faint)",
  },
  item: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 9,
    background: "none",
    border: "none",
    padding: "10px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left",
  },
};
