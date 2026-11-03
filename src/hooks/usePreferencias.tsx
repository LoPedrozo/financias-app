import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  PADRAO,
  VALOR_OCULTO,
  aplicarNoDocumento,
  lerPreferencias,
  salvarPreferencias,
} from "../lib/preferencias";
import type { Preferencias } from "../lib/preferencias";
import { brl } from "../lib/format";

interface ContextoPreferencias {
  preferencias: Preferencias;
  mudar: (parcial: Partial<Preferencias>) => void;
}

// O padrão do contexto é o próprio PADRAO: componente renderizado fora do
// provider (num teste, por exemplo) se comporta exatamente como o app sem
// preferência nenhuma, em vez de quebrar.
const Contexto = createContext<ContextoPreferencias>({
  preferencias: PADRAO,
  mudar: () => {},
});

const CONSULTA_ESCURO = "(prefers-color-scheme: dark)";

function sistemaEstaEscuro(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(CONSULTA_ESCURO).matches
    : false;
}

export function PreferenciasProvider({ children }: { children: ReactNode }) {
  const [preferencias, setPreferencias] = useState(() => lerPreferencias());
  const [sistemaEscuro, setSistemaEscuro] = useState(sistemaEstaEscuro);

  // No automático, o celular trocando de tema ao anoitecer tem que trocar o
  // app junto — sem precisar fechar e abrir.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const consulta = window.matchMedia(CONSULTA_ESCURO);
    const aoMudar = (e: MediaQueryListEvent) => setSistemaEscuro(e.matches);
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, []);

  // Layout effect, não effect: a troca de tema tem que acontecer antes da
  // pintura, senão aparece um quadro com as cores antigas.
  useLayoutEffect(() => {
    aplicarNoDocumento(preferencias, sistemaEscuro);
  }, [preferencias, sistemaEscuro]);

  useEffect(() => {
    salvarPreferencias(preferencias);
  }, [preferencias]);

  const mudar = useCallback((parcial: Partial<Preferencias>) => {
    setPreferencias((atual) => ({ ...atual, ...parcial }));
  }, []);

  const valor = useMemo(() => ({ preferencias, mudar }), [preferencias, mudar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usePreferencias(): ContextoPreferencias {
  return useContext(Contexto);
}

// Formata dinheiro respeitando o "esconder valores". Todo valor da tela
// principal passa por aqui — usar `brl` direto num componente novo é o jeito
// de um número vazar com a privacidade ligada.
export function useDinheiro(): (valor: number) => string {
  const { preferencias } = usePreferencias();
  const ocultar = preferencias.ocultarValores;
  return useCallback(
    (valor: number) => (ocultar ? VALOR_OCULTO : brl(valor)),
    [ocultar]
  );
}
