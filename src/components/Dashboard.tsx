import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Settings,
  Eye, EyeOff,
  Receipt, PieChart as PieIcon, AlertTriangle, RotateCw,
  Repeat, Home, CopyPlus, Download, Sun, Sunrise, Moon,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  listarLancamentos, criarLancamento, criarLancamentosEmLote,
  atualizarLancamento, removerLancamento, removerLancamentosEmLote,
} from "../lib/lancamentos";
import { CATEGORIAS_SAIDA, CATEGORIAS_ENTRADA, MESES } from "../types";
import type { Lancamento, NovoLancamento, Recorrencia, Tipo } from "../types";
import { useDinheiro, usePreferencias } from "../hooks/usePreferencias";
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
import type { Competencia } from "../lib/calculos";
import ResumoMes from "./ResumoMes";
import ListaLancamentos from "./ListaLancamentos";
import CardSaldo from "./CardSaldo";
import MonthPicker from "./MonthPicker";
import { useSwipe } from "../hooks/useSwipe";
import ModalNovo from "./ModalNovo";
import ModalAdicionar from "./ModalAdicionar";
import ModalRepetirMes from "./ModalRepetirMes";
import Toast, { type ToastAcao, type ToastDados } from "./Toast";
import EmptyState from "./EmptyState";
import { SkeletonLista } from "./Skeleton";
import BottomNav from "./BottomNav";
import ContasAPagar from "./ContasAPagar";
import Recorrencias from "./Recorrencias";
import { gerarLancamentosRecorrentes, listarRecorrencias } from "../lib/recorrencias";
import { pendentesDeContas } from "../lib/listas";
import { CONTAS_A_PAGAR_HABILITADO } from "../lib/flags";
import { filtrarPeriodo, gerarCsv, nomeDoArquivo } from "../lib/csv";
import type { Periodo } from "../lib/csv";
import ModalExportar from "./ModalExportar";
import ModalPreferencias from "./ModalPreferencias";
import { limparRascunho } from "../lib/rascunho";
import AvisoDesatualizado from "./AvisoDesatualizado";
import { useAgora } from "../hooks/useAgora";
import { dataCurta, periodoDoDia, primeiroNome, saudacao } from "../lib/saudacao";
import type { Periodo as PeriodoDoDia } from "../lib/saudacao";
import { podeAnimar, vibrar } from "../lib/movimento";
import { useRemocaoComDesfazer } from "../hooks/useRemocaoComDesfazer";

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

// O formulário completo de lançamento. É o que o + abre, e também como
// chega a conta paga em Contas a Pagar ou a linha que o Adicionar entregou
// para o usuário revisar — nesses casos com `valores` já preenchidos.
interface FormularioLancamento {
  valores: Partial<
    Pick<NovoLancamento, "tipo" | "valor" | "descricao" | "categoria">
  >;
  data: string;
}

// O Adicionar lê uma linha por lançamento, com "+" marcando entrada. É assim
// que o que foi digitado no formulário atravessa para lá sem se perder.
function comoLinha(valores: FormularioLancamento["valores"]): string {
  const descricao = valores.descricao?.trim();
  if (!descricao) return "";
  const valor =
    valores.valor == null ? "" : ` ${String(valores.valor).replace(".", ",")}`;
  const sinal = valores.tipo === "entrada" ? "+ " : "";
  return `${sinal}${descricao}${valor}`;
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
  // Data escolhida no formulário antes de trocar para o Adicionar. Sem ela a
  // leva voltaria para o dia padrão do mês, perdendo a data já informada.
  const [dataAdicionar, setDataAdicionar] = useState<string | null>(null);
  const [modalRepetir, setModalRepetir] = useState(false);
  const [modalExportar, setModalExportar] = useState(false);
  const [modalPreferencias, setModalPreferencias] = useState(false);
  const dinheiro = useDinheiro();
  const { preferencias, mudar } = usePreferencias();
  const ocultos = preferencias.ocultarValores;
  const [editando, setEditando] = useState<Lancamento | null>(null);
  // Tocar em Renda ou Gastos filtra a lista (só a lista: cards, saldo e
  // gráficos continuam olhando o mês inteiro). Fica ligado ao trocar de mês —
  // quem está comparando entradas quer seguir vendo entradas —, e o aviso no
  // título da lista não deixa esquecer que está filtrado.
  const [filtroTipo, setFiltroTipo] = useState<Tipo | null>(null);
  const listaRef = useRef<HTMLDivElement | null>(null);
  const [tipoGrafico, setTipoGrafico] = useState<"saida" | "entrada">("saida");
  const [toast, setToast] = useState<ToastDados | null>(null);
  const [erroCarregar, setErroCarregar] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"inicio" | "contas">("inicio");
  const [verRecorrencias, setVerRecorrencias] = useState(false);
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [carregandoRecorrencias, setCarregandoRecorrencias] = useState(true);
  const [formulario, setFormulario] =
    useState<FormularioLancamento | null>(null);
  const [contasEmAberto, setContasEmAberto] = useState({
    total: 0,
    quantidade: 0,
  });
  const [falhaAoAtualizar, setFalhaAoAtualizar] = useState(false);
  const mostrarToast = useCallback(
    (tipo: ToastDados["tipo"], mensagem: string, acao?: ToastAcao) => {
      setToast({ id: Date.now(), tipo, mensagem, acao });
    },
    []
  );

  // Apagar com Desfazer: o lançamento sai da tela na hora e só é apagado no
  // servidor quando o aviso com o Desfazer some (ver o hook).
  const remocao = useRemocaoComDesfazer<Lancamento>({
    remover: removerLancamento,
    aoTirar: (l) => setLancamentos((atual) => atual.filter((x) => x.id !== l.id)),
    aoDevolver: (l) =>
      setLancamentos((atual) => (atual.some((x) => x.id === l.id) ? atual : [l, ...atual])),
    aoFalhar: (l, e) => {
      console.error(e);
      setLancamentos((atual) => (atual.some((x) => x.id === l.id) ? atual : [l, ...atual]));
      mostrarToast("erro", "Não foi possível excluir. Verifique sua conexão.");
    },
  });
  const idEsperandoRemocao = remocao.idEsperando;

  const carregar = useCallback(() => {
    setCarregando(true);
    setErroCarregar(false);
    listarLancamentos()
      // O que está na janela do Desfazer ainda existe no servidor; recarregar
      // nesse meio-tempo (uma recorrência gerada, um "tentar de novo") não
      // pode trazê-lo de volta à tela.
      .then((lista) => {
        const esperando = idEsperandoRemocao();
        setLancamentos(esperando ? lista.filter((l) => l.id !== esperando) : lista);
      })
      .catch((e) => {
        console.error(e);
        setErroCarregar(true);
      })
      .finally(() => setCarregando(false));
  }, [idEsperandoRemocao]);

  const sincronizarCompetencia = useCallback(
    (alvo: Competencia) => {
      // Só gera para o mês corrente e futuros. Navegar para trás no
      // MonthPicker não deve materializar lançamentos em meses fechados. A
      // trava definitiva vive em gerarLancamentosRecorrentes; aqui evitamos
      // só a ida ao servidor.
      if (compararCompetencia(alvo, competenciaAtual()) < 0) return;

      gerarLancamentosRecorrentes(alvo.mes, alvo.ano)
        .then((novos) => {
          if (novos.length > 0) carregar();
        })
        .catch((e) => {
          console.error(e);
          setFalhaAoAtualizar(true);
        });
    },
    [carregar]
  );

  const sincronizarRecorrentes = useCallback(() => {
    sincronizarCompetencia({ mes, ano });
  }, [sincronizarCompetencia, mes, ano]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Separado do carregar de propósito: `sincronizarRecorrentes` muda de
  // identidade a cada mês visitado, e com os dois juntos navegar para
  // setembro e voltar rebaixava todos os lançamentos de novo, sem precisar.
  // Quando a geração cria algo, ela mesma chama o carregar.
  useEffect(() => {
    sincronizarRecorrentes();
  }, [sincronizarRecorrentes]);

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

  // Devolve se entrou. Quem chama só fecha o formulário com `true`: fechar de
  // qualquer jeito jogava fora o que a pessoa tinha acabado de digitar
  // justamente quando a conexão falhou, que é quando ela menos quer digitar
  // tudo de novo.
  async function adicionar(item: NovoLancamento): Promise<boolean> {
    try {
      const novo = await criarLancamento(item);
      setLancamentos((atual) => [novo, ...atual]);
      mostrarToast("sucesso", "Lançamento salvo!");
      return true;
    } catch (e) {
      console.error(e);
      mostrarToast("erro", "Não foi possível salvar. Verifique sua conexão.");
      return false;
    }
  }

  // Tira do ar a leva que acabou de entrar. É o arrependimento rápido: colou
  // a lista errada, trouxe o mês que não era. Passado o toast, o caminho
  // volta a ser excluir um a um.
  async function desfazerLote(ids: string[]) {
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
      // Recarrega em vez de restaurar uma cópia: esta função vive na closure
      // do toast, criada antes de a leva entrar na lista. Guardar `lancamentos`
      // ali devolveria a tela de antes do salvamento, escondendo linhas que
      // continuam no banco e apagando o que tivesse entrado nesse meio-tempo.
      carregar();
      mostrarToast("erro", "Não foi possível desfazer.");
    }
  }

  // Serve tanto ao Adicionar quanto ao Repetir mês: os dois entregam uma
  // leva pronta, que pode ter uma linha só. A origem importa só para o
  // rascunho, que é do Adicionar — salvar pelo Repetir não pode apagar um
  // texto meio digitado que ainda está lá.
  async function adicionarVarios(
    itens: NovoLancamento[],
    origem: "adicionar" | "repetir"
  ) {
    try {
      const novos = await criarLancamentosEmLote(itens);
      setLancamentos((atual) => [...novos, ...atual]);
      // O que estava escrito virou lançamento: o rascunho perdeu a função.
      if (origem === "adicionar") limparRascunho();
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

  async function exportarCsv(periodo: Periodo) {
    setModalExportar(false);
    const alvo = filtrarPeriodo(lancamentos, periodo);
    // O modal já desliga a opção vazia; isto é a rede para o caso de a lista
    // ter mudado entre abrir o modal e tocar.
    if (alvo.length === 0) {
      mostrarToast("erro", "Nada para exportar nesse período.");
      return;
    }

    const csv = gerarCsv(alvo);
    const nome = nomeDoArquivo(periodo, hojeLocal());
    const aviso =
      alvo.length === 1
        ? "1 lançamento exportado."
        : `${alvo.length} lançamentos exportados.`;

    // No iPhone, `<a download>` dentro do app instalado costuma abrir o CSV
    // como texto na tela em vez de salvar. O compartilhamento nativo resolve:
    // é dali que se manda para o Arquivos, para o Drive ou para outra pessoa.
    const arquivo =
      typeof File === "undefined"
        ? null
        : new File([csv], nome, { type: "text/csv" });
    if (arquivo && navigator.canShare?.({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: nome });
        mostrarToast("sucesso", aviso);
      } catch (e) {
        // Fechar a folha de compartilhamento é desistir, não é erro.
        if ((e as Error).name !== "AbortError") {
          console.error(e);
          mostrarToast("erro", "Não foi possível exportar.");
        }
      }
      return;
    }

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    // Precisa estar no documento para o clique valer em alguns navegadores
    // de celular; sai logo em seguida.
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revogar na mesma volta do laço cancela o download que acabou de
    // começar em parte dos navegadores — o endereço morre antes de o arquivo
    // ser lido. Um instante depois já é seguro.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);

    mostrarToast("sucesso", aviso);
  }

  // Correção rápida do valor, direto na lista: o caso do mês é a fatura que
  // veio diferente do previsto, e abrir o formulário inteiro para trocar um
  // número era o que fazia deixar para depois. A lista só chama aqui com um
  // valor válido e diferente do atual.
  async function corrigirValor(original: Lancamento, novoValor: number) {
    setLancamentos((atual) =>
      atual.map((l) =>
        l.id === original.id ? { ...l, valor: novoValor } : l
      )
    );
    try {
      // recorrencia_id não vai no update e por isso sobrevive: o vínculo com
      // a regra continua, e a geração seguinte encontra o conflito de
      // (recorrencia_id, data) e não sobrescreve o valor corrigido.
      const atualizado = await atualizarLancamento(original.id, {
        tipo: original.tipo,
        valor: novoValor,
        descricao: original.descricao,
        categoria: original.categoria,
        mes: original.mes,
        ano: original.ano,
        data: original.data,
      });
      setLancamentos((atual) =>
        atual.map((l) => (l.id === atualizado.id ? atualizado : l))
      );
      mostrarToast("sucesso", "Valor atualizado!");
    } catch (e) {
      console.error(e);
      setLancamentos((atual) =>
        atual.map((l) => (l.id === original.id ? original : l))
      );
      mostrarToast("erro", "Não foi possível salvar. Verifique sua conexão.");
    }
  }

  // A lista muda na hora, mas o formulário só fecha quando o servidor
  // confirma: falhando, a linha volta ao valor antigo e a correção continua
  // escrita na tela, pronta para tentar de novo.
  async function editar(item: NovoLancamento): Promise<boolean> {
    if (!editando) return false;
    const original = editando;
    const otimista: Lancamento = { ...original, ...item };
    setLancamentos((atual) =>
      atual.map((l) => (l.id === original.id ? otimista : l))
    );
    try {
      const atualizado = await atualizarLancamento(original.id, item);
      setLancamentos((atual) =>
        atual.map((l) => (l.id === atualizado.id ? atualizado : l))
      );
      setEditando(null);
      mostrarToast("sucesso", "Lançamento atualizado!");
      return true;
    } catch (e) {
      console.error(e);
      setLancamentos((atual) =>
        atual.map((l) => (l.id === original.id ? original : l))
      );
      mostrarToast("erro", "Não foi possível salvar. Verifique sua conexão.");
      return false;
    }
  }

  // Sem "tem certeza?": apaga e oferece o Desfazer. A pergunta antes de cada
  // exclusão cansava, e não salvava ninguém de nada — quem toca na lixeira
  // quer apagar; quem errou o toque precisa é de um jeito de voltar.
  function excluir(l: Lancamento) {
    remocao.apagar(l);
    mostrarToast("sucesso", `"${l.descricao || "Lançamento"}" excluído.`, {
      rotulo: "Desfazer",
      onAcao: () => {
        if (remocao.desfazer(l.id)) mostrarToast("sucesso", "Lançamento de volta.");
        else mostrarToast("erro", "Não deu tempo: ele já tinha sido excluído.");
      },
    });
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

  const listaVisivel = useMemo(
    () => (filtroTipo ? doMes.filter((l) => l.tipo === filtroTipo) : doMes),
    [doMes, filtroTipo]
  );

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
  const nome = primeiroNome(session.user.user_metadata);

  // Usada pelas duas navegações — a barra inferior no celular e o seletor do
  // header no desktop. Trocar de aba com um modal aberto deixaria o modal
  // pairando sobre a tela errada.
  // Um caminho só para fechar: o texto do atalho precisa ser esquecido em
  // todas as saídas, senão ele reaparece na próxima vez que o + for tocado.
  // O + e o Novo abrem o formulário de sempre. Escrever várias linhas ou
  // colar a lista continua a um toque, pelo botão dentro do formulário —
  // antes era o contrário, e caía no campo de texto quem só queria lançar um.
  const abrirFormulario = useCallback(
    (valores: FormularioLancamento["valores"] = {}, data?: string) => {
      setVerRecorrencias(false);
      setFormulario({ valores, data: data ?? dataInicialNovoLancamento(mes, ano) });
    },
    [mes, ano]
  );

  const fecharAdicionar = useCallback(() => {
    setModalAdicionar(false);
    setTextoAdicionar("");
    setDataAdicionar(null);
    onTextoInicialUsado?.();
  }, [onTextoInicialUsado]);

  function navegarPara(aba: "inicio" | "contas") {
    fecharAdicionar();
    setModalRepetir(false);
    setModalExportar(false);
    setModalPreferencias(false);
    setEditando(null);
    setFormulario(null);
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

  // O tom do topo acompanha a hora do dia (global.css, data-periodo). Fica
  // no <html> porque o véu é pintado no fundo da página inteira; sai quando
  // o Dashboard sai, para o login continuar liso.
  const agora = useAgora();
  const periodo = periodoDoDia(agora);
  useEffect(() => {
    document.documentElement.dataset.periodo = periodo;
    return () => {
      delete document.documentElement.dataset.periodo;
    };
  }, [periodo]);

  // Trocar de mês agora se vê: o conteúdo entra deslizando do lado de onde
  // o mês veio — avançar traz da direita, voltar traz da esquerda, o mesmo
  // sentido do dedo. E dá um toque de vibração (só Android obedece).
  //
  // Anima os blocos já montados com a Web Animations API, sem remontar nada:
  // trocar a `key` refaria gráficos e lista do zero a cada mês.
  const mesAnterior = useRef(ano * 12 + mes);
  useEffect(() => {
    const atual = ano * 12 + mes;
    const de = mesAnterior.current;
    mesAnterior.current = atual;
    if (atual === de) return;
    vibrar();
    const raiz = swipeHandlers.ref.current;
    if (!raiz || !podeAnimar()) return;
    const deslocamento = atual > de ? 28 : -28;
    raiz.querySelectorAll<HTMLElement>(".anima-mes").forEach((el) => {
      if (typeof el.animate !== "function") return;
      el.animate(
        [
          { transform: `translateX(${deslocamento}px)`, opacity: 0.35 },
          { transform: "translateX(0)", opacity: 1 },
        ],
        { duration: 260, easing: "cubic-bezier(.2,.7,.2,1)" }
      );
    });
  }, [mes, ano, swipeHandlers.ref]);

  return (
    <div
      ref={swipeHandlers.ref}
      style={styles.page}
      className="page-root page-com-bottom-nav"
      onTouchStart={swipeHandlers.onTouchStart}
      onTouchEnd={swipeHandlers.onTouchEnd}
    >
      {/* O topo: saudação pela hora do dia, o nome do app com a data de
          hoje, os três controles soltos à direita e o carrossel de meses.
          Sem logo: o ícone tinha cor fixa e destoava de qualquer cor de
          destaque escolhida. O e-mail mora nas preferências. */}
      <header className="topo">
        <div className="topo-linha">
          <h1 className="topo-saudacao">
            <Saudacao texto={saudacao(periodo, nome)} periodo={periodo} />
          </h1>
          <div className="cabecalho-acoes">
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
            <button
              type="button"
              className="botao-cabecalho"
              onClick={() => setModalExportar(true)}
              aria-label="Exportar CSV"
              title="Exportar em CSV"
            >
              <Download size={18} />
            </button>
            {/* Atalho do "esconder valores", como os apps de banco fazem:
                esconder é para antes de alguém ver, e três toques pela
                engrenagem eram tempo demais. Fica colado na engrenagem, no
                mesmo grupo de controles. É a mesma preferência do interruptor
                lá dentro: mexer num mexe no outro. O Sair mora dentro das
                preferências. */}
            <button
              type="button"
              className="botao-cabecalho"
              onClick={() => {
                vibrar();
                mudar({ ocultarValores: !ocultos });
              }}
              aria-label={ocultos ? "Mostrar valores" : "Esconder valores"}
              aria-pressed={ocultos}
              title={ocultos ? "Mostrar valores" : "Esconder valores"}
            >
              {ocultos ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button
              type="button"
              className="botao-cabecalho"
              onClick={() => setModalPreferencias(true)}
              aria-label="Preferências"
              title="Preferências"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
        <p className="topo-sub">
          <span className="topo-app">Minhas Finanças</span> · {dataCurta(agora)}
        </p>

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
            // A edição de uma regra refaz a ocorrência de hoje, que vive no
            // mês corrente — e não necessariamente no mês que está na tela.
            sincronizarCompetencia(competenciaAtual());
          }}
        />
      ) : abaAtiva === "inicio" || !CONTAS_A_PAGAR_HABILITADO ? (
      <>

      {falhaAoAtualizar && <AvisoDesatualizado onTentarDeNovo={atualizarTudo} />}

      <div style={styles.cards} className="cards anima-mes">
        <ResumoMes
          renda={renda}
          gastos={gastos}
          filtro={filtroTipo}
          onFiltrar={(tipo) => {
            vibrar();
            const novo = filtroTipo === tipo ? null : tipo;
            setFiltroTipo(novo);
            // Ligando o filtro, leva até a lista: no celular ela fica abaixo
            // do cartão do saldo, e o toque pareceria não ter feito nada.
            const lista = listaRef.current;
            if (novo && lista && typeof lista.scrollIntoView === "function") {
              lista.scrollIntoView({ behavior: podeAnimar() ? "smooth" : "auto", block: "start" });
            }
          }}
        />
        <CardSaldo
          valor={saldoAcumulado}
          pendente={pendentes}
          contasAPagar={contasEmAberto}
          saldoProjetado={
            pendentes.entradas.quantidade > 0 || pendentes.saidas.quantidade > 0
              ? saldoProjetado
              : undefined
          }
        />
      </div>

      <div style={styles.grid} className="graficos-no-fim anima-mes">
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
                    {c.name} · {dinheiro(c.value)}
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

      <div ref={listaRef} style={{ ...styles.panel, scrollMarginTop: 12 }} className="panel-mobile anima-mes">
        <div style={styles.listHead}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ ...styles.panelTitle, marginBottom: filtroTipo ? 6 : 0 }}>
              Lançamentos de {MESES[mes]}
            </h2>
            {filtroTipo && (
              <button
                type="button"
                onClick={() => setFiltroTipo(null)}
                style={{
                  ...styles.filtroAviso,
                  color: filtroTipo === "entrada" ? "var(--green)" : "var(--red)",
                }}
              >
                Só {filtroTipo === "entrada" ? "entradas" : "saídas"} · <u>Mostrar todos</u>
              </button>
            )}
          </div>
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
              onClick={() => abrirFormulario()}
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
        ) : doMes.length > 0 && listaVisivel.length === 0 ? (
          <EmptyState
            icon={<Receipt size={24} />}
            titulo={`Nenhuma ${filtroTipo === "entrada" ? "entrada" : "saída"} em ${MESES[mes]}.`}
            acao={
              <button style={styles.repetirDestaque} onClick={() => setFiltroTipo(null)}>
                Mostrar todos
              </button>
            }
          />
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
          <ListaLancamentos
            lancamentos={listaVisivel}
            hoje={hojeLocal()}
            onEditar={setEditando}
            onExcluir={excluir}
            onCorrigirValor={corrigirValor}
          />
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
            setFormulario({
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
          dataPadrao={dataAdicionar ?? dataInicialNovoLancamento(mes, ano)}
          jaLancados={lancamentos}
          textoInicial={textoAdicionar}
          onFechar={fecharAdicionar}
          onSalvar={(itens) => adicionarVarios(itens, "adicionar")}
          onFormularioCompleto={(valores, data) => {
            fecharAdicionar();
            setFormulario({ valores, data });
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
          onSalvar={(itens) => adicionarVarios(itens, "repetir")}
        />
      )}

      {formulario && (
        <ModalNovo
          valoresIniciais={formulario.valores}
          dataInicial={formulario.data}
          onFechar={() => setFormulario(null)}
          onColarLista={(valores, data) => {
            setFormulario(null);
            setTextoAdicionar(comoLinha(valores));
            setDataAdicionar(data);
            setModalAdicionar(true);
          }}
          onSalvar={async (item) => {
            if (await adicionar(item)) setFormulario(null);
          }}
        />
      )}

      {editando && (
        <ModalNovo
          lancamentoParaEditar={editando}
          onFechar={() => setEditando(null)}
          // `editar` fecha sozinho quando o servidor confirma.
          onSalvar={async (item) => {
            await editar(item);
          }}
        />
      )}

      {modalPreferencias && (
        <ModalPreferencias
          email={email}
          onSair={() => supabase.auth.signOut()}
          onFechar={() => setModalPreferencias(false)}
        />
      )}

      {modalExportar && (
        <ModalExportar
          mes={mes}
          ano={ano}
          lancamentos={lancamentos}
          onExportar={exportarCsv}
          onFechar={() => setModalExportar(false)}
        />
      )}

      {toast && <Toast toast={toast} onFechar={() => setToast(null)} />}

      <BottomNav
        abaAtiva={abaAtiva}
        mostrarContas={CONTAS_A_PAGAR_HABILITADO}
        onNavegar={navegarPara}
        onNovo={() => abrirFormulario()}
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
  const dinheiro = useDinheiro();
  const ativas = recorrencias.filter((r) => r.ativo);
  const visiveis = ativas.slice(0, 3);
  const restantes = ativas.length - visiveis.length;

  return (
    <div
      style={{ ...styles.panel, marginTop: 16 }}
      className="panel-mobile recorrencias-no-fim"
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
                  {r.tipo === "entrada" ? "+" : "−"} {dinheiro(r.valor)}
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

// "Boa tarde, Lorenzo ☀". O ícone do período fica colado na última palavra:
// se a saudação quebrar em duas linhas num celular estreito, o sol desce
// junto com o nome em vez de ficar sozinho numa linha.
function Saudacao({ texto, periodo }: { texto: string; periodo: PeriodoDoDia }) {
  const Icone = periodo === "manha" ? Sunrise : periodo === "tarde" ? Sun : Moon;
  const corte = texto.lastIndexOf(" ");
  return (
    <>
      {texto.slice(0, corte + 1)}
      <span className="topo-saudacao-fim">
        {texto.slice(corte + 1)}
        <Icone className="topo-icone-periodo" size={20} aria-hidden="true" />
      </span>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1060, margin: "0 auto", padding: "28px 20px 60px" },
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
  cards: {
    // Renda e Gastos lado a lado, e o card do saldo na linha inteira embaixo
    // (.card-destaque no global.css) — em qualquer largura. Ele mostra a conta
    // do fim do mês com dois valores grandes lado a lado e uma barra, e numa
    // coluna de um terço da tela não cabia sem quebrar e ficar mais alto que
    // os vizinhos. minmax(0, 1fr) para valor comprido não empurrar a página.
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: 14,
    marginBottom: 16,
  },
  grid: {
    display: "grid",
    // O min() deixa a coluna encolher quando a tela não tem a largura
    // mínima de sobra. Sem ele, em celular de 320px (iPhone SE antigo,
    // Android pequeno) os dois painéis passavam da borda e a página inteira
    // ganhava rolagem para o lado.
    // 380px de mínimo, e não 310: com 310, no tablet os dois painéis ficavam
    // lado a lado tão estreitos que "Gastos por categoria" quebrava em duas
    // linhas ao lado do Saídas/Entradas. Agora eles só se dividem a partir de
    // ~780px; abaixo disso, um embaixo do outro.
    gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))",
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
    // Num celular de 320px título e Saídas/Entradas não cabem lado a lado:
    // o seletor desce para a linha de baixo em vez de o título se partir.
    flexWrap: "wrap",
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
  filtroAviso: {
    background: "none",
    border: "none",
    padding: 0,
    font: "inherit",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
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
