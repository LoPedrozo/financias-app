import { useCallback, useEffect, useState } from "react";
import { X, Copy, Check, Link2, Trash2, UserMinus } from "lucide-react";
import type { Convite, Grupo, MembroGrupo } from "../types";
import {
  gerarConviteLink,
  listarConvitesAtivos,
  listarMembros,
  removerMembro,
  revogarConvite,
} from "../lib/listas";
import { traduzirErro } from "../lib/mensagens";

// Só quem vê e quem pode entrar. Renomear, sair, arquivar e excluir vivem no
// menu da própria pilha — misturar tudo aqui foi o que escondeu as ações.
interface Props {
  grupo: Grupo;
  ehDono: boolean;
  meuUserId: string;
  onFechar: () => void;
  onMudanca: () => void;
  onAviso: (tipo: "sucesso" | "erro", mensagem: string) => void;
}

// Sem router no app, o convite viaja como parâmetro de busca e é o App quem o
// intercepta no carregamento.
function urlDoConvite(token: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?convite=${token}`;
}

function encurtar(url: string): string {
  return url.length > 46 ? `${url.slice(0, 43)}...` : url;
}

export default function ModalCompartilhar({
  grupo,
  ehDono,
  meuUserId,
  onFechar,
  onMudanca,
  onAviso,
}: Props) {
  const [membros, setMembros] = useState<MembroGrupo[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [pessoas, links] = await Promise.all([
        listarMembros(grupo.id),
        ehDono ? listarConvitesAtivos(grupo.id) : Promise.resolve([]),
      ]);
      setMembros(pessoas);
      setConvites(links);
    } catch (e) {
      console.error(e);
      onAviso("erro", traduzirErro(e));
    } finally {
      setCarregando(false);
    }
  }, [grupo.id, ehDono, onAviso]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function copiar(token: string) {
    try {
      await navigator.clipboard.writeText(urlDoConvite(token));
      setCopiado(token);
      window.setTimeout(() => setCopiado(null), 2000);
    } catch {
      onAviso("erro", "Não foi possível copiar. Selecione o link e copie.");
    }
  }

  async function gerar() {
    if (gerando) return;
    setGerando(true);
    try {
      const convite = await gerarConviteLink(grupo.id);
      await copiar(convite.token);
      await carregar();
    } catch (e) {
      console.error(e);
      onAviso("erro", traduzirErro(e));
    } finally {
      setGerando(false);
    }
  }

  async function revogar(convite: Convite) {
    try {
      await revogarConvite(convite.id);
      setConvites((atual) => atual.filter((c) => c.id !== convite.id));
      onAviso("sucesso", "Convite cancelado. O link não funciona mais.");
    } catch (e) {
      console.error(e);
      onAviso("erro", traduzirErro(e));
    }
  }

  async function remover(membro: MembroGrupo) {
    try {
      await removerMembro(membro.id);
      await carregar();
      onMudanca();
      onAviso("sucesso", "Pessoa removida da lista.");
    } catch (e) {
      console.error(e);
      onAviso("erro", traduzirErro(e));
    }
  }

  return (
    <>
      <div style={styles.overlay} data-modal onClick={onFechar}>
        <div
          style={styles.modal}
          className="modal-mobile"
          onClick={(e) => e.stopPropagation()}
        >
          <div style={styles.head}>
            <div style={styles.tituloWrap}>
              <h3 style={styles.titulo}>{grupo.nome}</h3>
            </div>
            <button style={styles.fechar} onClick={onFechar} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          {ehDono ? (
            <>
              <p style={styles.explicacao}>
                Quem entrar por este link vê <strong>só esta lista</strong>, em
                todos os meses. Suas outras listas continuam privadas.
              </p>
              <button
                style={{
                  ...styles.gerar,
                  opacity: gerando ? 0.7 : 1,
                  cursor: gerando ? "not-allowed" : "pointer",
                }}
                onClick={gerar}
                disabled={gerando}
              >
                <Link2 size={16} />
                {gerando ? "Gerando..." : "Gerar link de convite"}
              </button>
            </>
          ) : (
            <p style={styles.explicacao}>
              Você participa desta lista. Só quem a criou pode convidar mais
              gente.
            </p>
          )}

          {convites.length > 0 && (
            <div style={styles.bloco}>
              <p style={styles.blocoTitulo}>Links ativos</p>
              {convites.map((convite) => (
                <div key={convite.id} style={styles.linha}>
                  <span style={styles.link} title={urlDoConvite(convite.token)}>
                    {encurtar(urlDoConvite(convite.token))}
                  </span>
                  <button
                    style={styles.acao}
                    onClick={() => copiar(convite.token)}
                    aria-label="Copiar link"
                    title="Copiar link"
                  >
                    {copiado === convite.token ? (
                      <Check size={15} color="var(--green)" />
                    ) : (
                      <Copy size={15} />
                    )}
                  </button>
                  <button
                    style={styles.acao}
                    onClick={() => revogar(convite)}
                    aria-label="Cancelar convite"
                    title="Cancelar convite"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={styles.bloco}>
            <p style={styles.blocoTitulo}>Quem vê esta lista</p>
            {carregando ? (
              <p style={styles.vazio}>Carregando...</p>
            ) : (
              membros.map((membro) => {
                const ehOCriador = membro.user_id === grupo.criador_id;
                return (
                  <div key={membro.id} style={styles.linha}>
                    <span style={styles.avatar}>
                      {(membro.email ?? "?").charAt(0).toUpperCase()}
                    </span>
                    <span style={styles.email}>
                      {membro.email ?? "Participante"}
                      {ehOCriador && <span style={styles.dono}> · dono</span>}
                      {membro.user_id === meuUserId && (
                        <span style={styles.dono}> · você</span>
                      )}
                    </span>
                    {ehDono && !ehOCriador && (
                      <button
                        style={styles.acao}
                        onClick={() => remover(membro)}
                        aria-label="Remover da lista"
                        title="Remover da lista"
                      >
                        <UserMinus size={15} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(16, 24, 40, 0.35)",
    backdropFilter: "blur(3px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 55,
  },
  modal: {
    background: "var(--surface)",
    borderRadius: 20,
    padding: 26,
    width: "100%",
    maxWidth: 420,
    maxHeight: "85vh",
    overflowY: "auto",
    boxShadow: "0 20px 60px rgba(16,24,40,0.18)",
    animation: "fadeUp 0.25s ease",
  },
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 8,
  },
  tituloWrap: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  titulo: {
    fontSize: 19,
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fechar: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
    flexShrink: 0,
  },
  explicacao: {
    fontSize: 13.5,
    color: "var(--text-soft)",
    lineHeight: 1.5,
    marginBottom: 14,
  },
  gerar: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    padding: 12,
    borderRadius: 12,
    fontWeight: 600,
    fontSize: 14.5,
  },
  bloco: { marginTop: 20 },
  blocoTitulo: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--text-faint)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  linha: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 10px",
    background: "var(--bg)",
    borderRadius: 10,
    marginBottom: 6,
    minWidth: 0,
  },
  link: {
    flex: 1,
    fontSize: 12.5,
    color: "var(--text-soft)",
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: "var(--accent-soft)",
    color: "var(--accent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  email: {
    flex: 1,
    fontSize: 13.5,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  dono: { color: "var(--text-faint)", fontSize: 12 },
  acao: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
    padding: 4,
    cursor: "pointer",
    flexShrink: 0,
  },
  vazio: { fontSize: 13, color: "var(--text-faint)", padding: "4px 2px" },
};
