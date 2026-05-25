import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setCarregando(false);
      })
      .catch((e) => {
        console.error("Erro ao inicializar sessão:", e);
        setCarregando(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, novaSessao) => setSession(novaSessao)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, carregando };
}
