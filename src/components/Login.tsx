import { useState } from "react";
import { Wallet, Mail, Lock, LogIn } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function comEmail() {
    setErro("");
    setAviso("");
    if (!email || senha.length < 6) {
      setErro("Informe um email e uma senha de pelo menos 6 caracteres.");
      return;
    }
    setCarregando(true);
    try {
      if (modo === "cadastrar") {
        const { error } = await supabase.auth.signUp({ email, password: senha });
        if (error) throw error;
        setAviso("Conta criada! Verifique seu email para confirmar o cadastro.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: senha,
        });
        if (error) throw error;
      }
    } catch (e) {
      setErro(traduzErro((e as Error).message));
    } finally {
      setCarregando(false);
    }
  }

  // redirectTo garante retorno ao mesmo origin em qualquer ambiente (dev, preview, produção)
  async function comGoogle() {
    setErro("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { 
        redirectTo: window.location.origin 
      },
    });
    if (error) setErro(traduzErro(error.message));
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <Wallet size={28} color="var(--accent)" strokeWidth={2.2} />
        </div>
        <h1 style={styles.title}>Minhas Finanças</h1>
        <p style={styles.subtitle}>
          {modo === "entrar"
            ? "Entre para ver seus lançamentos"
            : "Crie sua conta para começar"}
        </p>

        <div style={styles.field}>
          <Mail size={17} color="var(--text-faint)" />
          <input
            style={styles.input}
            type="email"
            placeholder="seu@email.com"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div style={styles.field}>
          <Lock size={17} color="var(--text-faint)" />
          <input
            style={styles.input}
            type="password"
            placeholder="sua senha"
            aria-label="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && comEmail()}
          />
        </div>

        {erro && <p style={styles.erro}>{erro}</p>}
        {aviso && <p style={styles.aviso}>{aviso}</p>}

        <button style={styles.btnPrimary} onClick={comEmail} disabled={carregando}>
          <LogIn size={17} />
          {carregando
            ? "Aguarde..."
            : modo === "entrar"
            ? "Entrar"
            : "Criar conta"}
        </button>

        <div style={styles.divisor}>
          <span style={styles.linha} />
          <span style={styles.ou}>ou</span>
          <span style={styles.linha} />
        </div>

        <button style={styles.btnGoogle} onClick={comGoogle}>
          <GoogleIcon />
          Continuar com Google
        </button>

        <p style={styles.toggle}>
          {modo === "entrar" ? "Não tem conta?" : "Já tem conta?"}{" "}
          <button
            style={styles.link}
            onClick={() => {
              setModo(modo === "entrar" ? "cadastrar" : "entrar");
              setErro("");
              setAviso("");
            }}
          >
            {modo === "entrar" ? "Cadastre-se" : "Entrar"}
          </button>
        </p>
      </div>
    </div>
  );
}

function traduzErro(msg: string): string {
  if (msg.includes("Invalid login")) return "Email ou senha incorretos.";
  if (msg.includes("already registered"))
    return "Esse email já está cadastrado.";
  if (msg.includes("Email not confirmed"))
    return "Confirme seu email antes de entrar.";
  return msg;
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5c-7.6 0-14.2 4.3-17.7 10.2z" />
      <path fill="#4CAF50" d="M24 43.5c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.5-4.6 2.5-7.5 2.5-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.1 16.2 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.5l6.5 5.5c3.8-3.5 6.3-8.8 6.3-15 0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    background:
      "radial-gradient(circle at 50% 0%, #fdfbf6 0%, var(--bg) 55%)",
  },
  card: {
    background: "var(--surface)",
    borderRadius: 24,
    padding: "40px 34px",
    width: "100%",
    maxWidth: 400,
    boxShadow: "var(--shadow)",
    border: "1px solid var(--border)",
    animation: "fadeUp 0.4s ease",
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    background: "var(--accent-soft)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 18px",
  },
  title: { fontSize: 24, fontWeight: 700, textAlign: "center", marginBottom: 4 },
  subtitle: {
    fontSize: 14,
    color: "var(--text-soft)",
    textAlign: "center",
    marginBottom: 26,
  },
  field: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "0 14px",
    marginBottom: 12,
  },
  input: {
    flex: 1,
    border: "none",
    background: "transparent",
    padding: "13px 0",
    fontSize: 15,
    color: "var(--text)",
    outline: "none",
  },
  erro: {
    color: "var(--red)",
    fontSize: 13,
    marginBottom: 12,
    background: "var(--red-soft)",
    padding: "9px 12px",
    borderRadius: 9,
  },
  aviso: {
    color: "var(--green)",
    fontSize: 13,
    marginBottom: 12,
    background: "var(--green-soft)",
    padding: "9px 12px",
    borderRadius: 9,
  },
  btnPrimary: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    padding: "13px",
    borderRadius: 12,
    fontWeight: 600,
    fontSize: 15,
  },
  divisor: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    margin: "20px 0",
  },
  linha: { flex: 1, height: 1, background: "var(--border)" },
  ou: { fontSize: 12, color: "var(--text-faint)" },
  btnGoogle: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    background: "var(--surface)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    padding: "12px",
    borderRadius: 12,
    fontWeight: 500,
    fontSize: 15,
  },
  toggle: {
    textAlign: "center",
    marginTop: 22,
    fontSize: 14,
    color: "var(--text-soft)",
  },
  link: {
    background: "none",
    border: "none",
    color: "var(--accent)",
    fontWeight: 600,
    fontSize: 14,
    padding: 0,
  },
};