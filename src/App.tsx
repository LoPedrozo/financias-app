import { useEffect, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import AceitarConvite from "./components/AceitarConvite";
import { CONTAS_A_PAGAR_HABILITADO } from "./lib/flags";

// Convite de lista compartilhada chega como ?convite=<token>. Sem router no
// app, é aqui que ele é lido. Com a feature de contas desligada o link não
// leva a lugar nenhum: o token é ignorado e o app abre direto no Dashboard.
function tokenDoConvite(): string | null {
  if (!CONTAS_A_PAGAR_HABILITADO) return null;
  return new URLSearchParams(window.location.search).get("convite");
}

// Texto vindo de fora. O share_target de PWA só existe no Android, então o
// caminho que serve nos dois é a URL: no iPhone, um atalho do app Atalhos
// ("Receber texto → Abrir URL") manda a lista do WhatsApp para cá.
//
// O limite existe para uma URL absurda não travar a tela ao ser interpretada
// a cada tecla dentro do Adicionar.
const LIMITE_TEXTO = 4000;

function textoDaUrl(): string | null {
  const bruto = new URLSearchParams(window.location.search).get("texto");
  if (!bruto || !bruto.trim()) return null;
  return bruto.slice(0, LIMITE_TEXTO);
}

// Tira o parâmetro da URL depois de lido: um F5 não deve reabrir a mesma
// lista, nem tentar aceitar de novo um convite já consumido.
function limparDaUrl(nome: string) {
  const url = new URL(window.location.href);
  url.searchParams.delete(nome);
  window.history.replaceState({}, "", url.toString());
}

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
  const [convite, setConvite] = useState<string | null>(tokenDoConvite);
  // Sobrevive à tela de login: quem compartilhou a lista sem estar logado
  // entra e cai no Adicionar já preenchido.
  const [textoCompartilhado, setTextoCompartilhado] = useState<string | null>(
    textoDaUrl
  );

  useEffect(() => {
    limparCacheLegado();
    limparDaUrl("texto");
    // Convite ignorado ainda assim sai da URL, senão o parâmetro fica grudado
    // em todo compartilhamento do link do app.
    if (!CONTAS_A_PAGAR_HABILITADO) limparDaUrl("convite");
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

  if (!session) return <Login />;

  // O token sobrevive à tela de login: quem recebeu o link sem ter conta se
  // cadastra e cai direto no convite.
  if (convite) {
    return (
      <AceitarConvite
        token={convite}
        onPronto={() => {
          limparDaUrl("convite");
          setConvite(null);
        }}
      />
    );
  }

  return (
    <Dashboard
      session={session}
      textoInicial={textoCompartilhado ?? undefined}
      onTextoInicialUsado={() => setTextoCompartilhado(null)}
    />
  );
}
