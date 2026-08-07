import { useCallback, useEffect, useState } from "react";
import { Users, AlertTriangle, Check } from "lucide-react";
import type { PreviaConvite } from "../types";
import { aceitarConvitePorToken, verConvite } from "../lib/listas";
import { traduzirErro } from "../lib/mensagens";

interface Props {
  token: string;
  onPronto: () => void;
}

// Tela que aparece quando o app é aberto por um link de convite. Fica entre o
// login e o Dashboard: sem sessão o App mostra o Login antes, e o token
// continua na URL esperando — por isso o link também serve para quem ainda não
// tem conta.
export default function AceitarConvite({ token, onPronto }: Props) {
  const [previa, setPrevia] = useState<PreviaConvite | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aceitando, setAceitando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setPrevia(await verConvite(token));
    } catch (e) {
      console.error(e);
      setErro(traduzirErro(e));
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function aceitar() {
    if (aceitando) return;
    setAceitando(true);
    try {
      await aceitarConvitePorToken(token);
      onPronto();
    } catch (e) {
      console.error(e);
      setErro(traduzirErro(e));
      setAceitando(false);
    }
  }

  return (
    <div style={styles.tela}>
      <div style={styles.cartao}>
        {carregando ? (
          <p style={styles.texto}>Carregando convite...</p>
        ) : erro ? (
          <>
            <div style={{ ...styles.icone, background: "var(--red-soft)" }}>
              <AlertTriangle size={24} color="var(--red)" />
            </div>
            <h1 style={styles.titulo}>Convite indisponível</h1>
            <p style={styles.texto}>{erro}</p>
            <button style={styles.secundario} onClick={onPronto}>
              Ir para o app
            </button>
          </>
        ) : previa?.ja_membro ? (
          <>
            <div style={{ ...styles.icone, background: "var(--green-soft)" }}>
              <Check size={24} color="var(--green)" />
            </div>
            <h1 style={styles.titulo}>Você já está nesta lista</h1>
            <p style={styles.texto}>
              <strong>{previa.grupo_nome}</strong> já aparece em Contas a Pagar,
              em todos os meses.
            </p>
            <button style={styles.primario} onClick={onPronto}>
              Abrir o app
            </button>
          </>
        ) : previa ? (
          <>
            <div style={styles.icone}>
              <Users size={24} color="var(--accent)" />
            </div>
            <h1 style={styles.titulo}>Você foi convidado</h1>
            <p style={styles.texto}>
              <strong>{previa.dono_email}</strong> quer dividir a lista{" "}
              <strong>{previa.grupo_nome}</strong> com você — em todos os meses,
              não só neste. As outras listas dessa pessoa continuam privadas.
            </p>
            <button
              style={{ ...styles.primario, opacity: aceitando ? 0.7 : 1 }}
              onClick={aceitar}
              disabled={aceitando}
            >
              {aceitando ? "Entrando..." : "Entrar na lista"}
            </button>
            <button style={styles.secundario} onClick={onPronto}>
              Agora não
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
    padding: 30,
    width: "100%",
    maxWidth: 400,
    textAlign: "center",
    boxShadow: "var(--shadow)",
  },
  icone: {
    width: 56,
    height: 56,
    borderRadius: 16,
    background: "var(--accent-soft)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
  },
  titulo: { fontSize: 20, fontWeight: 700, marginBottom: 10 },
  texto: {
    fontSize: 14,
    color: "var(--text-soft)",
    lineHeight: 1.55,
    marginBottom: 20,
  },
  primario: {
    width: "100%",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    padding: 13,
    borderRadius: 12,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
  },
  secundario: {
    width: "100%",
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    padding: 12,
    marginTop: 6,
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
};
