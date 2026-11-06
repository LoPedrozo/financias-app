import { useCallback, useEffect, useRef } from "react";
import { DURACAO_TOAST_COM_ACAO_MS } from "../components/Toast";

// Apagar com "Desfazer", no lugar do "tem certeza?".
//
// O item some da tela na hora, mas o pedido de exclusão só vai para o
// servidor quando a janela do Desfazer fecha. Assim desfazer é só devolver o
// item à tela — o mesmo objeto, com o mesmo id e o mesmo vínculo com a
// recorrência —, e não recriar um lançamento parecido, que nasceria com id
// novo e, no caso de recorrência, deixaria para trás a exceção que impede a
// regra de gerar a data de novo.
//
// A exclusão vai na hora, sem esperar a janela, quando:
// - outro item é apagado (só um fica esperando por vez);
// - o app vai para o segundo plano ou é fechado — no iPhone o app parado não
//   roda timer, e o item apagado voltaria na próxima abertura;
// - o componente sai da tela.
//
// Se o servidor recusar, o item volta para a tela e quem chama avisa.

interface Item {
  id: string;
}

interface Opcoes<T extends Item> {
  /** Apaga de verdade no servidor. */
  remover: (item: T) => Promise<void>;
  /** Tira da tela (na hora do toque). */
  aoTirar: (item: T) => void;
  /** Devolve à tela (Desfazer). */
  aoDevolver: (item: T) => void;
  /** O servidor recusou: devolver à tela e avisar. */
  aoFalhar: (item: T, erro: unknown) => void;
  janelaMs?: number;
}

export function useRemocaoComDesfazer<T extends Item>(opcoes: Opcoes<T>) {
  const pendente = useRef<{ item: T; timer: number } | null>(null);
  // As funções de quem chama mudam a cada render; o timer, armado num render
  // antigo, precisa chamar as de agora.
  const atuais = useRef(opcoes);
  atuais.current = opcoes;

  const efetivar = useCallback(() => {
    const p = pendente.current;
    if (!p) return;
    pendente.current = null;
    window.clearTimeout(p.timer);
    atuais.current.remover(p.item).catch((e) => atuais.current.aoFalhar(p.item, e));
  }, []);

  const apagar = useCallback(
    (item: T) => {
      efetivar();
      atuais.current.aoTirar(item);
      pendente.current = {
        item,
        timer: window.setTimeout(efetivar, atuais.current.janelaMs ?? DURACAO_TOAST_COM_ACAO_MS),
      };
    },
    [efetivar]
  );

  // Devolve se deu tempo. Depois que a exclusão foi enviada, não há o que
  // desfazer — e quem chama precisa saber, para não fingir que voltou.
  const desfazer = useCallback((id: string): boolean => {
    const p = pendente.current;
    if (!p || p.item.id !== id) return false;
    window.clearTimeout(p.timer);
    pendente.current = null;
    atuais.current.aoDevolver(p.item);
    return true;
  }, []);

  // Para quem recarrega a lista do servidor no meio da janela: o item ainda
  // existe lá, e não pode reaparecer na tela.
  const idEsperando = useCallback(() => pendente.current?.item.id ?? null, []);

  useEffect(() => {
    const aoEsconder = () => {
      if (document.visibilityState === "hidden") efetivar();
    };
    document.addEventListener("visibilitychange", aoEsconder);
    window.addEventListener("pagehide", efetivar);
    return () => {
      document.removeEventListener("visibilitychange", aoEsconder);
      window.removeEventListener("pagehide", efetivar);
      efetivar();
    };
  }, [efetivar]);

  return { apagar, desfazer, idEsperando };
}
