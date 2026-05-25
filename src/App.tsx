import { useEffect } from "react";
import { useAuth } from "./hooks/useAuth";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";

// Limpeza única do cache órfão do service worker antigo (pré-correção do PWA).
// Versões antigas do app cacheavam respostas do Supabase em `supabase-api`,
// incluindo /auth/v1/user. O service worker novo não cria mais esse cache,
// mas quem visitou o site antes pode ter dados pessoais persistidos.
// Esta deleção roda uma vez no boot e é idempotente.
function limparCacheLegado() {
  if (typeof caches === "undefined") return;
  caches.delete("supabase-api").catch(() => {
    // Silencioso: se falhar, não há nada que o usuário possa fazer.
  });
}

export default function App() {
  const { session, carregando } = useAuth();

  useEffect(() => {
    limparCacheLegado();
  }, []);

  if (carregando) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-faint)",
          fontSize: 15,
        }}
      >
        Carregando...
      </div>
    );
  }

  return session ? <Dashboard session={session} /> : <Login />;
}
