import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, Pencil, Wallet, TrendingUp, TrendingDown, LogOut,
  Receipt, PieChart as PieIcon, AlertTriangle, RotateCw, Clock,
  Repeat, Home, CopyPlus,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  listarLancamentos, criarLancamento, criarLancamentosEmLote,
  atualizarLancamento, removerLancamento, removerLancamentosEmLote,
} from "../lib/lancamentos";
import { CATEGORIAS_SAIDA, CATEGORIAS_ENTRADA, MESES } from "../types";
import type { Lancamento, NovoLancamento, Recorrencia } from "../types";
import { brl } from "../lib/format";
import {
  agruparPorCategoria,
  calcularBalancoAnual,
  calcularPendentes,
  calcularSaldoAcumulado,
  calcularSaldoProjetado,
  compararCompetencia,
  competenciaAnterior,
  competenciaAtual,
  filtrarPorMes,
  hojeLocal,
  somarPorTipo,
} from "../lib/calculos";
import Card from "./Card";
import MonthPicker from "./MonthPicker";
import { useSwipe } from "../hooks/useSwipe";
import ModalNovo from "./ModalNovo";
import ModalAdicionar from "./ModalAdicionar";
import ModalRepetirMes from "./ModalRepetirMes";
import ConfirmModal from "./ConfirmModal";
import Toast, { type ToastAcao, type ToastDados } from "./Toast";
import EmptyState from "./EmptyState";
import { SkeletonLista } from "./Skeleton";
import BottomNav from "./BottomNav";
import ContasAPagar from "./ContasAPagar";
import Recorrencias from "./Recorrencias";
import { gerarLancamentosRecorrentes, listarRecorrencias } from "../lib/recorrencias";
import { pendentesDeContas } from "../lib/listas";
import { CONTAS_A_PAGAR_HABILITADO } from "../lib/flags";
import AvisoDesatualizado from "./AvisoDesatualizado";

// O recharts é metade do pacote e não aparece na aba Contas — sai do
// carregamento inicial e chega quando o Início realmente precisa desenhar.
const GraficoCategorias = lazy(() =>
  import("./Graficos").then((m) => ({ default: m.GraficoCategorias }))
);
const GraficoAnual = lazy(() =>
  import("./Graficos").then((m) => ({ default: m.GraficoAnual }))
);

function EsqueletoGrafico({ altura }: { altura: number }) {
  return (
    <div
      className="skeleton-pulse"
      style={{
        height: altura,
        borderRadius: 12,
        background: "var(--bg)",
      }}
    />
  );
}

function dataInicialNovoLancamento(mes: number, ano: number): string {
  const hoje = new Date();
  if (hoje.getFullYear() === ano && hoje.getMonth() === mes) {
    return hojeLocal();
  }
  const mm = String(mes + 1).padStart(2, "0");
  return `${ano}-${mm}-01`;
}

// Formulário completo aberto já preenchido — pela conta paga em Contas a
// Pagar, ou pela linha que o Adicionar entregou para o usuário revisar.
interface FormularioPreenchido {
  valores: Partial<
    Pick<NovoLancamento, "tipo" | "valor" | "descricao" | "categoria">
  >;
  data: string;
}

export default function Dashboard({
  session,
  textoInicial,
  onTextoInicialUsado,
}: {
  session: Session;
  /** Lista que chegou pelo atalho de compartilhamento, já pronta para revisar. */
  textoInicial?: string;
  onTextoInicialUsado?: () => void;
}) {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mes, setMes] = useState(new Date().getMonth());
  const [ano, setAno] = useState(new Date().getFullYear());
  // Texto compartilhado abre o Adicionar sozinho: quem veio do atalho já
  // pediu para lançar, não faz sentido cair no Dashboard e ter que tocar de
  // novo. Guardado em estado para não voltar ao reabrir o modal pelo +.
  const [textoAdicionar, setTextoAdicionar] = useState(textoInicial ?? "");
  const [modalAdicionar, setModalAdicionar] = useState(!!textoInicial);
  const [modalRepetir, setModalRepetir] = useState(false);
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [confirmarId, setConfirmarId] = useState<string | null>(null);
  const [tipoGrafico, setTipoGrafico] = useState<"saida" | "entrada">("saida");
  const [toast, setToast] = useState<ToastDados | null>(null);
  const [erroCarregar, setErroCarregar] = useState(false);
  const [tooltipFuturoId, setTooltipFuturoId] = useState<string | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<"inicio" | "contas">("inicio");
  const [verRecorrencias, setVerRecorrencias] = useState(false);
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [carregandoRecorrencias, setCarregandoRecorrencias] = useState(true);
  const [preLancamento, setPreLancamento] =
    useState<FormularioPreenchido | null>(null);
  const [contasEmAberto, setContasEmAberto] = useState({
    total: 0,
    quantidade: 0,
  });
  const [falhaAoAtualizar, setFalhaAoAtualizar] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const tooltipAutoHide = useRef<number | null>(null);
  const hoverDelayTimer = useRef<number | null>(null);

  function limparHoverDelay() {
    if (hoverDelayTimer.current !== null) {
      window.clearTimeout(hoverDelayTimer.current);
      hoverDelayTimer.current = null;
    }
  }

  function limparLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function abrirTooltipFuturo(id: string) {
    setTooltipFuturoId(id);
    if (tooltipAutoHide.current !== null) {
      window.clearTimeout(tooltipAutoHide.current);
    }
    tooltipAutoHide.current = window.setTimeout(() => {
      setTooltipFuturoId(null);
      tooltipAutoHide.current = null;
    }, 2000);
  }

  const fecharTooltipFuturo = useCallback(() => {
    setTooltipFuturoId(null);
    if (tooltipAutoHide.current !== null) {
      window.clearTimeout(tooltipAutoHide.current);
      tooltipAutoHide.current = null;
    }
  }, []);

  useEffect(() => {
    if (!tooltipFuturoId) return;

    // O listener entra num setTimeout(0) de propósito. No iOS o toque que
    // abriu o tooltip ainda está propagando quando o efeito roda, e sem essa
    // folga ele mesmo dispara o fechamento — a tela reabria em seguida e o
    // usuário precisava de dois toques para sair.
    let registrado = false;
    const aoDestravar = window.setTimeout(() => {
      registrado = true;
      window.addEventListener("touchstart", fecharTooltipFuturo, {
        passive: true,
      });
      window.addEventListener("mousedown", fecharTooltipFuturo);
      // Rolar a lista com o tooltip aberto deixava o balão flutuando longe do
      // item a que pertence.
      window.addEventListener("scroll", fecharTooltipFuturo, {
        passive: true,
        capture: true,
      });
    }, 0);

    return () => {
      window.clearTimeout(aoDestravar);
      if (!registrado) return;
      window.removeEventListener("touchstart", fecharTooltipFuturo);
      window.removeEventListener("mousedown", fecharTooltipFuturo);
      window.removeEventListener("scroll", fecharTooltipFuturo, {
        capture: true,
      });
    };
  }, [tooltipFuturoId, fecharTooltipFuturo]);

  // Trocar de mês ou abrir qualquer modal tira o item de baixo do balão.
  useEffect(() => {
    fecharTooltipFuturo();
  }, [
    mes,
    ano,
    modalAdicionar,
    modalRepetir,
    editando,
    confirmarId,
    preLancamento,
    fecharTooltipFuturo,
  ]);

  useEffect(() => {
    return () => {
      limparLongPress();
      limparHoverDelay();
      if (tooltipAutoHide.current !== null) {
        window.clearTimeout(tooltipAutoHide.current);
      }
    };
  }, []);

  const mostrarToast = useCallback(
    (tipo: ToastDados["tipo"], mensagem: string, acao?: ToastAcao) => {
      setToast({ id: Date.now(), tipo, mensagem, acao });
    },
    []
  );

  const carregar = useCallback(() => {
    setCarregando(true);
    setErroCarregar(false);
    listarLancamentos()
      .then(setLancamentos)
      .catch((e) => {
        console.error(e);
        setErroCarregar(true);
      })
      .finally(() => setCarregando(false));
  }, []);

  const sincronizarRecorrentes = useCallback(() => {
    // Só gera para o mês corrente e futuros. Navegar para trás no MonthPicker
    // não deve materializar lançamentos em meses fechados. A trava definitiva
    // vive em gerarLancamentosRecorrentes; aqui evitamos só a ida ao servidor.
    if (compararCompetencia({ mes, ano }, competenciaAtual()) < 0) return;

    gerarLancamentosRecorrentes(mes, ano)
      .then((novos) => {
        if (novos.length > 0) carregar();
      })
      .catch((e) => {
        console.error(e);
        setFalhaAoAtualizar(true);
      });
  }, [carregar, mes, ano]);

  useEffect(() => {
    carregar();
    sincronizarRecorrentes();
  }, [carregar, sincronizarRecorrentes]);

  useEffect(() => {
    listarRecorrencias()
      .then(setRecorrencias)
      .catch((e) => {
        console.error(e);
        setFalhaAoAtualizar(true);
      })
      .finally(() => setCarregandoRecorrencias(false));
  }, []);

  const carregarContasEmAberto = useCallback(() => {
    // Feature desligada: nada de consultar pilhas e itens. `contasEmAberto`
    // fica zerado e o saldo projetado volta a olhar só os lançamentos.
    if (!CONTAS_A_PAGAR_HABILITADO) return;
    pendentesDeContas(mes, ano)
      .then((r) => {
        setContasEmAberto(r);
        setFalhaAoAtualizar(false);
      })
      .catch((e) => {
        console.error(e);
        setFalhaAoAtualizar(true);
      });
  }, [mes, ano]);

  useEffect(() => {
    carregarContasEmAberto();
  }, [carregarContasEmAberto]);

  const atualizarTudo = useCallback(() => {
    carregar();
    carregarContasEmAberto();
    listarRecorrencias()
      .then(setRecorrencias)
      .catch((e) => {
        console.error(e);
        setFalhaAoAtualizar(true);
      });
  }, [carregar, carregarContasEmAberto]);

  // Com o celular bloqueado o WebSocket cai, e os eventos perdidos nesse
  // intervalo não são reenviados — a tela voltaria com número velho. Ao
  // reaparecer, buscamos tudo de novo em vez de confiar no Realtime.
  useEffect(() => {
    function aoVoltar() {
      if (document.visibilityState === "visible") atualizarTudo();
    }
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [atualizarTudo]);

  // Três coisas mexem neste número: a conta em si (pagar, criar, excluir), a
  // sua preferência de contar aquela pilha, e arquivar a pilha. Escutar só a
  // primeira fazia o interruptor "não contar no meu saldo" parecer quebrado —
  // desligar não mudava nada, e só excluir a conta tirava o valor da tela.
  useEffect(() => {
    if (!CONTAS_A_PAGAR_HABILITADO) return;
    const canal = supabase
      .channel("contas-no-saldo")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "itens_lista" },
        () => carregarContasEmAberto()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "membros_grupo" },
        () => carregarContasEmAberto()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grupos" },
        () => carregarContasEmAberto()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregarContasEmAberto]);

  async function adicionar(item: NovoLancamento) {
    try {
      const novo = await criarLancamento(item);
      setLancamentos((atual) => [novo, ...atual]);
      mostrarToast("sucesso", "Lançamento salvo!");
    } catch (e) {
      console.error(e);
      mostrarToast("erro", "Não foi possível salvar. Verifique sua conexão.");
    }
  }

  // Tira do ar a leva que acabou de entrar. É o arrependimento rápido: colou
  // a lista errada, trouxe o mês que não era. Passado o toast, o caminho
  // volta a ser excluir um a um.
  async function desfazerLote(ids: string[]) {
    const anterior = lancamentos;
    const alvo = new Set(ids);
    setLancamentos((atual) => atual.filter((l) => !alvo.has(l.id)));
    try {
      await removerLancamentosEmLote(ids);
      mostrarToast(
        "sucesso",
        ids.length === 1
          ? "Lançamento desfeito."
          : `${ids.length} lançamentos desfeitos.`
      );
    } catch (e) {
      console.error(e);
      setLancamentos(anterior);
      mostrarToast("erro", "Não foi possível desfazer.");
    }
  }

  // Serve tanto ao Adicionar quanto ao Repetir mês: os dois entregam uma
  // leva pronta, que pode ter uma linha só.
  async function adicionarVarios(itens: NovoLancamento[]) {
    try {
      const novos = await criarLancamentosEmLote(itens);
      setLancamentos((atual) => [...novos, ...atual]);
      fecharAdicionar();
      setModalRepetir(false);
      const ids = novos.map((n) => n.id);
      mostrarToast(
        "sucesso",
        novos.length === 1
          ? "Lançamento salvo!"
          : `${novos.length} lançamentos salvos!`,
        { rotulo: "Desfazer", onAcao: () => desfazerLote(ids) }
      );
    } catch (e) {
      console.error(e);
      // A falha pode ser só a resposta perdida no caminho, com o insert já
      // gravado. Recarregar deixa a tela igual ao servidor, e é isso que faz
      // o aviso de repetida aparecer se ele tentar salvar de novo.
      carregar();
      mostrarToast("erro", "Não foi possível salvar. Verifique sua conexão.");
    }
  }

  async function editar(item: NovoLancamento) {
    if (!editando) return;
    const original = editando;
    const otimista: Lancamento = { ...original, ...item };
    setLancamentos((atual) =>
      atual.map((l) => (l.id === original.id ? otimista : l))
    );
    setEditando(null);
    try {
      const atualizado = await atualizarLancamento(original.id, item);
      setLancamentos((atual) =>
        atual.map((l) => (l.id === atualizado.id ? atualizado : l))
      );
      mostrarToast("sucesso", "Lançamento atualizado!");
    } catch (e) {
      console.error(e);
      setLancamentos((atual) =>
        atual.map((l) => (l.id === original.id ? original : l))
      );
      mostrarToast("erro", "Não foi possível salvar. Verifique sua conexão.");
    }
  }

  async function confirmarRemocao() {
    if (!confirmarId) return;
    const id = confirmarId;
    setConfirmarId(null);
    const anterior = lancamentos;
    const alvo = anterior.find((l) => l.id === id);
    if (!alvo) return;
    setLancamentos((atual) => atual.filter((l) => l.id !== id));
    try {
      await removerLancamento(alvo);
      mostrarToast("sucesso", "Lançamento excluído.");
    } catch (e) {
      console.error(e);
      setLancamentos(anterior);
      mostrarToast("erro", "Não foi possível excluir. Verifique sua conexão.");
    }
  }

  function dataOrdenacao(l: Lancamento): string {
    return l.data ?? l.created_at.slice(0, 10);
  }

  const doMes = useMemo(
    () =>
      filtrarPorMes(lancamentos, mes, ano)
        .slice()
        .sort((a, b) => {
          const cmp = dataOrdenacao(b).localeCompare(dataOrdenacao(a));
          if (cmp !== 0) return cmp;
          return b.created_at.localeCompare(a.created_at);
        }),
    [lancamentos, mes, ano]
  );

  const anterior = useMemo(
    () => competenciaAnterior({ mes, ano }),
    [mes, ano]
  );

  const doMesAnterior = useMemo(
    () => filtrarPorMes(lancamentos, anterior.mes, anterior.ano),
    [lancamentos, anterior]
  );

  // Um mês só de recorrências não tem o que repetir: elas se geram sozinhas.
  const podeRepetir = doMesAnterior.some((l) => !l.recorrencia_id);

  const renda = somarPorTipo(doMes, "entrada");
  const gastos = somarPorTipo(doMes, "saida");

  const saldoAcumulado = useMemo(
    () => calcularSaldoAcumulado(lancamentos, mes, ano),
    [lancamentos, mes, ano]
  );

  const pendentesLancamentos = useMemo(
    () => calcularPendentes(lancamentos, mes, ano),
    [lancamentos, mes, ano]
  );

  // As contas a pagar em aberto das pilhas marcadas somam às saídas previstas.
  // Só as não pagas entram: quando uma é quitada ela sai daqui e vira (ou não)
  // um lançamento — assim o mesmo valor nunca conta duas vezes.
  const pendentes = useMemo(
    () => ({
      entradas: pendentesLancamentos.entradas,
      saidas: {
        total: pendentesLancamentos.saidas.total + contasEmAberto.total,
        quantidade:
          pendentesLancamentos.saidas.quantidade + contasEmAberto.quantidade,
      },
    }),
    [pendentesLancamentos, contasEmAberto]
  );

  const saldoProjetado = useMemo(
    () =>
      calcularSaldoProjetado(lancamentos, mes, ano) - contasEmAberto.total,
    [lancamentos, mes, ano, contasEmAberto]
  );

  const porCategoria = useMemo(
    () =>
      agruparPorCategoria(
        doMes,
        tipoGrafico,
        tipoGrafico === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA
      ),
    [doMes, tipoGrafico]
  );

  const anual = useMemo(
    () => calcularBalancoAnual(lancamentos, ano, MESES),
    [lancamentos, ano]
  );

  const email = session.user.email ?? "";

  // Usada pelas duas navegações — a barra inferior no celular e o seletor do
  // header no desktop. Trocar de aba com um modal aberto deixaria o modal
  // pairando sobre a tela errada.
  // Um caminho só para fechar: o texto do atalho precisa ser esquecido em
  // todas as saídas, senão ele reaparece na próxima vez que o + for tocado.
  const fecharAdicionar = useCallback(() => {
    setModalAdicionar(false);
    setTextoAdicionar("");
    onTextoInicialUsado?.();
  }, [onTextoInicialUsado]);

  function navegarPara(aba: "inicio" | "contas") {
    fecharAdicionar();
    setModalRepetir(false);
    setEditando(null);
    setConfirmarId(null);
    setPreLancamento(null);
    setVerRecorrencias(false);
    setAbaAtiva(aba);
  }

  function avancarMes() {
    if (mes === 11) {
      setMes(0);
      setAno((a) => a + 1);
    } else {
      setMes((m) => m + 1);
    }
  }

  function recuarMes() {
    if (mes === 0) {
      setMes(11);
      setAno((a) => a - 1);
    } else {
      setMes((m) => m - 1);
    }
  }

  const swipeHandlers = useSwipe({
    onSwipeLeft: avancarMes,
    onSwipeRight: recuarMes,
    threshold: 50,
  });

  return (
    <div
      ref={swipeHandlers.ref}
      style={styles.page}
      className="page-root page-com-bottom-nav"
      onTouchStart={swipeHandlers.onTouchStart}
      onTouchEnd={swipeHandlers.onTouchEnd}
    >
      <header style={styles.header}>
        <div style={styles.brand}>
          <img src="/icon-192.png" alt="" style={styles.logo} />
          <div>
            <h1 style={styles.title} className="app-title">Minhas Finanças</h1>
            <p style={styles.user}>{email}</p>
          </div>
        </div>
        <div style={styles.headerRight}>
          {/* No desktop a barra inferior não existe, e ela era o único caminho
              para Contas a Pagar — a aba ficava inalcançável em tela grande. */}
          {CONTAS_A_PAGAR_HABILITADO && (
          <div style={styles.navDesktop} className="desktop-nav">
            <button
              type="button"
              onClick={() => navegarPara("inicio")}
              aria-current={
                abaAtiva === "inicio" && !verRecorrencias ? "page" : undefined
              }
              style={{
                ...styles.navDesktopBtn,
                ...(abaAtiva === "inicio" && !verRecorrencias
                  ? styles.navDesktopBtnAtivo
                  : {}),
              }}
            >
              <Home size={15} /> Início
            </button>
            <button
              type="button"
              onClick={() => navegarPara("contas")}
              aria-current={abaAtiva === "contas" ? "page" : undefined}
              style={{
                ...styles.navDesktopBtn,
                ...(abaAtiva === "contas" ? styles.navDesktopBtnAtivo : {}),
              }}
            >
              <Receipt size={15} /> Contas
            </button>
          </div>
          )}

          {/* Contas a Pagar também é por mês: sem o seletor aqui, a aba ficava
              presa no mês escolhido em Início e o histórico era inalcançável. */}
          {!verRecorrencias && (
            <MonthPicker
              mes={mes}
              ano={ano}
              onChange={(m, a) => {
                setMes(m);
                setAno(a);
              }}
            />
          )}
          <button
            style={styles.sair}
            onClick={() => supabase.auth.signOut()}
            aria-label="Sair"
            title="Sair"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {verRecorrencias ? (
        <Recorrencias
          mesAlvo={{ mes, ano, nome: MESES[mes], lancamentos: doMes }}
          recorrencias={recorrencias}
          onRecorrenciasChange={setRecorrencias}
          onVoltar={() => setVerRecorrencias(false)}
          onMudanca={() => {
            carregar();
            sincronizarRecorrentes();
          }}
        />
      ) : abaAtiva === "inicio" || !CONTAS_A_PAGAR_HABILITADO ? (
      <>

      {falhaAoAtualizar && <AvisoDesatualizado onTentarDeNovo={atualizarTudo} />}

      <div style={styles.cards}>
        <Card
          label="Renda"
          valor={renda}
          icon={<TrendingUp size={18} />}
          cor="var(--green)"
        />
        <Card
          label="Gastos"
          valor={gastos}
          icon={<TrendingDown size={18} />}
          cor="var(--red)"
        />
        <Card
          label="Saldo atual"
          valor={saldoAcumulado}
          icon={<Wallet size={18} />}
          cor={saldoAcumulado >= 0 ? "var(--accent)" : "var(--red)"}
          destaque
          pendente={pendentes}
          contasAPagar={contasEmAberto}
          saldoProjetado={
            pendentes.entradas.quantidade > 0 || pendentes.saidas.quantidade > 0
              ? saldoProjetado
              : undefined
          }
        />
      </div>

      <div style={styles.grid}>
        <div style={styles.panel} className="panel-mobile">
          <div style={styles.panelHead}>
            <h2 style={styles.panelTitleInline}>
              {tipoGrafico === "entrada" ? "Entradas por categoria" : "Gastos por categoria"}
            </h2>
            <div style={styles.toggle}>
              <button
                style={{
                  ...styles.toggleBtn,
                  ...(tipoGrafico === "saida" ? styles.toggleBtnAtivo : {}),
                }}
                onClick={() => setTipoGrafico("saida")}
              >
                Saídas
              </button>
              <button
                style={{
                  ...styles.toggleBtn,
                  ...(tipoGrafico === "entrada" ? styles.toggleBtnAtivo : {}),
                }}
                onClick={() => setTipoGrafico("entrada")}
              >
                Entradas
              </button>
            </div>
          </div>
          {porCategoria.length === 0 ? (
            <div style={{ minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <EmptyState
                compacto
                icon={<PieIcon size={22} />}
                titulo={
                  tipoGrafico === "entrada"
                    ? "Sem entradas lançadas neste mês."
                    : "Sem gastos lançados neste mês."
                }
              />
            </div>
          ) : (
            <>
              <Suspense fallback={<EsqueletoGrafico altura={220} />}>
                <GraficoCategorias dados={porCategoria} />
              </Suspense>
              <div style={styles.legend}>
                {porCategoria.map((c) => (
                  <span key={c.name} style={styles.legendItem}>
                    <span style={{ ...styles.dot, background: c.cor }} />
                    {c.name} · {brl(c.value)}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={styles.panel} className="panel-mobile">
          <h2 style={styles.panelTitle}>Quanto sobrou no ano</h2>
          <Suspense fallback={<EsqueletoGrafico altura={290} />}>
            <GraficoAnual dados={anual} />
          </Suspense>
        </div>
      </div>

      <div style={styles.panel} className="panel-mobile">
        <div style={styles.listHead}>
          <h2 style={styles.panelTitle}>Lançamentos de {MESES[mes]}</h2>
          <div style={styles.listHeadAcoes}>
            {podeRepetir && (
              <button
                style={styles.repetir}
                onClick={() => setModalRepetir(true)}
                title={`Repetir ${MESES[anterior.mes]} neste mês`}
              >
                <CopyPlus size={15} /> Repetir
              </button>
            )}
            {/* No celular quem adiciona é o botão redondo da barra de
                baixo. Repetir o mesmo botão aqui só roubava a largura que
                o título e o Repetir precisam para caber lado a lado. */}
            <button
              style={styles.add}
              className="so-desktop"
              onClick={() => setModalAdicionar(true)}
            >
              <Plus size={16} /> Novo
            </button>
          </div>
        </div>
        {carregando ? (
          <SkeletonLista linhas={4} />
        ) : erroCarregar ? (
          <div style={styles.erroBox}>
            <div style={styles.erroIcone}>
              <AlertTriangle size={22} />
            </div>
            <p style={styles.erroTitulo}>
              Não foi possível carregar seus lançamentos.
            </p>
            <button style={styles.retry} onClick={carregar}>
              <RotateCw size={14} /> Tentar novamente
            </button>
          </div>
        ) : doMes.length === 0 ? (
          <EmptyState
            icon={<Receipt size={24} />}
            titulo="Nenhum lançamento ainda."
            // Sem citar botão: no celular quem adiciona é o + da barra de
            // baixo, e no desktop é o Novo aqui do lado.
            sugestao={
              podeRepetir
                ? `Traga ${MESES[anterior.mes]} de uma vez, ou adicione um a um.`
                : "Ao adicionar, dá para escrever uma linha ou colar a lista inteira."
            }
            acao={
              podeRepetir ? (
                <button
                  style={styles.repetirDestaque}
                  onClick={() => setModalRepetir(true)}
                >
                  <CopyPlus size={15} /> Repetir {MESES[anterior.mes]}
                </button>
              ) : undefined
            }
          />
        ) : (
          <div style={styles.list}>
            {doMes.map((l, idx) => {
              const lista =
                l.tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
              const cat = lista.find((c) => c.nome === l.categoria);
              const cor =
                cat?.cor ??
                (l.tipo === "entrada" ? "var(--green)" : "#9aa3b0");
              const dia = Number(dataOrdenacao(l).slice(8, 10));
              const futuro = !!l.data && l.data > hojeLocal();
              const dataFmt = futuro
                ? `${l.data!.slice(8, 10)}/${l.data!.slice(5, 7)}`
                : "";
              const titleFuturo = futuro
                ? `Será contabilizado em ${dataFmt} · ${brl(l.valor)}`
                : undefined;
              const corBorda =
                l.tipo === "entrada" ? "var(--green)" : "var(--red)";
              const itemStyle: React.CSSProperties = futuro
                ? {
                    ...styles.item,
                    background: "var(--bg)",
                    boxShadow: "none",
                    position: "relative",
                  }
                : {
                    ...styles.item,
                    background: "var(--surface)",
                    boxShadow: "var(--shadow)",
                    borderLeft: `3px solid ${corBorda}`,
                    position: "relative",
                  };
              return (
                <div
                  key={l.id}
                  style={itemStyle}
                  title={futuro ? undefined : titleFuturo}
                  onTouchStart={
                    futuro
                      ? () => {
                          limparLongPress();
                          longPressTimer.current = window.setTimeout(() => {
                            abrirTooltipFuturo(l.id);
                            longPressTimer.current = null;
                          }, 500);
                        }
                      : undefined
                  }
                  onTouchEnd={futuro ? limparLongPress : undefined}
                  onTouchMove={futuro ? limparLongPress : undefined}
                  onTouchCancel={futuro ? limparLongPress : undefined}
                  onMouseEnter={
                    futuro
                      ? () => {
                          limparHoverDelay();
                          hoverDelayTimer.current = window.setTimeout(() => {
                            setTooltipFuturoId(l.id);
                            hoverDelayTimer.current = null;
                          }, 700);
                        }
                      : undefined
                  }
                  onMouseLeave={
                    futuro
                      ? () => {
                          limparHoverDelay();
                          setTooltipFuturoId(null);
                        }
                      : undefined
                  }
                >
                  {futuro && tooltipFuturoId === l.id && (
                    <div
                      style={
                        idx === 0
                          ? styles.tooltipFuturoAbaixo
                          : styles.tooltipFuturo
                      }
                    >
                      Será contabilizado em {dataFmt} · {brl(l.valor)}
                      <span
                        style={
                          idx === 0
                            ? styles.tooltipSetaCima
                            : styles.tooltipSetaBaixo
                        }
                      />
                    </div>
                  )}
                  <div style={styles.itemTopo}>
                    {futuro ? (
                      <span
                        style={{
                          ...styles.dia,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Clock size={13} color="var(--text-faint)" />
                        {dia}
                      </span>
                    ) : (
                      <span style={styles.dia}>{dia}</span>
                    )}
                    <span
                      style={{
                        ...styles.tag,
                        background: cor + "1f",
                        color: cor,
                      }}
                    >
                      {l.categoria}
                    </span>
                    <span
                      style={{
                        ...styles.valor,
                        color: l.tipo === "entrada" ? "var(--green)" : "var(--red)",
                      }}
                    >
                      {l.tipo === "entrada" ? "+" : "−"} {brl(l.valor)}
                    </span>
                  </div>
                  <div style={styles.itemBase}>
                    <span style={styles.desc}>{l.descricao || "—"}</span>
                    <div style={styles.acoes}>
                      <button
                        style={styles.acao}
                        onClick={() => setEditando(l)}
                        aria-label="Editar lançamento"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        style={styles.acao}
                        onClick={() => setConfirmarId(l.id)}
                        aria-label="Excluir lançamento"
                        title="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RecorrenciasResumo
        recorrencias={recorrencias}
        carregando={carregandoRecorrencias}
        onAbrir={() => setVerRecorrencias(true)}
      />
      </>
      ) : (
        <ContasAPagar
          mes={mes}
          ano={ano}
          session={session}
          onNovoLancamento={(item) =>
            setPreLancamento({
              valores: {
                tipo: "saida",
                valor: item.valor,
                descricao: item.descricao,
                categoria: item.categoria,
              },
              data: hojeLocal(),
            })
          }
        />
      )}

      {modalAdicionar && (
        <ModalAdicionar
          dataPadrao={dataInicialNovoLancamento(mes, ano)}
          jaLancados={lancamentos}
          textoInicial={textoAdicionar}
          onFechar={fecharAdicionar}
          onSalvar={adicionarVarios}
          onFormularioCompleto={(valores, data) => {
            fecharAdicionar();
            setPreLancamento({ valores, data });
          }}
        />
      )}

      {modalRepetir && (
        <ModalRepetirMes
          mes={mes}
          ano={ano}
          origem={doMesAnterior}
          jaNoMes={doMes}
          mesOrigemNome={MESES[anterior.mes]}
          onFechar={() => setModalRepetir(false)}
          onSalvar={adicionarVarios}
        />
      )}

      {preLancamento && (
        <ModalNovo
          valoresIniciais={preLancamento.valores}
          dataInicial={preLancamento.data}
          onFechar={() => setPreLancamento(null)}
          onSalvar={async (item) => {
            await adicionar(item);
            setPreLancamento(null);
          }}
        />
      )}

      {editando && (
        <ModalNovo
          lancamentoParaEditar={editando}
          onFechar={() => setEditando(null)}
          onSalvar={editar}
        />
      )}

      {toast && <Toast toast={toast} onFechar={() => setToast(null)} />}

      {confirmarId && (
        <ConfirmModal
          titulo="Excluir lançamento"
          mensagem="Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita."
          textoConfirmar="Excluir"
          textoCancelar="Cancelar"
          onConfirmar={confirmarRemocao}
          onCancelar={() => setConfirmarId(null)}
        />
      )}

      <BottomNav
        abaAtiva={abaAtiva}
        mostrarContas={CONTAS_A_PAGAR_HABILITADO}
        onNavegar={navegarPara}
        onNovo={() => {
          setVerRecorrencias(false);
          setModalAdicionar(true);
        }}
      />
    </div>
  );
}

const DIAS_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

function textoFrequenciaRecorrencia(r: Recorrencia): string {
  if (r.frequencia === "semanal" && r.dia_semana != null) {
    return `todo ${DIAS_SEMANA[r.dia_semana]}`;
  }
  if (r.frequencia === "mensal" && r.dia_mes != null) {
    return `todo dia ${r.dia_mes}`;
  }
  return "";
}

function RecorrenciasResumo({
  recorrencias,
  carregando,
  onAbrir,
}: {
  recorrencias: Recorrencia[];
  carregando: boolean;
  onAbrir: () => void;
}) {
  const ativas = recorrencias.filter((r) => r.ativo);
  const visiveis = ativas.slice(0, 3);
  const restantes = ativas.length - visiveis.length;

  return (
    <div
      style={{ ...styles.panel, marginTop: 16 }}
      className="panel-mobile"
    >
      <div style={styles.recorrenciasHead}>
        <div style={styles.recorrenciasTituloWrap}>
          <Repeat size={16} color="var(--text-soft)" />
          <h2 style={styles.panelTitleInline}>Recorrências ativas</h2>
        </div>
        <button
          type="button"
          onClick={onAbrir}
          style={styles.recorrenciasLink}
        >
          Gerenciar →
        </button>
      </div>

      {carregando ? (
        <SkeletonLista linhas={2} />
      ) : ativas.length === 0 ? (
        <div style={styles.recorrenciasVazio}>
          <span>Nenhuma recorrência ativa</span>
          <span style={styles.recorrenciasSep}>·</span>
          <button
            type="button"
            onClick={onAbrir}
            style={styles.recorrenciasLinkInline}
          >
            + Criar
          </button>
        </div>
      ) : (
        <div style={styles.recorrenciasLista}>
          {visiveis.map((r) => {
            const cor = r.tipo === "entrada" ? "var(--green)" : "var(--red)";
            return (
              <div key={r.id} style={styles.recorrenciaLinha}>
                <span style={{ ...styles.recorrenciaValor, color: cor }}>
                  {r.tipo === "entrada" ? "+" : "−"} {brl(r.valor)}
                </span>
                <span style={styles.recorrenciasSep}>·</span>
                <span style={styles.recorrenciaDesc}>{r.descricao}</span>
                <span style={styles.recorrenciasSep}>·</span>
                <span style={styles.recorrenciaFreq}>
                  {textoFrequenciaRecorrencia(r)}
                </span>
              </div>
            );
          })}
          {restantes > 0 && (
            <button
              type="button"
              onClick={onAbrir}
              style={styles.recorrenciasMais}
            >
              e mais {restantes} recorrência{restantes > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1060, margin: "0 auto", padding: "28px 20px 60px" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 26,
    flexWrap: "wrap",
    gap: 14,
  },
  brand: { display: "flex", alignItems: "center", gap: 12 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: "block",
    flexShrink: 0,
  },
  title: { fontSize: 22, fontWeight: 700 },
  user: { fontSize: 12.5, color: "var(--text-faint)" },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  navDesktop: {
    gap: 3,
    background: "var(--bg)",
    padding: 3,
    borderRadius: 11,
    border: "1px solid var(--border)",
  },
  navDesktopBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 13px",
    border: "none",
    borderRadius: 8,
    background: "transparent",
    color: "var(--text-faint)",
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
  },
  navDesktopBtnAtivo: {
    background: "var(--surface)",
    color: "var(--accent)",
    boxShadow: "var(--shadow)",
  },
  sair: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-soft)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cards: {
    // 250px é o mínimo para caber "−R$ 3.139,90" ao lado do ícone sem cortar.
    // Com 200px o saldo aparecia como "−R$ 32..." em telas médias.
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 14,
    marginBottom: 16,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
    gap: 16,
    marginBottom: 16,
  },
  panel: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 22,
    boxShadow: "var(--shadow)",
  },
  panelTitle: { fontSize: 16, fontWeight: 600, marginBottom: 14 },
  panelHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  panelTitleInline: { fontSize: 16, fontWeight: 600 },
  toggle: {
    display: "flex",
    gap: 3,
    background: "var(--bg)",
    padding: 3,
    borderRadius: 9,
  },
  toggleBtn: {
    padding: "4px 10px",
    border: "none",
    borderRadius: 7,
    background: "transparent",
    color: "var(--text-faint)",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
  },
  toggleBtnAtivo: {
    background: "var(--surface)",
    color: "var(--text)",
    boxShadow: "var(--shadow)",
  },
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 16px",
    marginTop: 8,
    fontSize: 12.5,
    color: "var(--text-soft)",
  },
  legendItem: { display: "flex", alignItems: "center", gap: 6 },
  dot: { width: 9, height: 9, borderRadius: "50%" },
  listHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  listHeadAcoes: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  repetir: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "var(--bg)",
    color: "var(--text-soft)",
    border: "1px solid var(--border)",
    padding: "8px 12px",
    borderRadius: 11,
    fontWeight: 600,
    fontSize: 13.5,
  },
  repetirDestaque: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "var(--accent-soft)",
    color: "var(--text)",
    border: "none",
    padding: "10px 16px",
    borderRadius: 11,
    fontWeight: 600,
    fontSize: 13.5,
  },
  add: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    padding: "9px 16px",
    borderRadius: 11,
    fontWeight: 600,
    fontSize: 14,
  },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  item: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    background: "var(--bg)",
    padding: "12px 14px",
    borderRadius: 12,
    minWidth: 0,
  },
  itemTopo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  itemBase: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  erroBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    padding: "30px 16px",
    gap: 10,
  },
  erroIcone: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: "var(--red-soft)",
    color: "var(--red)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  erroTitulo: {
    fontSize: 14,
    color: "var(--text-soft)",
    fontWeight: 500,
  },
  retry: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    padding: "8px 14px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    marginTop: 4,
  },
  acoes: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    marginLeft: "auto",
    flexShrink: 0,
  },
  dia: {
    fontFamily: "'Sora', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-faint)",
    minWidth: 22,
    textAlign: "center",
  },
  tag: {
    fontSize: 12,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 7,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0,
  },
  desc: {
    fontSize: 14,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
    minWidth: 0,
  },
  valor: {
    fontFamily: "'Sora', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    whiteSpace: "nowrap",
    marginLeft: "auto",
    flexShrink: 0,
  },
  acao: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    display: "flex",
    padding: 4,
    cursor: "pointer",
  },
  tooltipFuturo: {
    position: "absolute",
    bottom: "calc(100% + 6px)",
    left: 8,
    background: "#0d0d0d",
    color: "#fff",
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 8,
    padding: "6px 10px",
    whiteSpace: "nowrap",
    boxShadow: "0 6px 18px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)",
    zIndex: 200,
    pointerEvents: "none",
    opacity: 1,
    lineHeight: 1.35,
  },
  tooltipFuturoAbaixo: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 8,
    background: "#0d0d0d",
    color: "#fff",
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 8,
    padding: "6px 10px",
    whiteSpace: "nowrap",
    boxShadow: "0 6px 18px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)",
    zIndex: 200,
    pointerEvents: "none",
    opacity: 1,
    lineHeight: 1.35,
  },
  tooltipSetaBaixo: {
    position: "absolute",
    top: "100%",
    left: 18,
    width: 0,
    height: 0,
    borderLeft: "6px solid transparent",
    borderRight: "6px solid transparent",
    borderTop: "6px solid #0d0d0d",
  },
  tooltipSetaCima: {
    position: "absolute",
    bottom: "100%",
    left: 18,
    width: 0,
    height: 0,
    borderLeft: "6px solid transparent",
    borderRight: "6px solid transparent",
    borderBottom: "6px solid #0d0d0d",
  },
  recorrenciasHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  recorrenciasTituloWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  recorrenciasLink: {
    background: "none",
    border: "none",
    color: "var(--accent)",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    padding: 4,
  },
  recorrenciasLinkInline: {
    background: "none",
    border: "none",
    color: "var(--accent)",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
  },
  recorrenciasVazio: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "var(--text-faint)",
    padding: "6px 2px",
  },
  recorrenciasLista: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  recorrenciaLinha: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    fontSize: 13.5,
    color: "var(--text-soft)",
    minWidth: 0,
  },
  recorrenciaValor: {
    fontFamily: "'Sora', sans-serif",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  recorrenciaDesc: {
    color: "var(--text)",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  recorrenciaFreq: {
    color: "var(--text-faint)",
    whiteSpace: "nowrap",
  },
  recorrenciasSep: {
    color: "var(--text-faint)",
  },
  recorrenciasMais: {
    background: "none",
    border: "none",
    color: "var(--accent)",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    padding: "4px 0 0",
    textAlign: "left",
    alignSelf: "flex-start",
  },
};
